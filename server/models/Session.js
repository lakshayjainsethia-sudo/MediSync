const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  refreshTokenHash: {
    type: String,
    required: true
  },
  deviceInfo: {
    type: String
  },
  deviceOS: {
    type: String
  },
  browser: {
    type: String
  },
  ip: {
    type: String
  },
  location: {
    type: String
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // Auto-delete document when time passes
  }
}, { timestamps: true });

sessionSchema.pre('save', async function(next) {
  if (this.isModified('refreshTokenHash') && this.refreshTokenHash) {
    if (!this.refreshTokenHash.startsWith('$2')) {
      const salt = await bcrypt.genSalt(10);
      this.refreshTokenHash = await bcrypt.hash(this.refreshTokenHash, salt);
    }
  }
  next();
});

sessionSchema.methods.matchToken = async function(enteredToken) {
  return await bcrypt.compare(enteredToken, this.refreshTokenHash);
};

module.exports = mongoose.model('Session', sessionSchema);
