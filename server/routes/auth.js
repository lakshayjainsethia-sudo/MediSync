const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const jwt = require('jsonwebtoken');
const { sendTokenResponse } = require('../middleware/auth');
const User = require('../models/User');
const { validateLoginInput } = require('../middleware/validate');
const { logAudit } = require('../utils/auditLogger');

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
const REGISTERABLE_ROLES = ['patient', 'doctor', 'nurse', 'receptionist', 'pharmacist'];
const ROLES_REQUIRING_APPROVAL = ['doctor', 'nurse', 'receptionist', 'pharmacist'];
const AUTO_APPROVED_ROLES = REGISTERABLE_ROLES.filter((role) => !ROLES_REQUIRING_APPROVAL.includes(role));

router.post(
  '/register',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
    check('role', 'Please specify a valid role').isIn(REGISTERABLE_ROLES)
  ],
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      // Check if user exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Create user
      user = new User({
        name,
        email,
        password,
        role,
        isApproved: AUTO_APPROVED_ROLES.includes(role)
      });

      await user.save();

      // Send token response
      sendTokenResponse(user, 201, res);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user & get token
// @access  Public
router.post(
  '/login',
  [
    validateLoginInput,
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
  ],
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Check if user exists
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        await logAudit('LOGIN_FAILED', req, null, 'User', { email, reason: 'Invalid credentials' });
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Check if password matches
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        await logAudit('LOGIN_FAILED', req, user._id, 'User', { email, reason: 'Wrong password' });
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Check if user is approved (staff roles require admin approval)
      if (ROLES_REQUIRING_APPROVAL.includes(user.role) && !user.isApproved) {
        return res.status(400).json({ message: 'Your account is pending admin approval' });
      }

      // Send token response
      sendTokenResponse(user, 200, res);
      await logAudit('LOGIN_SUCCESS', req, user._id, 'User', { email: user.email, role: user.role });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', require('../middleware/auth').protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshToken');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user / clear cookie
// @access  Private
router.post('/logout', (req, res) => {
  res.cookie(process.env.COOKIE_NAME || 'token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({ success: true, message: 'User logged out successfully' });
});

// @route   POST /api/auth/refresh-token
// @desc    Refresh access token
// @access  Public
router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    // Check if user exists and refresh token matches
    const user = await User.findOne({ _id: decoded.id, refreshToken });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Generate new tokens using sendTokenResponse
    sendTokenResponse(user, 200, res);
    await logAudit('TOKEN_REFRESHED', req, user._id, 'User', {});
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

module.exports = router;
