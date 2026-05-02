const express = require('express');
const router = express.Router();
const Equipment = require('../models/Equipment');
const { protect, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');

// @route   GET /api/equipment
// @desc    Get all equipment
// @access  Protected (admin, pharmacist)
router.get('/', protect, authorize('admin', 'pharmacist'), async (req, res) => {
  try {
    const { unit, status, department } = req.query;
    let query = {};
    if (unit) query.unit = unit;
    if (status) query.status = status;
    if (department) query.assignedDepartment = department;

    // Admin has full access. Pharmacist has read-only, but exclude createdBy.
    let equipmentPromise = Equipment.find(query);
    if (req.user.role === 'pharmacist') {
      equipmentPromise = equipmentPromise.select('-createdBy');
    }

    const equipment = await equipmentPromise;
    res.json(equipment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/equipment/:id
// @desc    Get equipment by ID
// @access  Protected (admin, pharmacist)
router.get('/:id', protect, authorize('admin', 'pharmacist'), async (req, res) => {
  try {
    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ message: 'Equipment not found' });
    }
    
    // Pharmacist read-only, remove createdBy. Since we can't easily deselect after findById if we didn't chain, we'll just not return it.
    let equipObj = equipment.toObject();
    if (req.user.role === 'pharmacist') {
      delete equipObj.createdBy;
    }

    res.json(equipObj);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/equipment
// @desc    Create equipment
// @access  Protected (admin)
router.post('/', protect, authorize('admin', 'pharmacist'), async (req, res) => {
  try {
    const newEquipment = new Equipment({
      ...req.body,
      createdBy: req.user.id
    });

    const equipment = await newEquipment.save();

    await logAudit('EQUIPMENT_CREATED', req, equipment._id, 'Equipment', { 
      name: equipment.name, 
      serialNumber: equipment.serialNumber, 
      unit: equipment.unit 
    });

    res.status(201).json(equipment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/equipment/:id
// @desc    Update equipment
// @access  Protected (admin)
router.patch('/:id', protect, authorize('admin', 'pharmacist'), async (req, res) => {
  try {
    let equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ message: 'Equipment not found' });
    }

    const prevStatus = equipment.status;
    const { status, nextMaintenanceDate } = req.body;

    equipment = await Equipment.findByIdAndUpdate(req.params.id, req.body, { new: true });

    // Emit Socket.io if status changed to Maintenance
    if (status && status === 'Maintenance' && prevStatus !== 'Maintenance') {
      const io = req.app.get('io');
      if (io) {
        io.to('pharmacists').emit('equipment_maintenance_alert', {
          equipmentId: equipment._id,
          name: equipment.name,
          unit: equipment.unit,
          nextMaintenanceDate: equipment.nextMaintenanceDate
        });
      }
    }

    await logAudit('EQUIPMENT_UPDATED', req, equipment._id, 'Equipment', { changes: req.body });

    res.json(equipment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/equipment/:id/maintenance-log
// @desc    Add maintenance log
// @access  Protected (admin)
router.post('/:id/maintenance-log', protect, authorize('admin', 'pharmacist'), async (req, res) => {
  try {
    const { technician, notes, hoursOperated, issueFound, resolvedAt, date } = req.body;
    const logDate = date || Date.now();

    const equipment = await Equipment.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          maintenanceLogs: {
            date: logDate,
            technician,
            notes,
            hoursOperated,
            issueFound,
            resolvedAt
          }
        },
        lastMaintenanceDate: logDate
      },
      { new: true }
    );

    if (!equipment) {
      return res.status(404).json({ message: 'Equipment not found' });
    }

    await logAudit('MAINTENANCE_LOG_ADDED', req, equipment._id, 'Equipment', { 
      notes, 
      hoursOperated 
    });

    res.json(equipment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
