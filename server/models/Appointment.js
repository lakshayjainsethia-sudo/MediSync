const mongoose = require('mongoose');
const { fieldEncryption } = require('mongoose-field-encryption');

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
    enum: ['scheduled', 'completed', 'cancelled', 'rescheduled', 'Review_Required', 'Billing_Pending', 'Confirmed', 'Active'],
    default: 'scheduled'
  },
  notes: {
    type: String,
    default: ''
  },
  clinicalNotes: {
    type: String,
    default: ''
  },
  billingSummary: {
    type: String,
    default: ''
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: {
    type: String
  },
  symptoms: {
    type: mongoose.Schema.Types.Mixed,
    default: '',
    get: function(v) {
      if (Array.isArray(v)) return v.join(', ');
      return v;
    }
  },
  // --- New fields for Section 1 AI Triage Engine Upgrade ---
  severity: { type: Number, min: 1, max: 10 },
  urgency_score: { type: Number, min: 1, max: 10 },
  triage_tag: { type: String, enum: ['RED', 'ORANGE', 'GREEN'] },
  weightedScore: { type: Number },
  // --- Legacy fields preserved for backward compatibility ---
  aiPriority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Normal'],
    default: 'Normal'
  },
  aiPriorityScore: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
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
  triage_reason: {
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
  },
  assignedNurse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  nurseNotes: [
    {
      note: { type: String },
      vitals: {
        bloodPressure: { type: String },
        heartRate: { type: Number },
        temperature: { type: Number },
        oxygenSat: { type: Number },
        weight: { type: Number },
        height: { type: Number }
      },
      recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      recordedAt: { type: Date, default: Date.now }
    }
  ],
  triageOverride: {
    updatedTag: {
      type: String,
      enum: ['RED', 'ORANGE', 'GREEN']
    },
    updatedReason: { type: String },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date }
  },
  dispensed: { type: Boolean, default: false },
  dispensedAt: { type: Date },
  dispensedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  medicineBill: {
    items: [
      {
        medicineId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
        medicineName: { type: String },
        quantity:     { type: Number },
        unitPrice:    { type: Number },
        total:        { type: Number }
      }
    ],
    subtotal:       { type: Number, default: 0 },
    generatedAt:    { type: Date },
    generatedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sentToReceptionist: { type: Boolean, default: false }
  },
  billingType: {
    type: String,
    enum: ['WithMedicines', 'ConsultationOnly']
  },
  finalBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Billing' }
}, { 
  timestamps: true,
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true }
});

// Index for faster querying
appointmentSchema.index({ doctor: 1, date: 1, startTime: 1 }, { unique: true });
appointmentSchema.index({ patient: 1, date: 1 });

appointmentSchema.plugin(fieldEncryption, {
  fields: [
    'prescription',
    'triage_reason',
    'aiReasoning',
    'riskOverrideReason'
  ],
  secret: process.env.ENCRYPTION_SECRET,
  saltGenerator: (secret) => secret.slice(0, 16)
});

module.exports = mongoose.model('Appointment', appointmentSchema);
