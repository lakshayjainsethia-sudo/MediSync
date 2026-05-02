  require('dotenv').config();
  const express = require('express');
  const mongoose = require('mongoose');
  const cors = require('cors');
  const cookieParser = require('cookie-parser');
  const morgan = require('morgan');
  const { createProxyMiddleware } = require('http-proxy-middleware');

  const app = express();

  // Middleware
  const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://127.0.0.1:5173'],
    credentials: true
  };
  
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan('dev'));

  // Proxy to FastAPI Intelligence Engine
  app.use('/api/intelligence', createProxyMiddleware({
    target: process.env.FASTAPI_URL || 'http://localhost:8000',
    changeOrigin: true,
    pathRewrite: {
      '^/api/intelligence': '', // remove base path when proxying
    },
  }));

  // Routes
  const aiRoutes = require('./routes/ai');

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/doctors', require('./routes/doctors'));
  app.use('/api/patients', require('./routes/patients'));
  app.use('/api/appointments', require('./routes/appointments'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/departments', require('./routes/departments'));
  app.use('/api/medical-records', require('./routes/medicalRecords'));
  app.use('/api/prescriptions', require('./routes/prescriptions'));
  app.use('/api/billing', require('./routes/billing'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/ai', aiRoutes);
  app.use('/api/equipment', require('./routes/equipment'));
  app.use('/api/pharmacist', require('./routes/pharmacist'));

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
  });

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
