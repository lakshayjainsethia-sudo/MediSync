const Medicine = require('../models/Medicine');
const ApiError = require('../utils/ApiError');

/**
 * @desc    Add a new medicine to inventory
 * @route   POST /api/pharmacist/medicine
 * @access  Private (Pharmacist, Admin)
 */
exports.addMedicine = async (req, res, next) => {
  try {
    const { name, price, stockQuantity, category, expiryDate } = req.body;

    const medicine = await Medicine.create({
      name,
      price,
      stockQuantity,
      category,
      expiryDate
    });

    res.status(201).json({
      success: true,
      data: medicine
    });
  } catch (error) {
    next(new ApiError(400, error.message));
  }
};

/**
 * @desc    Update medicine stock
 * @route   PUT /api/pharmacist/medicine/:id
 * @access  Private (Pharmacist, Admin)
 */
exports.updateMedicineStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stockQuantity } = req.body;

    const medicine = await Medicine.findByIdAndUpdate(
      id,
      { stockQuantity },
      { new: true, runValidators: true }
    );

    if (!medicine) {
      return next(new ApiError(404, 'Medicine not found'));
    }

    res.status(200).json({
      success: true,
      data: medicine
    });
  } catch (error) {
    next(new ApiError(400, error.message));
  }
};

/**
 * @desc    Get all medicines in inventory
 * @route   GET /api/pharmacist/medicine
 * @access  Private (Pharmacist, Admin, Doctor)
 */
exports.getAllMedicines = async (req, res, next) => {
  try {
    const medicines = await Medicine.find().sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: medicines.length,
      data: medicines
    });
  } catch (error) {
    next(new ApiError(400, error.message));
  }
};

/**
 * @desc    Search medicines by name or category
 * @route   GET /api/pharmacist/medicine/search
 * @access  Private
 */
exports.searchMedicines = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(200).json({ success: true, data: [] });
    }
    
    const medicines = await Medicine.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } }
      ]
    }).limit(20).sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: medicines
    });
  } catch (error) {
    next(new ApiError(400, error.message));
  }
};

const Appointment = require('../models/Appointment');
const Equipment = require('../models/Equipment');
const { logAudit } = require('../utils/auditLogger');

exports.getOverview = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const pendingDispenseQuery = Appointment.countDocuments({
      status: { $in: ['Billing_Pending', 'Completed'] },
      prescription: { $exists: true, $ne: '' },
      dispensed: { $ne: true }
    });

    const dispensedTodayQuery = Appointment.countDocuments({
      dispensed: true,
      dispensedAt: { $gte: today }
    });

    const lowStockCountQuery = Medicine.countDocuments({
      stockQuantity: { $lt: 50 } 
    });

    const maintenanceAlertsQuery = Equipment.countDocuments({
      $or: [
        { status: 'Maintenance' },
        { nextMaintenanceDate: { $lte: sevenDaysFromNow } }
      ]
    });

    const [pendingDispense, dispensedToday, lowStockCount, maintenanceAlerts] = await Promise.all([
      pendingDispenseQuery,
      dispensedTodayQuery,
      lowStockCountQuery,
      maintenanceAlertsQuery
    ]);

    res.json({
      pendingDispense,
      dispensedToday,
      lowStockCount,
      maintenanceAlerts
    });
  } catch (error) {
    next(new ApiError(400, error.message));
  }
};

exports.dispensePrescription = async (req, res, next) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const appointmentId = req.params.appointmentId;
    const { medicinesToDispense = [] } = req.body;
    
    let appointment = await Appointment.findById(appointmentId).populate('patient', 'name').session(session);
    if (!appointment) {
      throw new ApiError(404, 'Appointment not found');
    }

    if (appointment.dispensed) {
      throw new ApiError(400, 'Prescription already dispensed');
    }

    const io = req.app.get('io');

    // Process each medicine deduction
    for (const item of medicinesToDispense) {
      const { medicineId, quantity } = item;
      
      const updatedMedicine = await Medicine.findOneAndUpdate(
        { _id: medicineId, stockQuantity: { $gte: quantity } },
        { $inc: { stockQuantity: -quantity } },
        { new: true, session }
      );

      if (!updatedMedicine) {
        throw new ApiError(400, `Insufficient stock for medicine ID: ${medicineId}`);
      }

      // Check threshold for low stock alert
      if (updatedMedicine.stockQuantity <= updatedMedicine.minimumThreshold) {
        if (io) {
          io.to('admins').emit('low_stock_alert', {
            medicineId: updatedMedicine._id,
            name: updatedMedicine.name,
            currentStock: updatedMedicine.stockQuantity,
            threshold: updatedMedicine.minimumThreshold
          });
        }
      }
    }

    appointment.dispensed = true;
    appointment.dispensedAt = Date.now();
    appointment.dispensedBy = req.user.id;

    await appointment.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Emit Socket.io event to doctors room
    if (io) {
      io.to('doctors').emit('prescription_dispensed', {
        appointmentId,
        patientName: appointment.patient ? appointment.patient.name : 'Unknown Patient',
        dispensedAt: appointment.dispensedAt
      });
    }

    // Log audit
    await logAudit('PRESCRIPTION_DISPENSED', req, appointmentId, 'Appointment', {
      dispensedBy: req.user.id,
      items: medicinesToDispense.length
    });

    res.json(appointment);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error instanceof ApiError ? error : new ApiError(400, error.message));
  }
};

exports.getPendingPrescriptions = async (req, res, next) => {
  try {
    const pendingAppointments = await Appointment.find({
      status: { $in: ['Billing_Pending', 'Completed'] },
      prescription: { $exists: true, $ne: '' },
      dispensed: { $ne: true }
    })
    .populate('patient', 'name')
    .populate('doctor', 'name')
    .sort({ date: 1, startTime: 1 });

    res.json(pendingAppointments);
  } catch (error) {
    next(new ApiError(400, error.message));
  }
};

exports.getLowStockMedicines = async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold) || 50;
    const lowStockMedicines = await Medicine.find({
      stockQuantity: { $lt: threshold }
    }).sort({ stockQuantity: 1 });

    res.json(lowStockMedicines);
  } catch (error) {
    next(new ApiError(400, error.message));
  }
};
