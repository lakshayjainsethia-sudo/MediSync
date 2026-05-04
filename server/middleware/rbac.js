const permissionsMap = require('../config/permissions');
const { securityLogger } = require('../utils/logger');

const requirePermission = (permissionName) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      securityLogger.warn('RBAC Blocked: Unauthenticated access attempt', { ip: req.ip, endpoint: req.originalUrl, requestId: req.id });
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const role = req.user.role.toLowerCase();
    const userPermissions = permissionsMap[role] || [];

    if (!userPermissions.includes('all') && !userPermissions.includes(permissionName)) {
      securityLogger.warn(`RBAC Blocked: Role ${role} denied permission ${permissionName}`, { 
        userId: req.user.id, 
        endpoint: req.originalUrl,
        requestId: req.id
      });
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

module.exports = requirePermission;
