const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/v1/users/nurses
// @desc    Get all nurses
// @access  Private (Doctor, Admin)
router.get('/nurses', protect, authorize('doctor', 'admin'), async (req, res, next) => {
  try {
    const nurses = await User.find({ role: { $regex: /^nurse$/i } }).select('_id name email');
    res.status(200).json({
      success: true,
      count: nurses.length,
      data: nurses
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
