const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { protect, authorize } = require('../middleware/auth');
const applyRoleProjection = require('../middleware/applyRoleProjection');
const { logAudit } = require('../utils/auditLogger');

// @route   GET /api/v1/nurse/my-patients
// @desc    Get patients assigned to the current nurse
// @access  Private (Nurse)
router.get('/my-patients', [protect, authorize('nurse', 'admin'), applyRoleProjection], async (req, res) => {
  try {
    const appointments = await Appointment.find({
      assignedNurse: req.user.id,
      status: { $in: ['Confirmed', 'Active', 'Billing_Pending'] }
    })
      .populate('patient', 'name age')
      .populate('assignedDoctor', 'name specialization')
      .select(req.fieldProjection);

    // Compute vitalsToday locally without writing a new pipeline
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    let vitalsTodayCount = 0;
    appointments.forEach(apt => {
      if (apt.nurseNotes && apt.nurseNotes.length > 0) {
        vitalsTodayCount += apt.nurseNotes.filter(n =>
          n.recordedBy?.toString() === req.user.id &&
          new Date(n.recordedAt) >= todayMidnight
        ).length;
      }
    });

    // Custom sorting: RED first, then descending weightedScore
    appointments.sort((a, b) => {
      if (a.triage_tag === 'RED' && b.triage_tag !== 'RED') return -1;
      if (b.triage_tag === 'RED' && a.triage_tag !== 'RED') return 1;
      return (b.weightedScore || 0) - (a.weightedScore || 0);
    });

    res.json({
      appointments,
      vitalsToday: vitalsTodayCount
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/v1/nurse/all-appointments
// @desc    Get all active appointments for the ward view
// @access  Private (Nurse)
router.get('/all-appointments', [protect, authorize('nurse', 'admin'), applyRoleProjection], async (req, res) => {
  try {
    const appointments = await Appointment.find({
      status: { $in: ['Confirmed', 'Active'] }
    })
      .populate('patient', 'name age')
      .populate('assignedDoctor', 'name specialization')
      .populate('assignedNurse', 'name')
      .select(req.fieldProjection)
      .sort({ weightedScore: -1 });

    res.json(appointments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/v1/nurse/upcoming-appointments
// @desc    Get all scheduled appointments for today
// @access  Private (Nurse)
router.get('/upcoming-appointments', [protect, authorize('nurse', 'admin'), applyRoleProjection], async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await Appointment.find({
      status: 'scheduled',
      date: { $gte: today, $lt: tomorrow }
    })
      .populate('patient', 'name age')
      .populate('assignedDoctor', 'name specialization')
      .select(req.fieldProjection)
      .sort({ startTime: 1 });

    res.json(appointments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/v1/nurse/appointments/:id/vitals
// @desc    Record vitals for a patient
// @access  Private (Nurse, Admin)
router.post('/appointments/:id/vitals', [protect, authorize('nurse', 'admin')], async (req, res) => {
  try {
    const { note, vitals } = req.body;
    const appointment = await Appointment.findById(req.params.id).populate('patient', 'name');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (req.user.role === 'nurse' && appointment.assignedNurse?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to record vitals for this patient' });
    }

    const newNote = {
      note,
      vitals,
      recordedBy: req.user.id,
      recordedAt: Date.now()
    };

    appointment.nurseNotes.push(newNote);
    await appointment.save();

    await logAudit('VITALS_RECORDED', req, appointment._id, 'Appointment', { vitals, note });

    const io = req.app.get('io');
    if (io) {
      io.to('doctors').emit('vitals_updated', {
        appointmentId: appointment._id,
        patientName: appointment.patient?.name || 'Unknown Patient',
        nurseName: req.user.name,
        vitals,
        recordedAt: Date.now()
      });
    }

    res.json(appointment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/v1/nurse/appointments/:id/triage-override
// @desc    Nurse manually overrides AI triage assessment
// @access  Private (Nurse, Admin)
router.patch('/appointments/:id/triage-override', [protect, authorize('nurse', 'admin')], async (req, res) => {
  try {
    const { updatedTag, updatedReason } = req.body;
    const appointment = await Appointment.findById(req.params.id).populate('patient', 'name');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (req.user.role === 'nurse' && appointment.assignedNurse?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to override triage for this patient' });
    }

    appointment.triageOverride = {
      updatedTag,
      updatedReason,
      updatedBy: req.user.id,
      updatedAt: Date.now()
    };
    
    // Also update the main triage tag
    const previousTag = appointment.triage_tag;
    appointment.triage_tag = updatedTag;

    await appointment.save();

    await logAudit('TRIAGE_OVERRIDE_NURSE', req, appointment._id, 'Appointment', { from: previousTag, to: updatedTag, reason: updatedReason });

    if (updatedTag === 'RED') {
      const io = req.app.get('io');
      if (io) {
        const payload = {
          appointmentId: appointment._id,
          patientName: appointment.patient?.name || 'Unknown Patient',
          newTag: 'RED',
          reason: updatedReason,
          escalatedBy: req.user.name
        };
        io.to('doctors').emit('triage_escalated', payload);
        io.to('receptionists').emit('triage_escalated', payload);
      }
    }

    res.json(appointment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
