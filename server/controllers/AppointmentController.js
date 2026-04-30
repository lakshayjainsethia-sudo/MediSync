const asyncHandler = require('../utils/asyncHandler');
const AppointmentService = require('../services/AppointmentService');

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
    const { doctorId, patientId, appointmentDate, timeSlot, symptoms, notes, priority } = req.body;
    
    // Assign token logic
    // Assuming 'priority' is available from req.body or determined otherwise
    // For this example, we'll default priority if not provided, or assume it's always present.
    // If priority is not in req.body, you'd need to define it or handle its absence.
    const effectivePriority = priority || 3; // Default to 3 if not provided
    const prefix = effectivePriority <= 2 ? 'EM-' : 'OP-';
    // Very simple token generation for demo; preferably use a sequence or daily counter
    const tokenCounter = Math.floor(100 + Math.random() * 900); 
    const tokenNumber = `${prefix}${tokenCounter}`;

    // Delegate to the service layer for business logic
    const newAppointment = await AppointmentService.createAppointment({
      doctorId,
      patientId, // This might be replaced by req.user.id if patient is authenticated
      appointmentDate,
      timeSlot,
      symptoms,
      notes,
      priority: effectivePriority,
      tokenNumber, // Add the generated token number
      status: 'scheduled' // Default status
    });
    
    // Standardized response format
    res.status(201).json({
      success: true,
      data: newAppointment,
      message: 'Appointment successfully booked'
    });
  });

  // Additional controller methods (getAppointments, cancelAppointment, etc.) would go here.
}

module.exports = new AppointmentController();
