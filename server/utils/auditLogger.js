const AuditLog = require('../models/AuditLog');
const { securityLogger, auditLogger } = require('./logger');

const logAudit = async (action, req, targetId, targetModel, metadata = {}) => {
  try {
    const performedBy = req?.user?.id || null;
    const role = req?.user?.role || 'System';
    const ip = req?.ip || req?.connection?.remoteAddress;

    const logData = {
      action,
      targetId,
      targetModel,
      metadata,
      performedBy,
      role,
      ip,
      requestId: req?.id,
      endpoint: req?.originalUrl
    };

    if (action.includes('FAILED') || action.includes('ATTEMPT')) {
      securityLogger.warn(`Security Event: ${action}`, logData);
    } else {
      auditLogger.info(`Audit Event: ${action}`, logData);
    }

    await AuditLog.create({
      action,
      targetId,
      targetModel,
      metadata,
      performedBy,
      role,
      ip
    });
  } catch (err) {
    // Never throw — audit failure must not break the main flow
    securityLogger.error(`[AUDIT LOG FAILED] ${err.message}`, { error: err.message });
  }
};

module.exports = { logAudit };
