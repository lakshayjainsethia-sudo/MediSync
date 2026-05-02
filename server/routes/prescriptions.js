const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const Prescription = require('../models/Prescription');
const Medicine = require('../models/Medicine');
const Billing = require('../models/Billing');
const LabTest = require('../models/LabTest');

router.use(protect);

// @route   POST /api/prescriptions
// @desc    Create a new prescription
// @access  Private (Doctor only)
router.post(
  '/',
  [
    authorize('doctor', 'admin'),
    [
      check('patient', 'Patient ID is required').not().isEmpty(),
      check('medications', 'At least one medication is required').isArray({ min: 1 })
    ]
  ],
  async (req, res) => {
    try {
      const prescriptionData = {
        ...req.body,
        doctor: req.user.id
      };

      const prescription = new Prescription(prescriptionData);
      await prescription.save();

      // Smart Hospital State Machine (Concurrency Controller)
      // Execute Pharmacy, Billing, and Lab tasks concurrently
      const concurrentTasks = [];

      // 1. Pharmacy Module: Check and deduct stock
      if (prescription.medications && prescription.medications.length > 0) {
        const pharmacyTask = async () => {
          for (const med of prescription.medications) {
            // med could be { name, dosage, frequency, duration }
            // Let's assume we try to match by name or med.medicine reference.
            const medicineDoc = await Medicine.findOne({ name: new RegExp('^' + med.name + '$', 'i') });
            if (medicineDoc && medicineDoc.stockQuantity > 0) {
              medicineDoc.stockQuantity -= 1; // Simplify: just decrement by 1 for now or quantity if specified
              await medicineDoc.save();
            }
          }
        };
        concurrentTasks.push(pharmacyTask());
      }

      // 2. Billing Module: Pre-calculate invoice
      const billingTask = async () => {
        const draftBill = new Billing({
          patientId: prescription.patient,
          type: 'pharmacy',
          amount: 50, // Standard draft amount or calculate based on meds
          status: 'pending',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
        await draftBill.save();
      };
      concurrentTasks.push(billingTask());

      // 3. Lab Module: Schedule follow-up tests if chronic patterns are detected
      const labTask = async () => {
        // Simple heuristic: if 'chronic' or specific symptoms are in notes
        const textToAnalyze = (prescription.notes || '').toLowerCase();
        if (textToAnalyze.includes('chronic') || textToAnalyze.includes('diabetes') || textToAnalyze.includes('hypertension')) {
          const test = new LabTest({
            patient: prescription.patient,
            doctor: req.user.id,
            testName: 'Comprehensive Metabolic Panel (Follow-up)',
            testType: 'blood',
            status: 'ordered',
            notes: 'Auto-scheduled based on chronic symptoms indicated in prescription.'
          });
          await test.save();
        }
      };
      concurrentTasks.push(labTask());

      // Run all concurrently
      await Promise.allSettled(concurrentTasks);

      await prescription.populate('patient', 'name email phone');
      await prescription.populate('doctor', 'name specialization');

      res.status(201).json(prescription);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: 'Server Error' });
    }
  }
);

// @route   GET /api/prescriptions/me
// @desc    Get current user's prescriptions
// @access  Private
router.get('/me', async (req, res) => {
  try {
    let prescriptions;

    if (req.user.role === 'patient') {
      prescriptions = await Prescription.find({ patient: req.user.id })
        .populate('doctor', 'name specialization')
        .populate('appointment', 'date')
        .sort({ issuedDate: -1 });
    } else if (req.user.role === 'doctor') {
      prescriptions = await Prescription.find({ doctor: req.user.id })
        .populate('patient', 'name email phone')
        .populate('appointment', 'date')
        .sort({ issuedDate: -1 });
    } else {
      return res.status(400).json({ message: 'Invalid role' });
    }

    res.json(prescriptions);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/prescriptions/patient/:patientId
// @desc    Get all prescriptions for a patient
// @access  Private
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    if (req.user.role !== 'admin' && req.user.role !== 'doctor' && req.user.id !== patientId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const prescriptions = await Prescription.find({ patient: patientId })
      .populate('doctor', 'name specialization')
      .populate('appointment', 'date')
      .sort({ issuedDate: -1 });

    res.json(prescriptions);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/prescriptions/:id
// @desc    Get single prescription
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('patient', 'name email phone')
      .populate('doctor', 'name specialization')
      .populate('appointment', 'date');

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (req.user.role !== 'admin' && 
        req.user.role !== 'doctor' && 
        prescription.patient._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(prescription);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Prescription not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PUT /api/prescriptions/:id
// @desc    Update prescription
// @access  Private (Doctor or Admin only)
router.put('/:id', [authorize('doctor', 'admin')], async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (req.user.role !== 'admin' && prescription.doctor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updatedPrescription = await Prescription.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate('patient', 'name email phone')
      .populate('doctor', 'name specialization');

    res.json(updatedPrescription);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Prescription not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
