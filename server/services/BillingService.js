const mongoose = require('mongoose');
const Billing = require('../models/Billing');
const Appointment = require('../models/Appointment');
const Medicine = require('../models/Medicine');
const ApiError = require('../utils/ApiError');

/**
 * Service layer for Billing and Transactions.
 */
class BillingService {
  /**
   * Processes a "Checkout" by marking the bill as 'Paid' and the appointment as 'Completed'.
   * Uses Mongoose Transactions to ensure atomic updates.
   * 
   * @param {String} billingId - ID of the bill being paid
   * @param {String} paymentMethod - Method of payment used
   * @returns {Object} - Updated billing document
   */
  async checkoutAndCompleteAppointment(billingId, paymentMethod) {
    // 1. Start a Mongoose Session for the transaction
    const session = await mongoose.startSession();
    
    try {
      // 2. Start the transaction
      session.startTransaction();

      // Find the billing record
      const bill = await Billing.findById(billingId).session(session);
      if (!bill) {
        throw new ApiError(404, 'Billing record not found');
      }
      if (bill.status === 'Paid') {
        throw new ApiError(400, 'Bill has already been paid');
      }

      // 3. Update Billing Status
      bill.status = 'Paid';
      bill.paymentMethod = paymentMethod;
      bill.paidAt = new Date();
      await bill.save({ session });

      // 4. Update Appointment Status
      const appointmentId = bill.appointmentId;
      const appointment = await Appointment.findById(appointmentId).session(session);
      if (!appointment) {
        throw new ApiError(404, 'Associated appointment not found');
      }

      appointment.status = 'Completed';
      await appointment.save({ session });

      // 5. Commit the transaction if everything succeeded
      await session.commitTransaction();

      return bill;
    } catch (error) {
      // 6. Abort the transaction explicitly if any operation fails
      await session.abortTransaction();
      
      // Re-throw our ApiError or wrap generic mongoose errors
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, 'Transaction failed: ' + error.message);
    } finally {
      // 7. Always end the session
      session.endSession();
    }
  }

  /**
   * Generates a comprehensive bill structure. 
   * Includes medicine costs, consultation fee, and automatically applies 18% GST on the subtotal.
   * 
   * @param {string} patientId - Reference to User
   * @param {Array} medicineItems - Array of { medicineId, quantity }
   * @param {Number} consultationFee - Fee for doctor's consultation
   * @returns {Object} Structured data ready for PDF or Saving
   */
  async generateBill(patientId, medicineItems = [], consultationFee = 0) {
    let subTotal = 0;
    const items = [];

    // Process Consultation
    if (consultationFee > 0) {
      items.push({
        name: 'Consultation Fee',
        qty: 1,
        price: consultationFee
      });
      subTotal += consultationFee;
    }

    // Process Medicines
    for (const reqItem of medicineItems) {
      const medicine = await Medicine.findById(reqItem.medicineId);
      if (!medicine) {
        throw new ApiError(404, `Medicine not found: ${reqItem.medicineId}`);
      }

      const lineTotal = medicine.price * reqItem.quantity;
      items.push({
        name: medicine.name,
        qty: reqItem.quantity,
        price: lineTotal
      });
      subTotal += lineTotal;
    }

    // Tax calculation (18% GST)
    const GST_RATE = 0.18;
    const tax = parseFloat((subTotal * GST_RATE).toFixed(2));
    const totalAmount = parseFloat((subTotal + tax).toFixed(2));

    // Prepare bill document structure matching Model
    const billData = {
      patientId,
      items,
      subTotal,
      tax,
      totalAmount,
      paymentStatus: 'Unpaid'
    };

    const newBill = await Billing.create(billData);

    // Provide final downloadable format structure (PDF/JSON)
    return {
      bill: newBill,
      pdfFormatStructure: {
        header: 'MediSync Hospital - Invoice',
        billId: newBill._id,
        patientId,
        date: new Date().toISOString(),
        items: items.map(i => `${i.name} (Qty: ${i.qty}) - $${i.price}`),
        subTotal: `$${subTotal}`,
        gstTax: `18% - $${tax}`,
        grandTotal: `$${totalAmount}`,
        status: newBill.paymentStatus,
        footer: 'Thank you for choosing MediSync'
      }
    };
  }
}

module.exports = new BillingService();
