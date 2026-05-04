// migrate-encrypt.js (run once: node migrate-encrypt.js)
const mongoose = require('mongoose');
const Appointment = require('./models/Appointment.js');
require('dotenv').config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const appointments = await Appointment.find({});
    for (const appt of appointments) {
      appt.markModified('prescription');
      appt.markModified('triage_reason');
      appt.markModified('aiReasoning');
      appt.markModified('riskOverrideReason');
      await appt.save();  // triggers encryption plugin
    }
    console.log(`Encrypted ${appointments.length} records`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
