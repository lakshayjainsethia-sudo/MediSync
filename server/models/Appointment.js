const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'Please provide appointment date']
  },
  startTime: {
    type: String,
    required: [true, 'Please provide start time']
  },
  endTime: {
    type: String,
    required: [true, 'Please provide end time']
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
    default: 'scheduled'
  },
  notes: {
    type: String,
    default: ''
  },
  symptoms: {
    type: mongoose.Schema.Types.Mixed,
    default: '',
    get: function(v) {
      if (Array.isArray(v)) return v.join(', ');
      return v;
    }
  },
  aiPriority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Normal'],
    default: 'Normal'
  },
  aiSuggestedDept: {
    type: String
  },
  diagnosis: {
    type: String,
    default: ''
  },
  prescription: {
    type: String,
    default: ''
  },
  priority: {
    type: Number,
    default: 5
  },
  aiConfidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  aiReasoning: {
    type: String,
    trim: true
  },
  aiRedFlags: [{
    type: String
  }],
  // --- New fields for Iteration 4 Risk Override ---
  riskOverride: { 
    type: Boolean, 
    default: false 
  },
  riskOverrideReason: { 
    type: String, 
    default: '' 
  },
  riskOverrideBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  riskOverrideAt: { 
    type: Date 
  }
}, { 
  timestamps: true,
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true }
});

// Index for faster querying
appointmentSchema.index({ doctor: 1, date: 1, startTime: 1 }, { unique: true });
appointmentSchema.index({ patient: 1, date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
