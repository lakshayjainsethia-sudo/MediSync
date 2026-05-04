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

      const sanitizePaymentMethod = (method) => {
        if (!method) return method;
        const lower = method.toLowerCase();
        if (lower === 'upi') return 'online';
        if (['cash', 'card', 'insurance', 'online', 'other'].includes(lower)) return lower;
        return 'other';
      };

      const billData = {
        ...req.body,
        patientId: apt.patient,
        patient: apt.patient,
        doctor: apt.doctor,
        createdBy: req.user.id,
        lineItems,
        items: itemsLegacy,
        subTotal,
        totalAmount,
        paymentMethod: req.body.paymentMethod ? sanitizePaymentMethod(req.body.paymentMethod) : undefined
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

// @route   POST /api/billing/generate-final
// @desc    Generate final bill from appointment
// @access  Private (Admin, Receptionist)
router.post('/generate-final', [authorize('admin', 'receptionist')], async (req, res) => {
  try {
    const { appointmentId, additionalCharges = [] } = req.body;

    const appointment = await Appointment.findById(appointmentId).populate('doctor');

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.status !== 'Billing_Pending') {
      throw new Error('Appointment is not pending for billing');
    }

    if (!appointment.medicineBill?.sentToReceptionist) {
      throw new Error('Medicine bill not yet sent to receptionist');
    }

    if (appointment.finalBillId) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(400).json({ message: 'Bill already generated.' });
    }

    // Populate doctor manually if assignedDoctor doesn't work (fallback to doctor)
    const doctorId = appointment.doctor || appointment.assignedDoctor;
    const DoctorModel = require('../models/User'); // Consultation fee is on User profile
    const doctor = await DoctorModel.findById(doctorId);

    const doctorName = doctor ? doctor.name : 'Unknown Doctor';
    const doctorSpecialization = doctor?.specialization || 'General';
    const consultationFee = doctor?.consultationFee || 0;

    const lineItems = [];
    
    // a. First item always: Consultation Fee
    lineItems.push({
      description: `Consultation Fee — Dr. ${doctorName} (${doctorSpecialization})`,
      quantity: 1,
      unitPrice: consultationFee,
      total: consultationFee
    });

    // b. If billingType === 'WithMedicines'
    if (appointment.billingType === 'WithMedicines' && appointment.medicineBill?.items) {
      for (const item of appointment.medicineBill.items) {
        lineItems.push({
          description: item.medicineName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total
        });
      }
    }

    // c. If additionalCharges exists (validated per user feedback)
    const validAdditionalCharges = additionalCharges.filter(c => c.description?.trim() && Number(c.amount) > 0);
    for (const charge of validAdditionalCharges) {
      const amount = Number(charge.amount);
      lineItems.push({
        description: charge.description.trim(),
        quantity: 1,
        unitPrice: amount,
        total: amount
      });
    }

    let subTotal = 0;
    const itemsLegacy = []; // For compatibility with older billing schemas
    
    lineItems.forEach(item => {
      subTotal += item.total;
      itemsLegacy.push({ desc: item.description, price: item.unitPrice, qty: item.quantity });
    });

    const totalAmount = subTotal; // Discounts and taxes can be applied later or by pre-save hooks

    const billData = {
      appointment: appointmentId,
      patientId: appointment.patient,
      patient: appointment.patient,
      doctor: doctorId,
      createdBy: req.user.id,
      lineItems,
      items: itemsLegacy,
      subTotal,
      totalAmount,
      status: 'Unpaid'
      // billNumber is auto-generated by existing pre-save hook
    };

    const newBill = new Billing(billData);
    await newBill.save();

    appointment.status = 'completed';
    appointment.finalBillId = newBill._id;
    await appointment.save();

    const io = req.app.get('io');
    if (io) {
      // Patient might not be populated in appointment, let's fetch name
      const PatientModel = require('../models/User');
      const patient = await PatientModel.findById(appointment.patient);
      
      io.to('receptionists').emit('bill_generated', {
        appointmentId,
        billId: newBill._id,
        billNumber: newBill.invoiceNumber || newBill._id.toString(), // or whatever field the hook generates
        totalAmount,
        patientName: patient ? patient.name : 'Unknown Patient'
      });
    }

    await logAudit('FINAL_BILL_GENERATED', req, newBill._id, 'Billing', {
      appointmentId,
      totalAmount,
      billNumber: newBill.invoiceNumber,
      lineItemCount: lineItems.length
    });

    res.status(201).json({ bill: newBill, appointment });
  } catch (error) {
    console.error('Error generating final bill:', error);
    res.status(500).json({ message: error.message || 'Server Error' });
  }
});

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

    const sanitizePaymentMethod = (method) => {
      if (!method) return method;
      const lower = method.toLowerCase();
      if (lower === 'upi') return 'online';
      if (['cash', 'card', 'insurance', 'online', 'other'].includes(lower)) return lower;
      return 'other';
    };

    if (status === 'Paid') {
      updateFields.paidAt = new Date();
      updateFields.paymentStatus = 'Paid'; // legacy sync
      if (paymentMethod) {
        updateFields.paymentMethod = sanitizePaymentMethod(paymentMethod);
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
