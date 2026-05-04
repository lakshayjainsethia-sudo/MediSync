const { v4: uuidv4 } = require('uuid');
const { systemLogger } = require('../utils/logger');

const requestTracker = (req, res, next) => {
  req.id = uuidv4();
  
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    systemLogger.info('API Request', {
      requestId: req.id,
      method: req.method,
      endpoint: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip || req.connection?.remoteAddress,
      userId: req?.user?.id || 'unauthenticated'
    });
  });
  
  next();
};

module.exports = requestTracker;
