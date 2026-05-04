const { securityLogger } = require('./logger');

const SEVERITY_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

const alertSecurityEvent = (type, severity, details) => {
  if (!Object.values(SEVERITY_LEVELS).includes(severity)) {
    severity = SEVERITY_LEVELS.MEDIUM;
  }

  const alertPayload = {
    timestamp: new Date().toISOString(),
    type,
    severity,
    details
  };

  const logMessage = `[ALERT] ${severity} Severity Security Event: ${type}`;

  switch (severity) {
    case SEVERITY_LEVELS.LOW:
      securityLogger.info(logMessage, alertPayload);
      break;
    case SEVERITY_LEVELS.MEDIUM:
      securityLogger.warn(logMessage, alertPayload);
      break;
    case SEVERITY_LEVELS.HIGH:
    case SEVERITY_LEVELS.CRITICAL:
      securityLogger.error(logMessage, alertPayload);
      // In a real FAANG system, trigger SNS/Slack webhook here
      break;
    default:
      securityLogger.warn(logMessage, alertPayload);
  }
};

module.exports = { alertSecurityEvent, SEVERITY_LEVELS };
