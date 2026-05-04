const { systemLogger } = require('../utils/logger');

const globalErrorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  systemLogger.error('Unhandled Exception', {
    requestId: req.id,
    method: req.method,
    endpoint: req.originalUrl,
    error: err.message,
    stack: err.stack,
    userId: req?.user?.id
  });

  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    requestId: req.id
  });
};

module.exports = globalErrorHandler;
