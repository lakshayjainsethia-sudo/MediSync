const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const MedicalRecord = require('../models/MedicalRecord');
const Appointment = require('../models/Appointment');

// All routes require authentication
router.use(protect);

// @route   POST /api/medical-records
// @desc    Create a new medical record
// @access  Private (Doctor only)
router.post(
  '/',
  [
    authorize('doctor', 'admin'),
    [
      check('patient', 'Patient ID is required').not().isEmpty(),
      check('chiefComplaint', 'Chief complaint is required').not().isEmpty(),
      check('diagnosis.primary', 'Primary diagnosis is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    try {
      const recordData = {
        ...req.body,
        doctor: req.user.id
      };

      const record = new MedicalRecord(recordData);
      await record.save();

      // Populate patient and doctor details
      await record.populate('patient', 'name email phone');
      await record.populate('doctor', 'name specialization');

      res.status(201).json(record);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: 'Server Error' });
    }
  }
);

// @route   GET /api/medical-records/patient/:patientId
// @desc    Get all medical records for a patient
// @access  Private
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    // Check if user is authorized (patient themselves, their doctor, admin, receptionist, or pharmacist)
    const allowedRoles = ['admin', 'doctor', 'receptionist', 'pharmacist'];
    if (!allowedRoles.includes(req.user.role) && req.user.id !== patientId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const records = await MedicalRecord.find({ patient: patientId })
      .populate('doctor', 'name specialization')
      .populate('appointment', 'date startTime')
      .sort({ visitDate: -1 });

    res.json(records);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/medical-records/me
// @desc    Get current user's medical records
// @access  Private
router.get('/me', async (req, res) => {
  try {
    let records;

    if (req.user.role === 'patient') {
      records = await MedicalRecord.find({ patient: req.user.id })
        .populate('doctor', 'name specialization')
        .populate('appointment', 'date startTime')
        .sort({ visitDate: -1 });
    } else if (req.user.role === 'doctor') {
      records = await MedicalRecord.find({ doctor: req.user.id })
        .populate('patient', 'name email phone')
        .populate('appointment', 'date startTime')
        .sort({ visitDate: -1 });
    } else {
      return res.status(400).json({ message: 'Invalid role' });
    }

    res.json(records);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/medical-records/:id
// @desc    Get single medical record
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id)
      .populate('patient', 'name email phone')
      .populate('doctor', 'name specialization')
      .populate('appointment', 'date startTime');

    if (!record) {
      return res.status(404).json({ message: 'Medical record not found' });
    }

    // Check authorization
    const allowedRoles = ['admin', 'doctor', 'receptionist', 'pharmacist'];
    if (!allowedRoles.includes(req.user.role) && 
        record.patient._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(record);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Medical record not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PUT /api/medical-records/:id
// @desc    Update medical record
// @access  Private (Doctor or Admin only)
router.put('/:id', [authorize('doctor', 'admin')], async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ message: 'Medical record not found' });
    }

    // Check if doctor owns this record or is admin
    if (req.user.role !== 'admin' && record.doctor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updatedRecord = await MedicalRecord.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate('patient', 'name email phone')
      .populate('doctor', 'name specialization');

    res.json(updatedRecord);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Medical record not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   DELETE /api/medical-records/:id
// @desc    Delete medical record
// @access  Private (Admin only)
router.delete('/:id', [authorize('admin')], async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ message: 'Medical record not found' });
    }

    await record.deleteOne();
    res.json({ message: 'Medical record deleted' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Medical record not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
