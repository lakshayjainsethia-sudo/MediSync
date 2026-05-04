const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const createTransport = (filename) => new winston.transports.DailyRotateFile({
  filename: path.join(__dirname, `../logs/${filename}-%DATE%.log`),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  )
});

const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const systemLogger = winston.createLogger({
  level: 'info',
  format: baseFormat,
  transports: [createTransport('system'), consoleTransport]
});

const securityLogger = winston.createLogger({
  level: 'info',
  format: baseFormat,
  transports: [createTransport('security'), consoleTransport]
});

const auditLoggerStream = winston.createLogger({
  level: 'info',
  format: baseFormat,
  transports: [createTransport('audit'), consoleTransport]
});

module.exports = { systemLogger, securityLogger, auditLogger: auditLoggerStream, logger: systemLogger };
