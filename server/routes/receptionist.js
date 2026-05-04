const express = require('express');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roleCheck');
const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');

const router = express.Router();

router.use(protect);

// @route   GET /api/receptionist/billing-queue
// @desc    Get all appointments ready for final billing
// @access  Receptionist/Admin
router.get('/billing-queue', authorizeRoles('Receptionist', 'Admin'), async (req, res, next) => {
  try {
    const queue = await Appointment.find({
      status: 'Billing_Pending',
      'medicineBill.sentToReceptionist': true
    })
    .populate('patient', 'name age email')
    .populate('doctor', 'name specialization consultationFee')
    .populate('medicineBill.items.medicineId', 'name price')
    .sort({ createdAt: 1 });

    res.json(queue);
  } catch (error) {
    next(new ApiError(400, error.message));
  }
});

module.exports = router;
