  require('dotenv').config();
  const express = require('express');
  const mongoose = require('mongoose');
  const cors = require('cors');
  const cookieParser = require('cookie-parser');
  const morgan = require('morgan');
  const { createProxyMiddleware } = require('http-proxy-middleware');

  const app = express();

  // Middleware
  app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
  }));
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

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
  });

  const http = require('http');
  const { Server } = require('socket.io');

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:5173',
      credentials: true
    }
  });

  app.set('io', io);

  io.on('connection', (socket) => {
    console.log('A client connected via Socket.io', socket.id);
    socket.on('disconnect', () => {
      console.log('Client disconnected', socket.id);
    });
  });

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
