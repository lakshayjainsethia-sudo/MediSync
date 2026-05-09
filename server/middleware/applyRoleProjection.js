const applyRoleProjection = (req, res, next) => {
  const projections = {
    doctor:      '-billing -medicalHistory -insuranceDetails -billingNotes',
    receptionist:'-medicalHistory -insuranceDetails',
    pharmacist:  '-billing -medicalHistory -insuranceDetails',
    nurse:       '-billing -medicineBill -finalBillId -insuranceDetails -prescription'
  };
  req.fieldProjection = projections[req.user.role] || '';
  next();
};

module.exports = applyRoleProjection;
