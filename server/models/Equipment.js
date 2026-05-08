const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  serialNumber: { type: String, unique: true, required: true },
  type: { 
    type: String, 
    enum: ['Ventilator','MRI','ECG','X-Ray','Infusion Pump',
           'Defibrillator','Ultrasound','Other'],
    required: true
  },
  category: {
    type: String,
    enum: ['Diagnostic', 'Life Support', 'Surgical', 'Monitoring', 'Other'],
    default: 'Other'
  },
  unit: { type: String, required: true },       // e.g. "ICU", "OT"
  location: { type: String, required: true },   // e.g. "Ward 3, Bed 7"
  assignedDepartment: { type: String },
  status: { 
    type: String, 
    enum: ['Active','Maintenance','Offline'], 
    default: 'Active' 
  },
  lastMaintenanceDate: { type: Date },
  nextMaintenanceDate: { type: Date },
  maintenanceLogs: [
    {
      date:            { type: Date, default: Date.now },
      technician:      { type: String },
      notes:           { type: String },
      hoursOperated:   { type: Number },     // since last service
      issueFound:      { type: String },     // fault description
      resolvedAt:      { type: Date }
    }
  ],
  relatedConsumables: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Equipment', equipmentSchema);
