const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Appointment = require('../models/Appointment');

const SHIFT_START_MINUTES = 9 * 60;
const SHIFT_END_MINUTES = 17 * 60;
const SLOT_INTERVAL_MINUTES = 30;

function padTime(value) {
  return value.toString().padStart(2, '0');
}

function toTime24(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${padTime(hours)}:${padTime(minutes)}`;
}

function toDisplayTime(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${padTime(minutes)} ${period}`;
}

function getDateBounds(dateString) {
  const selectedDate = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(selectedDate.getTime())) {
    return null;
  }

  const start = new Date(selectedDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(selectedDate);
  end.setHours(23, 59, 59, 999);

  return { selectedDate, start, end };
}

function isSameLocalDay(firstDate, secondDate) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

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

// @route   GET /api/doctors/:id/slots?date=YYYY-MM-DD
// @desc    Get full doctor shift slot grid with availability flags
// @access  Public
router.get('/:id/slots', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    const bounds = getDateBounds(date);
    if (!bounds) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const doctor = await User.findOne({
      _id: req.params.id,
      role: 'doctor',
      isApproved: true
    }).select('_id');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const appointments = await Appointment.find({
      doctor: req.params.id,
      date: { $gte: bounds.start, $lte: bounds.end },
      status: { $ne: 'cancelled' }
    }).select('startTime');

    const bookedStartTimes = new Set(appointments.map((appointment) => appointment.startTime));
    const now = new Date();
    const isToday = isSameLocalDay(bounds.selectedDate, now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const slots = [];
    for (let minutes = SHIFT_START_MINUTES; minutes < SHIFT_END_MINUTES; minutes += SLOT_INTERVAL_MINUTES) {
      const endMinutes = minutes + SLOT_INTERVAL_MINUTES;
      const startTime = toTime24(minutes);
      const endTime24 = toTime24(endMinutes);
      const isBooked = bookedStartTimes.has(startTime);
      const isPast = isToday && minutes <= currentMinutes;

      slots.push({
        time: toDisplayTime(minutes),
        endTime: toDisplayTime(endMinutes),
        startTime,
        endTime24,
        isAvailable: !isBooked && !isPast
      });
    }

    res.json(slots);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Doctor not found' });
    }
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
