const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');

/**
 * Service layer for Appointments.
 * Handles all business logic, validation logic, and direct database interaction.
 */
class AppointmentService {
  /**
   * Creates a new appointment with conflict detection.
   * 
   * @param {Object} data - Contains doctorId, patientId, appointmentDate, timeSlot
   * @returns {Object} - The saved appointment document
   * @throws {ApiError} - Throws a 409 error if a scheduling conflict is detected
   */
  async createAppointment({ doctorId, patientId, appointmentDate, timeSlot, symptoms, notes, priority, tokenNumber }, session) {
    
    // 1. Conflict Detection Logic:
    const conflictingAppointment = await Appointment.findOne({
      doctorId,
      appointmentDate: new Date(appointmentDate).setHours(0, 0, 0, 0), // Base Date
      timeSlot, // e.g., "14:00 - 14:30"
      status: { $nin: ['Cancelled'] } // Only active appointments cause conflicts
    }).session(session);

    if (conflictingAppointment) {
        throw new ApiError(409, 'Scheduling conflict: The doctor already has an appointment in this time slot.');
    }

    // 3. Database Interaction (Repository phase)
    const newAppointment = await Appointment.create([{
      doctorId,
      patientId,
      appointmentDate,
      timeSlot,
      symptoms,
      notes,
      priority,
      tokenNumber,
      status: 'Scheduled'
    }], { session });

    return newAppointment[0];
  }
}

module.exports = new AppointmentService();
