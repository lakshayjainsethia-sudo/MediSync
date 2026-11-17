const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Use a LOCAL (non-OneDrive) log directory to avoid OneDrive sync hangs.
// Falls back to the original server/logs/ path only if the env var overrides it.
const LOG_DIR = process.env.LOG_DIR ||
  path.join(os.homedir(), 'AppData', 'Local', 'MediSync', 'logs');

// Ensure the log directory exists locally (synchronous is fine at import time)
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (_) {}

const createTransport = (filename) => new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, `${filename}-%DATE%.log`),
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
