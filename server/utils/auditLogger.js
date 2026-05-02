const AuditLog = require('../models/AuditLog');

const logAudit = async (action, req, targetId, targetModel, metadata = {}) => {
  try {
    await AuditLog.create({
      action,
      targetId,
      targetModel,
      metadata,
      performedBy: req.user.id,
      role: req.user.role,
      ip: req.ip || req.connection?.remoteAddress
    });
  } catch (err) {
    // Never throw — audit failure must not break the main flow
    console.error('[AUDIT LOG FAILED]', err.message);
  }
};

module.exports = { logAudit };
