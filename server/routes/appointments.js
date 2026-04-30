const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const aiService = require('../services/aiService');

// @route   POST /api/appointments
// @desc    Create a new appointment
// @access  Private
router.post(
  '/',
  [
    protect,
    [
      check('doctor', 'Doctor ID is required').not().isEmpty(),
      check('date', 'Please include a valid date').isISO8601(),
      check('startTime', 'Start time is required').not().isEmpty(),
      check('endTime', 'End time is required').not().isEmpty(),
      check('symptoms', 'Symptoms are required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    try {
      const { doctor, date, startTime, endTime, symptoms, notes, priority } = req.body;
      
      // Check if doctor exists and is approved
      const doctorExists = await User.findOne({
        _id: doctor,
        role: 'doctor',
        isApproved: true
      });
      
      if (!doctorExists) {
        return res.status(400).json({ message: 'Doctor not found or not approved' });
      }
      
      // Check for existing appointment at the same time
      const existingAppointment = await Appointment.findOne({
        doctor,
        date,
        startTime,
        status: { $ne: 'cancelled' }
      });
      
      if (existingAppointment) {
        return res.status(400).json({ message: 'Time slot is already booked' });
      }
      
      // AI Triage Integration
      let aiPriority = 'Normal';
      let aiSuggestedDept = '';
      let aiConfidence = 50;
      let aiReasoning = '';
      let aiRedFlags = [];
      
      if (symptoms) {
        const symptomsText = Array.isArray(symptoms) ? symptoms.join(', ') : symptoms;
        const triageResult = await aiService.analyzeSymptoms(symptomsText);
        aiPriority = triageResult.aiPriority;
        aiSuggestedDept = triageResult.aiSuggestedDept;
        aiConfidence = triageResult.aiConfidence;
        aiReasoning = triageResult.aiReasoning;
        aiRedFlags = triageResult.aiRedFlags;
      }
      
      // Create new appointment
      const appointment = new Appointment({
        patient: req.user.id,
        doctor,
        date,
        startTime,
        endTime,
        symptoms,
        notes: notes || '',
        status: 'scheduled',
        priority: priority || (aiPriority === 'High' ? 1 : 5),
        aiPriority,
        aiSuggestedDept,
        aiConfidence,
        aiReasoning,
        aiRedFlags
      });
      
      await appointment.save();
      
      // Populate doctor and patient details
      await appointment.populate('doctor', 'name specialization');
      await appointment.populate('patient', 'name email');
      
      // Real-Time Socket.io Alert if priority is HIGH
      if (aiPriority === 'High') {
        const io = req.app.get('io');
        if (io) {
          io.emit('triage_alert_high', {
            appointmentId: appointment._id,
            patientName: appointment.patient.name,
            aiReasoning,
            aiRedFlags,
            date,
            startTime
          });
        }
      }
      
      res.status(201).json(appointment);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   GET /api/appointments
// @desc    Get all appointments (Admin, Receptionist, Pharmacist, Doctor)
// @access  Private
router.get(
  '/',
  [protect, authorize('admin', 'receptionist', 'pharmacist', 'doctor')],
  async (req, res) => {
    try {
      const appointments = await Appointment.find()
        .populate('doctor', 'name specialization')
        .populate('patient', 'name email phone')
        .sort({ date: 1, startTime: 1 });
        
      res.json(appointments);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   GET /api/appointments/me
// @desc    Get current user's appointments
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    let appointments;
    
    if (req.user.role === 'patient') {
      appointments = await Appointment.find({ patient: req.user.id })
        .populate('doctor', 'name specialization')
        .sort({ priority: 1, date: -1, startTime: -1 }); // Priority 1 and 2 move to the top
    } else if (req.user.role === 'doctor') {
      appointments = await Appointment.find({ doctor: req.user.id })
        .populate('patient', 'name email phone')
        .sort({ priority: 1, date: 1, startTime: 1 }); // Priority 1 and 2 move to the top
    } else {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
    res.json(appointments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/appointments/:id/cancel
// @desc    Cancel an appointment
// @access  Private
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Check if the user is authorized to cancel this appointment
    if (appointment.patient.toString() !== req.user.id && 
        appointment.doctor.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to cancel this appointment' });
    }
    
    // Check if appointment can be cancelled (e.g., not in the past)
    const appointmentDateTime = new Date(
      `${appointment.date.toISOString().split('T')[0]}T${appointment.startTime}`
    );
    
    if (appointmentDateTime < new Date()) {
      return res.status(400).json({ message: 'Cannot cancel past appointments' });
    }
    
    // Update appointment status
    appointment.status = 'cancelled';
    await appointment.save();
    
    res.json({ message: 'Appointment cancelled successfully' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/appointments/:id/complete
// @desc    Mark appointment as completed (Doctor only)
// @access  Private
router.put(
  '/:id/complete',
  [protect, authorize('doctor')],
  async (req, res) => {
    try {
      const { diagnosis, prescription } = req.body;
      
      const appointment = await Appointment.findById(req.params.id);
      
      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }
      
      // Check if the doctor owns this appointment
      if (appointment.doctor.toString() !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized' });
      }
      
      // Update appointment
      appointment.status = 'completed';
      appointment.diagnosis = diagnosis || '';
      appointment.prescription = prescription || '';
      
      await appointment.save();
      
      res.json(appointment);
    } catch (err) {
      console.error(err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Appointment not found' });
      }
      res.status(500).send('Server Error');
    }
  }
);

// @route   GET /api/appointments/available-slots
// @desc    Get available time slots for a doctor on a specific date
// @access  Public
router.get('/available-slots', async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    
    if (!doctorId || !date) {
      return res.status(400).json({ message: 'Doctor ID and date are required' });
    }
    
    // Parse the date
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    
    // Get all appointments for the doctor on the selected date
    const appointments = await Appointment.find({
      doctor: doctorId,
      date: {
        $gte: new Date(selectedDate.setHours(0, 0, 0, 0)),
        $lt: new Date(selectedDate.setHours(23, 59, 59, 999))
      },
      status: { $ne: 'cancelled' }
    });
    
    // Generate time slots (example: 9:00 AM to 5:00 PM, 1-hour slots)
    const timeSlots = [];
    const startHour = 9; // 9 AM
    const endHour = 17; // 5 PM
    
    for (let hour = startHour; hour < endHour; hour++) {
      const startTime24 = `${hour.toString().padStart(2, '0')}:00`;
      const endHour24 = hour + 1;
      const endTime24 = `${endHour24.toString().padStart(2, '0')}:00`;
      
      // Format for display
      const startTimeDisplay = `${hour > 12 ? hour - 12 : hour === 0 ? 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
      const endTimeDisplay = `${endHour24 > 12 ? endHour24 - 12 : endHour24 === 0 ? 12 : endHour24}:00 ${endHour24 >= 12 ? 'PM' : 'AM'}`;
      
      // Check if this time slot is already booked
      const isBooked = appointments.some(apt => {
        return apt.startTime === startTime24 && apt.status !== 'cancelled';
      });
      
      timeSlots.push({
        time: startTimeDisplay,
        endTime: endTimeDisplay,
        startTime: startTime24,
        endTime24: endTime24,
        available: !isBooked
      });
    }
    
    res.json(timeSlots);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/appointments/:id/risk-override
// @desc    Manually override and flag appointment risk
// @access  Private (Receptionist, Admin)
router.patch(
  '/:id/risk-override',
  [protect, authorize('receptionist', 'admin')],
  async (req, res) => {
    try {
      const { riskOverride, riskOverrideReason } = req.body;
      const appointmentId = req.params.id;

      const appointment = await Appointment.findById(appointmentId)
        .populate('patient', 'name email phone');

      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }

      appointment.riskOverride = riskOverride;
      
      if (riskOverride) {
        appointment.riskOverrideReason = riskOverrideReason || '';
        appointment.riskOverrideBy = req.user.id;
        appointment.riskOverrideAt = new Date();
      } else {
        appointment.riskOverrideReason = '';
      }

      await appointment.save();

      // Emit Socket.io alert
      if (riskOverride && appointment.aiPriority !== 'High') {
        const io = req.app.get('io');
        if (io) {
          io.emit('manual_triage_alert', {
            appointmentId: appointment._id,
            patientName: appointment.patient.name,
            aiReasoning: appointment.aiReasoning,
            aiRedFlags: appointment.aiRedFlags,
            date: appointment.date,
            startTime: appointment.startTime,
            flag: 'MANUAL_OVERRIDE',
            reason: appointment.riskOverrideReason
          });
        }
      }

      res.json(appointment);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

module.exports = router;
