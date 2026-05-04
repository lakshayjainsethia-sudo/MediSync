const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

// Protect routes - user must be authenticated
const protect = async (req, res, next) => {
  try {
    let token;
    
    // STRICT: Only read token from secure HTTP-only cookies
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password -refreshToken');
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Normalize role string to lowercase to avoid strict equals bypassing
      if (req.user.role) {
         req.user.role = req.user.role.toLowerCase();
      }

      // STRICT OVERHAUL: Enforce isApproved logic for staff roles
      const staffRoles = ['doctor', 'nurse', 'pharmacist', 'receptionist'];
      if (staffRoles.includes(req.user.role) && req.user.isApproved === false) {
        return res.status(403).json({ 
          message: 'Your account is pending Admin approval. Please contact an administrator.',
          isPendingApproval: true 
        });
      }

      // Track online activity (Fire-and-forget, touches most recently active session)
      Session.findOneAndUpdate(
        { user: req.user._id }, 
        { lastActivity: Date.now() }, 
        { sort: { lastActivity: -1 } }
      ).catch(() => {});

      next();
    } catch (err) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// ... existing logic below until export ...

// Generate token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '15m'
  });
};

// Generate refresh token
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d'
  });
};

// Send token response
const sendTokenResponse = async (user, statusCode, req, res) => {
  // Create token
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  const options = {
    expires: new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  const UAParser = require('ua-parser-js');
  const geoip = require('geoip-lite');
  
  const parser = new UAParser(req.headers['user-agent']);
  const result = parser.getResult();
  const deviceOS = result.os.name ? `${result.os.name} ${result.os.version || ''}` : 'Unknown OS';
  const browser = result.browser.name ? `${result.browser.name} ${result.browser.version || ''}` : 'Unknown Browser';
  
  const ip = req.ip || req.connection?.remoteAddress;
  const geo = geoip.lookup(ip);
  const location = geo ? `${geo.city || 'Unknown City'}, ${geo.country || 'Unknown Country'}` : 'Unknown Location';

  // Anomaly Detection Layer
  const { detectAnomalies } = require('./anomalyDetector');
  await detectAnomalies(user, ip, deviceOS);

  // Save session to database for revocation tracking
  await Session.create({
    user: user._id,
    refreshTokenHash: refreshToken,
    deviceInfo: req.headers['user-agent'],
    deviceOS,
    browser,
    ip,
    location,
    lastActivity: Date.now(),
    expiresAt: options.expires
  });

  // Fetch robust dynamic context to drive frontend visibility
  const permissionsMap = require('../config/permissions');
  const getPermissions = (role) => permissionsMap[role] || [];

  res
    .status(statusCode)
    .cookie(process.env.COOKIE_NAME || 'token', token, options)
    .cookie('refreshToken', refreshToken, options)
    .json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        specialization: user.specialization,
        phone: user.phone,
        permissions: getPermissions(user.role)
      }
    });
};

module.exports = { protect, authorize, sendTokenResponse };
