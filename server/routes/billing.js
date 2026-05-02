const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const Billing = require('../models/Billing');
const Appointment = require('../models/Appointment');
const { logAudit } = require('../utils/auditLogger');

router.use(protect);

// @route   POST /api/billing
// @desc    Create a new bill
// @access  Private (Admin, Receptionist)
router.post(
  '/',
  [
    authorize('admin', 'receptionist'),
    [
      check('appointment', 'Appointment ID is required').not().isEmpty(),
      check('lineItems', 'At least one item is required').isArray({ min: 1 })
    ]
  ],
  async (req, res) => {
    try {
      const apt = await Appointment.findById(req.body.appointment);
      if (!apt) return res.status(404).json({ message: 'Appointment not found' });

      // Compute required totals for old schema compatibility & new usage
      let subTotal = 0;
      const itemsLegacy = [];
      const lineItems = req.body.lineItems.map(item => {
        const total = Number((item.quantity * item.unitPrice).toFixed(2));
        subTotal += total;
        // Populate legacy items to satisfy required fields
        itemsLegacy.push({ desc: item.description, price: item.unitPrice, qty: item.quantity });
        return { ...item, total };
      });

      const tax = req.body.tax !== undefined ? req.body.tax : 0;
      const discount = req.body.discount || 0;
      const totalAmount = Number((subTotal - discount + (subTotal * tax / 100)).toFixed(2));

      const billData = {
        ...req.body,
        patientId: apt.patient,
        patient: apt.patient,
        doctor: apt.doctor,
        createdBy: req.user.id,
        lineItems,
        items: itemsLegacy,
        subTotal,
        totalAmount
      };

      const billing = new Billing(billData);
      await billing.save();
      await logAudit('BILL_GENERATED', req, billing._id, 'Billing', { totalAmount });

      await billing.populate('patient', 'name email phone');
      await billing.populate('doctor', 'name specialization');
      await billing.populate('appointment', 'date');

      res.status(201).json(billing);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: 'Server Error' });
    }
  }
);

// @route   GET /api/billing
// @desc    Get all bills directly (with filters)
// @access  Private (Admin, Receptionist)
router.get('/', [authorize('admin', 'receptionist')], async (req, res) => {
  try {
    const { status, patientId, dateFrom, dateTo } = req.query;
    let query = {};
    
    if (status) query.status = status;
    if (patientId) query.patient = patientId;
    if (dateFrom && dateTo) {
      // Must enforce timezone semantics if required, however simple Date object mapping is safe for boundaries.
      query.createdAt = {
        $gte: new Date(dateFrom),
        $lte: new Date(dateTo + 'T23:59:59.999Z')
      };
    }

    const bills = await Billing.find(query)
      .populate('patient', 'name email phone')
      .populate('doctor', 'name specialization')
      .populate('appointment', 'date')
      .sort({ createdAt: -1 });

    res.json(bills);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/billing/me
// @desc    Get current user's bills
// @access  Private
router.get('/me', async (req, res) => {
  try {
    let bills;

    if (req.user.role === 'patient') {
      bills = await Billing.find({ patient: req.user.id })
        .populate('appointment', 'date')
        .sort({ createdAt: -1 });
    } else {
      bills = await Billing.find()
        .populate('patient', 'name email phone')
        .populate('appointment', 'date')
        .sort({ createdAt: -1 });
    }

    res.json(bills);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/billing/patient/:patientId
// @desc    Get all bills for a patient
// @access  Private
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    if (req.user.role !== 'admin' && req.user.role !== 'receptionist' && req.user.id !== patientId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const bills = await Billing.find({ patient: patientId })
      .populate('appointment', 'date')
      .sort({ createdAt: -1 });

    res.json(bills);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/billing/:id
// @desc    Get single bill
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const bill = await Billing.findById(req.params.id)
      .populate('patient', 'name email phone')
      .populate('appointment', 'date');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    if (req.user.role !== 'admin' && 
        req.user.role !== 'receptionist' && 
        bill.patient._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(bill);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Bill not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PATCH /api/billing/:id/status
// @desc    Update bill status
// @access  Private (Admin, Receptionist)
router.patch('/:id/status', [
  authorize('admin', 'receptionist'),
  check('status', 'Status is required').isIn(['Draft', 'Unpaid', 'Paid'])
], async (req, res) => {
  try {
    const { status, paymentMethod } = req.body;
    let updateFields = { status };

    if (status === 'Paid') {
      updateFields.paidAt = new Date();
      updateFields.paymentStatus = 'Paid'; // legacy sync
      if (paymentMethod) {
        updateFields.paymentMethod = paymentMethod;
      }
    }

    const bill = await Billing.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    )
      .populate('patient', 'name email phone')
      .populate('doctor', 'name specialization')
      .populate('appointment', 'date');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    if (status === 'Paid') {
      await logAudit('BILL_PAID', req, bill._id, 'Billing', { paymentMethod, totalAmount: bill.totalAmount });
    }

    res.json(bill);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PATCH /api/billing/:id
// @desc    Edit a draft bill
// @access  Private (Admin, Receptionist)
router.patch('/:id', [authorize('admin', 'receptionist')], async (req, res) => {
  try {
    const bill = await Billing.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    if (bill.status !== 'Draft') {
      return res.status(400).json({ message: 'Only Draft bills can be edited' });
    }

    // Recompute
    if (req.body.lineItems) {
      let subTotal = 0;
      const itemsLegacy = [];
      const lineItems = req.body.lineItems.map(item => {
        const total = Number((item.quantity * item.unitPrice).toFixed(2));
        subTotal += total;
        itemsLegacy.push({ desc: item.description, price: item.unitPrice, qty: item.quantity });
        return { ...item, total };
      });

      const tax = req.body.tax !== undefined ? req.body.tax : bill.tax;
      const discount = req.body.discount !== undefined ? req.body.discount : bill.discount;
      const totalAmount = Number((subTotal - discount + (subTotal * tax / 100)).toFixed(2));

      req.body.subTotal = subTotal;
      req.body.totalAmount = totalAmount;
      req.body.lineItems = lineItems;
      req.body.items = itemsLegacy;
    }

    const updatedBill = await Billing.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    )
      .populate('patient', 'name email phone')
      .populate('doctor', 'name specialization')
      .populate('appointment', 'date');

    res.json(updatedBill);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
