const mongoose = require('mongoose');

const loginAttemptSchema = new mongoose.Schema({
  ip: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  lockUntil: { type: Date }
}, { timestamps: true });

loginAttemptSchema.index({ ip: 1 }, { unique: true });

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);
