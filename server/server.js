  require('dotenv').config();
  const express = require('express');
  const mongoose = require('mongoose');
  const cors = require('cors');
  const cookieParser = require('cookie-parser');
  const morgan = require('morgan');
  const { createProxyMiddleware } = require('http-proxy-middleware');

  const app = express();
  
  // Deployment Hardening
  app.set('trust proxy', 1);

  const corsOptions = {
    origin: process.env.CLIENT_URL || ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://127.0.0.1:5173'],
    methods: ['GET','POST','PATCH','PUT','DELETE'],
    allowedHeaders: ['Content-Type','Authorization','X-CSRF-Token'],
    credentials: true
  };
  
  app.use(cors(corsOptions));
  
  // Prometheus Metrics (/metrics endpoint)
  const promBundle = require('express-prom-bundle');
  const metricsMiddleware = promBundle({
    includeMethod: true, 
    includePath: true, 
    includeStatusCode: true,
    includeUp: true,
    promClient: {
      collectDefaultMetrics: {}
    }
  });
  app.use(metricsMiddleware);
  
  const requestTracker = require('./middleware/requestTracker');
  app.use(requestTracker);

  // 2B. Helmet (HTTP Security Headers)
  const helmet = require('helmet');
  app.use(helmet());
  app.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'"],
      objectSrc:  ["'none'"],
      frameSrc:   ["'none'"]
    }
  }));

  // 2C. NoSQL Injection Prevention
  const mongoSanitize = require('express-mongo-sanitize');
  const { logAudit } = require('./utils/auditLogger');
  const { securityLogger } = require('./utils/logger');
  const { alertSecurityEvent } = require('./utils/alerter');
  
  app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      securityLogger.warn(`[SECURITY] Sanitized NoSQL injection attempt`, { key, ip: req.ip, requestId: req.id });
      alertSecurityEvent('NOSQL_INJECTION_ATTEMPT', 'HIGH', { key, ip: req.ip });
      logAudit('INJECTION_ATTEMPT', req, null, 'System', { key, ip: req.ip });
    }
  }));

  // 2D. XSS Prevention
  const xss = require('xss-clean');
  app.use(xss());

  // 2E. HTTP Parameter Pollution Prevention
  const hpp = require('hpp');
  app.use(hpp({
    whitelist: ['status', 'role', 'category']
  }));

  // 2G. Request Size Limit
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  app.use(cookieParser());
  app.use(morgan('dev'));

  const csrfProtection = require('./middleware/csrf');
  app.use(csrfProtection);

  // 4. SECURITY RESPONSE HEADERS
  app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Frame-Options', 'DENY');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // 2F. Rate Limiting
  const rateLimit = require('express-rate-limit');
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      error: 'Too many requests. Please try again after 15 minutes.'
    }
  });

  const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
      status: 429,
      error: 'Too many sensitive requests. Please try again after 15 minutes.'
    }
  });

  app.use('/api/v1/', globalLimiter);
  app.use('/api/v1/auth/login', strictLimiter);
  app.use('/api/v1/auth/register', strictLimiter);

  // Proxy to FastAPI Intelligence Engine
  app.use('/api/v1/intelligence', createProxyMiddleware({
    target: process.env.FASTAPI_URL || 'http://localhost:8000',
    changeOrigin: true,
    pathRewrite: {
      '^/api/v1/intelligence': '', // remove base path when proxying
    },
  }));

  // Routes
  const aiRoutes = require('./routes/ai');

  app.use('/api/v1/auth', require('./routes/auth'));
  app.use('/api/v1/doctors', require('./routes/doctors'));
  app.use('/api/v1/patients', require('./routes/patients'));
  app.use('/api/v1/appointments', require('./routes/appointments'));
  app.use('/api/v1/admin', require('./routes/admin'));
  app.use('/api/v1/departments', require('./routes/departments'));
  app.use('/api/v1/medical-records', require('./routes/medicalRecords'));
  app.use('/api/v1/prescriptions', require('./routes/prescriptions'));
  app.use('/api/v1/billing', require('./routes/billing'));
  app.use('/api/v1/notifications', require('./routes/notifications'));
  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/v1/equipment', require('./routes/equipment'));
  app.use('/api/v1/pharmacist', require('./routes/pharmacist'));
  app.use('/api/v1/medicines', require('./routes/medicines'));
  app.use('/api/v1/receptionist', require('./routes/receptionist'));

  // Error handling middleware
  const globalErrorHandler = require('./middleware/errorHandler');
  app.use(globalErrorHandler);

  const http = require('http');
  const { Server } = require('socket.io');

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: corsOptions
  });

  const cookie = require('cookie');
  const jwt = require('jsonwebtoken');

  io.use((socket, next) => {
    if (socket.request.headers.cookie) {
      const cookies = cookie.parse(socket.request.headers.cookie);
      const token = cookies.token;
      if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
          if (!err && decoded && decoded.id) {
            socket.user = decoded;
          }
          next();
        });
        return;
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    if (socket.user && socket.user.role) {
      const room = `${socket.user.role}s`; // e.g., 'doctors', 'receptionists'
      socket.join(room);
    }
    socket.on('disconnect', () => {
      console.log('Client disconnected', socket.id);
    });
  });

  app.set('io', io);

  // Database connection
  const PORT = process.env.PORT || 5000;
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log('Connected to MongoDB');
      server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err);
    });

  module.exports = { app, server };
