const express = require('express');
const {
  addMedicine,
  updateMedicineStock,
  getAllMedicines,
  searchMedicines,
  getOverview,
  dispensePrescription,
  getPendingPrescriptions,
  getLowStockMedicines
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

router.get('/medicine/search', authorizeRoles('Pharmacist', 'Admin', 'Doctor'), searchMedicines);

router
  .route('/medicine/:id')
  .put(authorizeRoles('Pharmacist', 'Admin'), updateMedicineStock);



router.get('/overview', authorizeRoles('Pharmacist', 'Admin'), getOverview);
router.patch('/prescriptions/:appointmentId/dispense', authorizeRoles('Pharmacist', 'Admin'), dispensePrescription);
router.get('/prescriptions/pending', authorizeRoles('Pharmacist', 'Admin'), getPendingPrescriptions);
router.get('/medicines/low-stock', authorizeRoles('Pharmacist', 'Admin'), getLowStockMedicines);

module.exports = router;
