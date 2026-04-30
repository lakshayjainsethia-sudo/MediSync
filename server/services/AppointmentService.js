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
  async createAppointment({ doctorId, patientId, appointmentDate, timeSlot }) {
    
    // 1. Conflict Detection Logic:
    // Check if the doctor already has an appointment within the same specific time slot and date.
    // Assuming timeSlot is standard (e.g. '10:00-10:30') or appointmentDate incorporates the precise Date/Time.
    
    // Using a precise 30-minute interval check if date is an ISO string. Let's assume exact match requirement for the string slot for simplicity,
    // or a bounded $gte / $lte check on Date objects. Here we use an exact match on timeSlot and Doctor as an example.
    const conflictingAppointment = await Appointment.findOne({
      doctorId,
      appointmentDate: new Date(appointmentDate).setHours(0, 0, 0, 0), // Base Date
      timeSlot, // e.g., "14:00 - 14:30"
      status: { $nin: ['Cancelled'] } // Only active appointments cause conflicts
    });

    if (conflictingAppointment) {
        // Throw our custom ApiError, which will be caught by asyncHandler
        throw new ApiError(409, 'Scheduling conflict: The doctor already has an appointment in this 30-minute time slot.');
    }

    // 2. Additional Business Logic (e.g. Doctor exists, Patient exists) goes here...

    // 3. Database Interaction (Repository phase)
    const newAppointment = await Appointment.create({
      doctorId,
      patientId,
      appointmentDate,
      timeSlot,
      status: 'Scheduled'
    });

    return newAppointment;
  }
}

module.exports = new AppointmentService();
