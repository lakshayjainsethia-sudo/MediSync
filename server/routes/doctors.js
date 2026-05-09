const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Appointment = require('../models/Appointment');

// @route   GET /api/doctors
// @desc    Get all doctors (approved only)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const doctors = await User.find({ 
      role: 'doctor',
      isApproved: true 
    }).select('-password -refreshToken');
    
    res.json(doctors);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/doctors/top
// @desc    Get top rated doctors
// @access  Public
router.get('/top', async (req, res) => {
  try {
    const doctors = await User.find({ 
      role: 'doctor',
      isApproved: true,
      totalRatings: { $gt: 0 }
    })
    .sort({ averageRating: -1, totalRatings: -1 })
    .limit(5)
    .select('name specialization averageRating totalRatings profileImage');
    
    res.json(doctors);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/doctors/:id
// @desc    Get single doctor
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const doctor = await User.findOne({
      _id: req.params.id,
      role: 'doctor',
      isApproved: true
    }).select('-password -refreshToken');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    res.json(doctor);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/doctors/me
// @desc    Update doctor profile
// @access  Private (Doctor only)
router.put(
  '/me',
  [
    protect,
    authorize('doctor'),
    [
      check('specialization', 'Specialization is required').not().isEmpty(),
      check('phone', 'Phone number is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    try {
      const { specialization, phone, address } = req.body;

      const doctor = await User.findByIdAndUpdate(
        req.user.id,
        { $set: { specialization, phone, address } },
        { new: true, runValidators: true }
      ).select('-password -refreshToken');

      res.json(doctor);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   GET /api/doctors/me/appointments
// @desc    Get doctor's appointments
// @access  Private (Doctor only)
router.get(
  '/me/appointments',
  [protect, authorize('doctor')],
  async (req, res) => {
    try {
      const appointments = await Appointment.find({ doctor: req.user.id })
        .populate('patient', 'name email phone')
        .sort({ date: 1, startTime: 1 });

      res.json(appointments);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

module.exports = router;
