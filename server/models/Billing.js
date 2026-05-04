const mongoose = require('mongoose');
const DailyCounter = require('./DailyCounter');

const billingSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    desc: {
      type: String,
      required: true
    },
    name: {
      type: String
    },
    qty: {
      type: Number,
      default: 1,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  subTotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0.18, // 18% GST
    min: 0
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Unpaid'],
    default: 'Unpaid'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'insurance', 'online', 'other']
  },
  payments: [{
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    method: {
      type: String,
      enum: ['cash', 'card', 'insurance', 'online', 'other']
    },
    transactionId: String,
    paidAt: {
      type: Date,
      default: Date.now
    }
  }],
  dueDate: Date,
  paidAt: Date,
  insurance: {
    provider: String,
    policyNumber: String,
    coverage: {
      type: Number,
      min: 0,
      max: 100
    },
    claimNumber: String
  },
  notes: String,
  // --- New fields for Iteration 4 (Extending) ---
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lineItems: [{
    description: String,
    quantity: Number,
    unitPrice: Number,
    total: Number
  }],
  discount: { type: Number, default: 0 },
  status: { type: String, enum: ['Draft', 'Unpaid', 'Paid'], default: 'Draft' },
  billNumber: { type: String, unique: true, sparse: true },
  invoiceNumber: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Generate invoice number before saving
billingSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const count = await mongoose.model('Billing').countDocuments();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    this.invoiceNumber = `INV-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
  }

  // Atomic billNumber generation using DailyCounter
  if (this.isNew && !this.billNumber) {
    try {
      const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, ''); // YYYYMMDD
      const counter = await DailyCounter.findOneAndUpdate(
        { date: dateStr },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.billNumber = `MS-${dateStr}-${String(counter.seq).padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating billNumber:', error);
    }
  }

  // Calculate new Iteration 4 line items totals if they exist
  if (this.lineItems && this.lineItems.length > 0) {
    let computedSubtotal = 0;
    this.lineItems.forEach(item => {
      item.total = Number((item.quantity * item.unitPrice).toFixed(2));
      computedSubtotal += item.total;
    });
    
    // We update subTotal (legacy field used in UI possibly) 
    this.subTotal = computedSubtotal;
    const computedTax = this.tax !== undefined ? this.tax : 0;
    const computedDiscount = this.discount || 0;
    
    this.totalAmount = Number((computedSubtotal - computedDiscount + (computedSubtotal * computedTax / 100)).toFixed(2));
  }

  next();
});

billingSchema.index({ patient: 1, createdAt: -1 });
billingSchema.index({ invoiceNumber: 1 });
billingSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('Billing', billingSchema);
