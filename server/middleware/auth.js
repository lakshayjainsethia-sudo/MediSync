const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - user must be authenticated
const protect = async (req, res, next) => {
  try {
    let token;
    
    // Get token from cookies or Authorization header
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
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
const sendTokenResponse = (user, statusCode, res) => {
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

  // Save refresh token to database
  user.refreshToken = refreshToken;
  user.save({ validateBeforeSave: false });

  // Define robust dynamic context to drive frontend visibility
  const getPermissions = (role) => {
    switch(role) {
      case 'admin': return ['all'];
      case 'doctor': return ['read:patients', 'write:medical-records', 'read:appointments', 'write:appointments', 'read:billing'];
      case 'receptionist': return ['read:patients', 'read:appointments', 'write:appointments', 'read:billing', 'write:billing'];
      case 'pharmacist': return ['read:prescriptions', 'read:equipment', 'write:dispense'];
      case 'patient': return ['read:own_records', 'read:own_appointments', 'write:own_appointments', 'read:own_billing'];
      default: return [];
    }
  };

  res
    .status(statusCode)
    .cookie(process.env.COOKIE_NAME || 'token', token, options)
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
