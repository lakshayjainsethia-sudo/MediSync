const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const aiController = require('../controllers/aiController');

// Verification logging requested by the user
console.log('Protect middleware loaded:', typeof protect);
console.log('Authorize middleware loaded:', typeof authorize);

// Apply protection to all AI routes
router.use(protect);

// @route   GET /api/ai/symptom-suggest
// @desc    Get symptom tags matching query prefix via AI
// @access  Private
router.get('/symptom-suggest', authorize('receptionist', 'admin', 'doctor', 'patient'), aiController.suggestSymptoms);

// @route   POST /api/ai/recommend-slot
// @desc    Get 3 best appointment slots
// @access  Private
router.post('/recommend-slot', [
    check('doctorId', 'Doctor ID is required').not().isEmpty(),
    check('symptoms', 'Symptoms are required').not().isEmpty(),
    check('aiPriority', 'AI Priority is required').not().isEmpty()
], authorize('receptionist', 'admin', 'doctor', 'patient'), aiController.recommendSlot);

// @route   POST /api/ai/triage
// @desc    Standalone Get Triage endpoint
// @access  Private
router.post('/triage', authorize('receptionist', 'admin', 'doctor', 'patient'), aiController.getTriage);

// @route   POST /api/ai/billing-suggest
// @desc    Suggest billing line items based on clinical context
// @access  Private (Receptionist, Admin)
router.post('/billing-suggest', authorize('receptionist', 'admin'), aiController.suggestBillingItems);

// @route   POST /api/ai/billing-audit
// @desc    Audit a bill for revenue leakage and optimization using AI
// @access  Private (Receptionist, Admin)
router.post('/billing-audit', authorize('receptionist', 'admin'), aiController.auditBilling);

module.exports = router;
