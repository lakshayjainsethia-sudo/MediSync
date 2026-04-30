/**
 * Role-Based Access Control (RBAC) Middleware.
 * Wraps or implements authorization logic to protect specific routes based on user role.
 */

const ApiError = require('../utils/ApiError');

/**
 * Middleware to ensure the authenticated user has one of the specified roles.
 * Must be used after an authentication middleware (like protect) which sets req.user.
 * 
 * @param  {...string} roles - Array of allowed roles (e.g., 'Admin', 'Pharmacist')
 * @returns Express middleware function
 */
exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authenticated'));
    }

    // Support case-insensitive role comparisons
    const userRole = (req.user.role || '').toLowerCase();
    const allowedRoles = roles.map(r => r.toLowerCase());

    if (!allowedRoles.includes(userRole)) {
      return next(new ApiError(403, `Role (${req.user.role}) is not authorized to access this resource`));
    }

    next();
  };
};
