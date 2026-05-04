const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  stockQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  minimumThreshold: {
    type: Number,
    required: true,
    default: 50
  },
  expiryDate: {
    type: Date,
    required: true
  },
  unit: {
    type: String,
    default: 'units'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

medicineSchema.virtual('currentStock').get(function() {
  return this.stockQuantity;
});

medicineSchema.virtual('stockStatus').get(function() {
  if (this.stockQuantity === 0) return 'OUT';
  if (this.stockQuantity <= this.minimumThreshold) return 'LOW';
  return 'OK';
});

module.exports = mongoose.model('Medicine', medicineSchema);
