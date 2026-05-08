const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roleCheck');
const { logAudit } = require('../utils/auditLogger');
const mongoose = require('mongoose');

// Protect all routes
router.use(protect);
router.use(authorizeRoles('Pharmacist', 'Admin', 'pharmacist', 'admin'));

// @route   GET /api/medicines
// @desc    Get all medicines with filters, search, pagination
router.get('/', async (req, res) => {
  try {
    const { q, category, stock, page = 1, limit = 20 } = req.query;
    
    let query = {};
    
    if (q) {
      query.name = { $regex: q, $options: 'i' };
    }
    
    if (category && category !== 'All') {
      query.category = category;
    }
    
    // For stock filter, we use an aggregation pipeline to handle sorting and filtering
    // because we need to sort by computed status: OUT first, then LOW, then OK.
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let pipeline = [
      { $match: query },
      {
        $addFields: {
          stockStatusOrder: {
            $switch: {
              branches: [
                { case: { $eq: ['$stockQuantity', 0] }, then: 1 }, // OUT
                { case: { $lte: ['$stockQuantity', '$minimumThreshold'] }, then: 2 } // LOW
              ],
              default: 3 // OK
            }
          }
        }
      }
    ];

    if (stock === 'low') {
      pipeline.push({ $match: { stockStatusOrder: { $in: [1, 2] } } });
    }

    pipeline.push({ $sort: { stockStatusOrder: 1, name: 1 } });
    
    // Facet for pagination
    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }, { $addFields: { page: parseInt(page) } }],
        data: [{ $skip: skip }, { $limit: parseInt(limit) }]
      }
    });

    const result = await Medicine.aggregate(pipeline);
    const data = result[0].data;
    const total = result[0].metadata[0]?.total || 0;

    // We need to map the result back to Mongoose documents to ensure virtuals (like currentStock, stockStatus) are applied
    // Since aggregate returns raw objects, we instantiate them as Mongoose documents.
    const hydratedData = data.map(item => {
      const doc = new Medicine(item);
      doc.isNew = false;
      return doc.toJSON();
    });

    res.json({
      data: hydratedData,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Error fetching medicines:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/medicines/:id
// @desc    Get single medicine
router.get('/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) return res.status(404).json({ message: 'Medicine not found' });
    res.json(medicine);
  } catch (error) {
    console.error('Error fetching medicine:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   POST /api/medicines
// @desc    Add new medicine
router.post('/', authorizeRoles('Admin', 'admin'), async (req, res) => {
  try {
    const newMedicine = new Medicine(req.body);
    const savedMedicine = await newMedicine.save();
    
    await logAudit('MEDICINE_CREATED', req, savedMedicine._id, 'Medicine', { name: savedMedicine.name });
    
    res.status(201).json(savedMedicine);
  } catch (error) {
    console.error('Error adding medicine:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PUT /api/medicines/:id
// @desc    Update existing medicine
router.put('/:id', authorizeRoles('Admin', 'admin', 'Pharmacist', 'pharmacist'), async (req, res) => {
  try {
    const oldMedicine = await Medicine.findById(req.params.id);
    if (!oldMedicine) return res.status(404).json({ message: 'Medicine not found' });

    const medicine = await Medicine.findByIdAndUpdate(req.params.id, req.body, { new: true });

    // Check if stock fell below threshold and trigger alert
    if (req.body.stockQuantity !== undefined && req.body.stockQuantity <= medicine.minimumThreshold && oldMedicine.stockQuantity > medicine.minimumThreshold) {
      // 1. Save alert in DB
      const notification = new Notification({
        recipient: null, // Global or admin specific
        recipientModel: 'User',
        type: 'alert',
        title: 'Low Stock Alert',
        message: `${medicine.name} stock has fallen to ${medicine.stockQuantity}.`,
        link: '/admin/inventory'
      });
      await notification.save();

      // 2. Emit to socket
      const io = req.app.get('io');
      if (io) {
        io.to('admins').emit('low_stock_alert', {
          medicineId: medicine._id,
          medicineName: medicine.name,
          currentStock: medicine.stockQuantity,
          minimumThreshold: medicine.minimumThreshold
        });
      }
    }

    await logAudit('MEDICINE_UPDATED', req, medicine._id, 'Medicine', { changes: req.body });
    
    res.json(medicine);
  } catch (error) {
    console.error('Error updating medicine:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   DELETE /api/medicines/:id
// @desc    Delete medicine
router.delete('/:id', authorizeRoles('Admin', 'admin'), async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndDelete(req.params.id);
    if (!medicine) return res.status(404).json({ message: 'Medicine not found' });
    
    await logAudit('MEDICINE_DELETED', req, req.params.id, 'Medicine', { name: medicine.name });
    
    res.json({ message: 'Medicine removed' });
  } catch (error) {
    console.error('Error deleting medicine:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PATCH /api/medicines/:id/standalone-dispense
// @desc    Dispense medicine without an appointment
router.patch('/:id/standalone-dispense', async (req, res) => {
  const isReplicaSet = mongoose.connection.client?.topology?.s?.description?.type !== 'Single';
  let session = null;
  
  if (isReplicaSet) {
    session = await mongoose.startSession();
    session.startTransaction();
  }
  
  const sessionOpt = session ? { session } : {};

  try {
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      throw new Error('Invalid quantity');
    }

    const medicine = await Medicine.findOneAndUpdate(
      { 
        _id: req.params.id, 
        stockQuantity: { $gte: quantity } // Using stockQuantity as the DB field
      },
      { $inc: { stockQuantity: -quantity } },
      { new: true, ...sessionOpt }
    );

    if (!medicine) {
      if (session) {
        await session.abortTransaction();
      }
      return res.status(400).json({ message: 'Insufficient stock. Refresh and retry.' });
    }

    if (session) {
      await session.commitTransaction();
    }

    if (medicine.stockQuantity <= medicine.minimumThreshold) {
      const io = req.app.get('io');
      if (io) {
        io.to('admins').emit('low_stock_alert', {
          medicineId: medicine._id,
          medicineName: medicine.name,
          currentStock: medicine.stockQuantity,
          minimumThreshold: medicine.minimumThreshold
        });
      }
    }

    await logAudit('STANDALONE_DISPENSE', req, medicine._id, 'Medicine', { 
      quantity: quantity,
      remainingStock: medicine.stockQuantity 
    });

    res.json(medicine);
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    console.error('Error in standalone dispense:', error);
    res.status(500).json({ message: error.message || 'Server Error' });
  } finally {
    if (session) {
      session.endSession();
    }
  }
});

module.exports = router;
