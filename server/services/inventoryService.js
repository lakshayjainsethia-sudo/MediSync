const BloodInventory = require('../models/BloodInventory');

/**
 * Atomically updates blood inventory stock.
 * @param {string} bloodGroup - The blood group (e.g., 'A+', 'O-').
 * @param {number} unitDiff - Positive to add stock, negative to reduce stock.
 * @returns {object} The updated BloodInventory document.
 */
exports.updateBloodStock = async (bloodGroup, unitDiff) => {
  // If unitDiff is negative, ensure stock doesn't drop below zero
  if (unitDiff < 0) {
    const unitsRequested = Math.abs(unitDiff);
    const updatedStock = await BloodInventory.findOneAndUpdate(
      { bloodGroup, units: { $gte: unitsRequested } },
      { $inc: { units: unitDiff } },
      { new: true }
    );
    
    if (!updatedStock) {
      throw new Error(`Insufficient stock for blood group ${bloodGroup}`);
    }
    return updatedStock;
  } else {
    // For positive updates, upsert in case the document doesn't exist yet
    const updatedStock = await BloodInventory.findOneAndUpdate(
      { bloodGroup },
      { $inc: { units: unitDiff } },
      { new: true, upsert: true }
    );
    return updatedStock;
  }
};
