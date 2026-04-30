const mongoose = require('mongoose');

const dailyCounterSchema = new mongoose.Schema({
  date: { type: String, required: true }, // Format "YYYYMMDD"
  seq: { type: Number, default: 0 }
});

dailyCounterSchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model('DailyCounter', dailyCounterSchema);
