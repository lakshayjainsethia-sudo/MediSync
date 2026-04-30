const express = require('express');
const {
  addMedicine,
  updateMedicineStock,
  getAllMedicines
} = require('../controllers/pharmacist');

const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roleCheck');

const router = express.Router();

// Apply auth middleware to all routes below
router.use(protect);

router
  .route('/medicine')
  .post(authorizeRoles('Pharmacist', 'Admin'), addMedicine)
  .get(authorizeRoles('Pharmacist', 'Admin', 'Doctor'), getAllMedicines);

router
  .route('/medicine/:id')
  .put(authorizeRoles('Pharmacist', 'Admin'), updateMedicineStock);

module.exports = router;
