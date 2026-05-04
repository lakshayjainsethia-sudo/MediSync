const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Billing = require('../models/Billing');
const adminController = require('../controllers/adminController');

const bcrypt = require('bcryptjs');

// @route   POST /api/admin/setup
// @desc    Create the first Super Admin (Master Key protected)
// @access  Public (Secured by MASTER_KEY)
router.post('/setup', async (req, res) => {
  try {
    const { name, email, password, masterKey } = req.body;

    // Validate master key from env or default fallback
    const validMasterKey = process.env.MASTER_KEY || 'medisync-elite-2026';
    if (masterKey !== validMasterKey) {
      return res.status(403).json({ message: 'Invalid Master Key' });
    }

    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists with this email' });
    }

    const admin = new User({
      name,
      email,
      password,
      role: 'admin',
      isApproved: true,
      isVerified: true
    });

    await admin.save();
    
    // Explicitly do not return the token here, force them to login normally
    res.status(201).json({ message: 'Super Admin created successfully. Please login.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error during Admin setup');
  }
});

// Middleware to ensure only admins can access these routes
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/doctors/pending
// @desc    Get all pending doctor approvals
// @access  Private (Admin only)
router.get('/doctors/pending', async (req, res) => {
  try {
    const doctors = await User.find({ 
      role: 'doctor',
      isApproved: false 
    }).select('-password -refreshToken');
    
    res.json(doctors);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

const STAFF_APPROVABLE_ROLES = ['doctor', 'nurse', 'receptionist', 'pharmacist'];

async function approveUserById(userId) {
  const user = await User.findById(userId).select('-password -refreshToken');

  if (!user) {
    return { status: 404, message: 'User not found' };
  }

  if (!STAFF_APPROVABLE_ROLES.includes(user.role)) {
    return { status: 400, message: 'Only staff members require approval' };
  }

  if (user.isApproved) {
    return { status: 200, user, message: 'User already approved' };
  }

  user.isApproved = true;
  await user.save();
  return { status: 200, user, message: 'User approved successfully' };
}

// @route   PUT /api/admin/doctors/:id/approve
// @desc    Approve a doctor (legacy route)
// @access  Private (Admin only)
router.put('/doctors/:id/approve', async (req, res) => {
  try {
    const result = await approveUserById(req.params.id);
    if (!result.user) {
      return res.status(result.status).json({ message: result.message });
    }
    res.json({ message: result.message, user: result.user });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/admin/users/:id/approve
// @desc    Approve a staff member (doctor, nurse, receptionist, pharmacist)
// @access  Private (Admin only)
router.put('/users/:id/approve', async (req, res) => {
  try {
    const result = await approveUserById(req.params.id);
    if (!result.user) {
      return res.status(result.status).json({ message: result.message });
    }
    res.json({ message: result.message, user: result.user });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/admin/doctors/:id
// @desc    Update a doctor (e.g. consultation fee)
// @access  Private (Admin only)
router.patch('/doctors/:id', async (req, res) => {
  try {
    const { consultationFee } = req.body;
    const updateFields = {};
    if (consultationFee !== undefined) updateFields.consultationFee = Number(consultationFee);

    const doctor = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'doctor' },
      { $set: updateFields },
      { new: true }
    ).select('-password -refreshToken');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    res.json(doctor);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/admin/doctors/:id
// @desc    Delete a doctor
// @access  Private (Admin only)
router.delete('/doctors/:id', async (req, res) => {
  try {
    const doctor = await User.findByIdAndDelete(req.params.id);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Also delete all appointments associated with this doctor
    await Appointment.deleteMany({ doctor: req.params.id });

    res.json({ message: 'Doctor and associated appointments removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    res.status(500).send('Server Error');
  }
});



// @route   GET /api/admin/users
// @desc    Get all users (patients and doctors) with pagination
// @access  Private (Admin only)
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Default limit 50 for backward compatibility
    const skip = (page - 1) * limit;

    const managedRoles = ['patient', 'doctor', 'nurse', 'receptionist', 'pharmacist'];
    const query = { role: { $in: managedRoles } };

    const users = await User.find(query)
      .select('-password -refreshToken')
      .sort({ role: 1, name: 1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(query);
    const hasMore = skip + users.length < total;
    
    res.json({
      users,
      total,
      hasMore,
      page,
      limit
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete a user (patient or doctor)
// @access  Private (Admin only)
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // If user is a doctor, delete their appointments
    if (user.role === 'doctor') {
      await Appointment.deleteMany({ doctor: req.params.id });
    } else {
      // If user is a patient, delete their appointments
      await Appointment.deleteMany({ patient: req.params.id });
    }
    
    // Delete the user
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'User and associated data removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).send('Server Error');
  }
});

// ==========================================
// ITERATION 4 - ADMIN ANALYTICS ROUTES
// ==========================================

// @route   GET /api/admin/analytics
// @desc    Unified Aggregation Pipeline for Analytics Dashboard
// @access  Private (Admin only)
router.get('/analytics', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const [
      totalPatients,
      totalDoctors,
      totalAppointments,
      todaysAppointmentsCount,
      pendingApprovals,
      revenueResult,
      statusDist,
      trendDist,
      triageDist
    ] = await Promise.all([
      User.countDocuments({ role: 'patient' }),
      User.countDocuments({ role: 'doctor', isApproved: true }),
      Appointment.countDocuments(),
      Appointment.countDocuments({ date: { $gte: today } }),
      User.countDocuments({ role: { $in: ['doctor', 'nurse', 'receptionist', 'pharmacist'] }, isApproved: false }),
      Billing.aggregate([
        { $match: { status: 'Paid', createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Appointment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Appointment.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Appointment.aggregate([
        { $group: { _id: { $ifNull: ['$aiPriority', 'Normal'] }, count: { $sum: 1 } } }
      ])
    ]);

    const revenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    res.json({
      totalPatients,
      totalDoctors,
      totalAppointments,
      todaysAppointments: todaysAppointmentsCount,
      pendingApprovals,
      revenue,
      appointmentsByStatus: statusDist,
      appointmentsByDay: trendDist,
      triageDistribution: triageDist
    });
  } catch (err) {
    console.error('Analytics Endpoint Error:', err.message);
    res.status(500).json({ message: 'Server Error fetching analytics' });
  }
});

// @route   GET /api/admin/dashboard-stats
// @desc    Unified Aggregation Pipeline for Command Center Dashboard
// @access  Private (Admin only)
router.get('/dashboard-stats', adminController.getDashboardStats);

// @route   GET /api/admin/analytics/overview
// @desc    Get dashboard KPI numbers
// @access  Private (Admin only)
router.get('/analytics/overview', async (req, res) => {
  try {
    const today = new Date();
    // Using Asia/Kolkata timezone
    const todayStart = new Date(today.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    todayEnd.setHours(23, 59, 59, 999);

    const [
      totalPatients,
      totalAppointments,
      appointmentsToday,
      highPriorityToday,
      appointmentsStats,
      revenueStats
    ] = await Promise.all([
      User.countDocuments({ role: 'patient' }),
      Appointment.countDocuments(),
      Appointment.countDocuments({ date: { $gte: todayStart, $lte: todayEnd } }),
      Appointment.countDocuments({ aiPriority: 'High', date: { $gte: todayStart, $lte: todayEnd } }),
      Appointment.aggregate([
        { $group: { _id: null, avgAiConfidence: { $avg: '$aiConfidence' } } }
      ]),
      Billing.aggregate([
        { $match: { status: 'Paid' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
      ])
    ]);

    const avgAiConfidence = appointmentsStats.length > 0 ? appointmentsStats[0].avgAiConfidence : 0;
    const totalRevenue = revenueStats.length > 0 ? revenueStats[0].totalRevenue : 0;

    res.json({
      totalPatients,
      totalAppointments,
      totalRevenue,
      highPriorityToday,
      appointmentsToday,
      avgAiConfidence: Math.round(avgAiConfidence)
    });
  } catch (err) {
    console.error('Analytics Overview Error:', err.message);
    res.status(500).json({ message: 'Server Error fetching analytics overview' });
  }
});

// @route   GET /api/admin/analytics/appointments-trend
// @desc    Get appointments trend over time
// @access  Private (Admin only)
router.get('/analytics/appointments-trend', async (req, res) => {
  try {
    const { range = '7d' } = req.query;
    const days = parseInt(range) || 7;
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - days);

    const trend = await Appointment.aggregate([
      { $match: { createdAt: { $gte: pastDate } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Kolkata"
            }
          },
          count: { $sum: 1 },
          highPriority: {
            $sum: { $cond: [{ $eq: ["$aiPriority", "High"] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", count: 1, highPriority: 1 } }
    ]);

    res.json(trend);
  } catch (err) {
    console.error('Appointments Trend Error:', err.message);
    res.status(500).json({ message: 'Server Error fetching appointments trend' });
  }
});

// @route   GET /api/admin/analytics/department-distribution
// @desc    Get distribution by department
// @access  Private (Admin only)
router.get('/analytics/department-distribution', async (req, res) => {
  try {
    const dist = await Appointment.aggregate([
      { $match: { aiSuggestedDept: { $exists: true, $ne: "" } } },
      {
        $group: {
          _id: "$aiSuggestedDept",
          count: { $sum: 1 },
          avgConfidence: { $avg: "$aiConfidence" }
        }
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { count: -1 } },
      {
        $project: {
          _id: 0,
          department: "$_id",
          count: 1,
          avgConfidence: { $round: ["$avgConfidence", 0] }
        }
      }
    ]);

    res.json(dist);
  } catch (err) {
    console.error('Department Dist Error:', err.message);
    res.status(500).json({ message: 'Server Error fetching department distribution' });
  }
});

// @route   GET /api/admin/analytics/revenue-trend
// @desc    Get revenue trend over time
// @access  Private (Admin only)
router.get('/analytics/revenue-trend', async (req, res) => {
  try {
    const { range = '7d' } = req.query;
    const days = parseInt(range) || 7;
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - days);

    const trend = await Billing.aggregate([
      { $match: { createdAt: { $gte: pastDate } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Kolkata"
            }
          },
          revenue: {
            $sum: { $cond: [{ $eq: ["$status", "Paid"] }, "$totalAmount", 0] }
          },
          unpaid: {
            $sum: { $cond: [{ $eq: ["$status", "Unpaid"] }, "$totalAmount", 0] }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", revenue: 1, unpaid: 1 } }
    ]);

    res.json(trend);
  } catch (err) {
    console.error('Revenue Trend Error:', err.message);
    res.status(500).json({ message: 'Server Error fetching revenue trend' });
  }
});

// @route   GET /api/admin/analytics/risk-distribution
// @desc    Get distribution of risks including manual overrides
// @access  Private (Admin only)
router.get('/analytics/risk-distribution', async (req, res) => {
  try {
    const stats = await Appointment.aggregate([
      {
        $group: {
          _id: null,
          high: { $sum: { $cond: [{ $eq: ["$aiPriority", "High"] }, 1, 0] } },
          medium: { $sum: { $cond: [{ $eq: ["$aiPriority", "Medium"] }, 1, 0] } },
          low: { $sum: { $cond: [{ $eq: ["$aiPriority", "Low"] }, 1, 0] } },
          manualHighRisk: { $sum: { $cond: [{ $eq: ["$riskOverride", true] }, 1, 0] } }
        }
      },
      { $project: { _id: 0 } }
    ]);

    const result = stats.length > 0 ? stats[0] : { high: 0, medium: 0, low: 0, manualHighRisk: 0 };
    res.json(result);
  } catch (err) {
    console.error('Risk Dist Error:', err.message);
    res.status(500).json({ message: 'Server Error fetching risk distribution' });
  }
});

// @route   GET /api/admin/audit-logs
// @desc    Get all audit logs with pagination and filters
// @access  Private (Admin only)
router.get('/audit-logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;

    let query = {};
    if (req.query.role) query.role = req.query.role;
    if (req.query.action) query.action = req.query.action;

    const AuditLog = require('../models/AuditLog');
    const logs = await AuditLog.find(query)
      .populate('performedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AuditLog.countDocuments(query);
    const hasMore = skip + logs.length < total;

    res.json({ logs, total, hasMore, page, limit });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
