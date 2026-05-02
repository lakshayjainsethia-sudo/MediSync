const asyncHandler = require('../utils/asyncHandler');
const AppointmentService = require('../services/AppointmentService');
const mongoose = require('mongoose');
const aiService = require('../services/aiService');

/**
 * Controller layer for Appointments.
 * Responsible only for extracting data from the HTTP request, forwarding it to the Service layer,
 * and returning a standardized JSON response.
 */
class AppointmentController {
  
  /**
   * Book a new appointment.
   * Expects validation via express-validator to be handled in a prior middleware.
   */
  bookAppointment = asyncHandler(async (req, res) => {
    let { doctorId, patientId, appointmentDate, timeSlot, symptoms, notes, priority } = req.body;
    
    // 1. AI-Driven Symptom-to-Specialist Mapping
    let aiTriage = null;
    if (symptoms) {
      aiTriage = await aiService.analyzeSymptoms(symptoms);
      // Determine priority based on AI
      if (aiTriage.aiPriority === 'High') priority = 1;
      else if (aiTriage.aiPriority === 'Medium' && !priority) priority = 2;
    }

    const effectivePriority = priority || 3;
    const prefix = effectivePriority <= 2 ? 'EM-' : 'OP-';
    const tokenCounter = Math.floor(100 + Math.random() * 900); 
    const tokenNumber = `${prefix}${tokenCounter}`;

    let newAppointment;

    // 2. Mongoose Transaction for atomic slot booking
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      newAppointment = await AppointmentService.createAppointment({
        doctorId,
        patientId, // Should use req.user.id in production if patient is authenticated
        appointmentDate,
        timeSlot,
        symptoms,
        notes,
        priority: effectivePriority,
        tokenNumber
      }, session);
      
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    // 3. Trigger Emergency Alert via WebSockets if AI detected high priority
    if (aiTriage && aiTriage.aiPriority === 'High') {
      const io = req.app.get('io');
      if (io) {
        io.emit('emergency_alert', {
          message: `Emergency Alert: Patient presenting with ${aiTriage.aiRedFlags.join(', ')}`,
          patientId,
          suggestedDept: aiTriage.aiSuggestedDept,
          confidence: aiTriage.aiConfidence,
          reasoning: aiTriage.aiReasoning,
          tokenNumber
        });
      }
    }
    
    // Standardized response format
    res.status(201).json({
      success: true,
      data: {
        appointment: newAppointment,
        aiTriage
      },
      message: 'Appointment successfully booked'
    });
  });

  // Additional controller methods (getAppointments, cancelAppointment, etc.) would go here.
}

module.exports = new AppointmentController();
