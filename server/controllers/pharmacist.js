const Medicine = require('../models/Medicine');
const ApiError = require('../utils/ApiError');

/**
 * @desc    Add a new medicine to inventory
 * @route   POST /api/pharmacist/medicine
 * @access  Private (Pharmacist, Admin)
 */
exports.addMedicine = async (req, res, next) => {
  try {
    const { name, price, stockQuantity, category, expiryDate } = req.body;

    const medicine = await Medicine.create({
      name,
      price,
      stockQuantity,
      category,
      expiryDate
    });

    res.status(201).json({
      success: true,
      data: medicine
    });
  } catch (error) {
    next(new ApiError(400, error.message));
  }
};

/**
 * @desc    Update medicine stock
 * @route   PUT /api/pharmacist/medicine/:id
 * @access  Private (Pharmacist, Admin)
 */
exports.updateMedicineStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stockQuantity } = req.body;

    const medicine = await Medicine.findByIdAndUpdate(
      id,
      { stockQuantity },
      { new: true, runValidators: true }
    );

    if (!medicine) {
      return next(new ApiError(404, 'Medicine not found'));
    }

    res.status(200).json({
      success: true,
      data: medicine
    });
  } catch (error) {
    next(new ApiError(400, error.message));
  }
};

/**
 * @desc    Get all medicines in inventory
 * @route   GET /api/pharmacist/medicine
 * @access  Private (Pharmacist, Admin, Doctor)
 */
exports.getAllMedicines = async (req, res, next) => {
  try {
    const medicines = await Medicine.find().sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: medicines.length,
      data: medicines
    });
  } catch (error) {
    next(new ApiError(400, error.message));
  }
};
