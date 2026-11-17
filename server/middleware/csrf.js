const crypto = require('crypto');
const { securityLogger } = require('../utils/logger');

const generateToken = () => crypto.randomBytes(32).toString('hex');

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const csrfProtection = (req, res, next) => {
  // 1. Ensure the user has a CSRF session setup
  if (!req.cookies.csrfSecret) {
    const newSecret = generateToken();
    res.cookie('csrfSecret', newSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
    });
    // Send public token in non-httpOnly cookie so frontend can read it and send back in headers
    res.cookie('XSRF-TOKEN', newSecret, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
    });
    req.cookies.csrfSecret = newSecret;
  }

  // 2. Skip CSRF validation for safe read-only methods
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  // 2.5 Skip CSRF validation for login and register as they establish the session
  const EXCLUDED_ROUTES = ['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/admin/setup'];
  if (EXCLUDED_ROUTES.includes(req.originalUrl) || EXCLUDED_ROUTES.includes(req.path)) {
    return next();
  }

  // 3. Double Submit Cookie Validation
  const cookieSecret = req.cookies.csrfSecret;
  const headerToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];

  if (!cookieSecret || !headerToken || cookieSecret !== headerToken) {
    securityLogger.warn('CSRF Token Validation Failed', { 
      ip: req.ip, 
      endpoint: req.originalUrl,
      method: req.method,
      userId: req?.user?.id
    });
    return res.status(403).json({ error: 'Invalid CSRF Token' });
  }

  // 4. Origin/Referer Validation (Defense in Depth)
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Support array of allowed local development origins matching corsOptions
  const defaultAllowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174'
  ];

  const isAllowedOrigin = (url) => {
    if (!url) return false;
    if (process.env.CLIENT_URL && url.startsWith(process.env.CLIENT_URL)) {
      return true;
    }
    return defaultAllowedOrigins.some(allowed => url.startsWith(allowed));
  };

  if (origin && !isAllowedOrigin(origin)) {
    securityLogger.warn('CSRF Origin Validation Failed', { origin, ip: req.ip });
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (!origin && referer && !isAllowedOrigin(referer)) {
    securityLogger.warn('CSRF Referer Validation Failed', { referer, ip: req.ip });
    return res.status(403).json({ error: 'Referer not allowed' });
  }

  next();
};

module.exports = csrfProtection;
