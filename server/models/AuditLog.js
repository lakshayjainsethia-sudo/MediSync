const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  targetModel: { type: String, enum: ['Appointment', 'Billing', 'Equipment', 'User', 'System'] },
  metadata: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },
  createdAt: { type: Date, default: Date.now, immutable: true }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
