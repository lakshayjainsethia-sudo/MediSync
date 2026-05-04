const permissions = {
  admin: ['all'],
  doctor: ['read:patients', 'write:medical-records', 'read:appointments', 'write:appointments', 'read:billing'],
  receptionist: ['read:patients', 'read:appointments', 'write:appointments', 'read:billing', 'write:billing'],
  pharmacist: ['read:prescriptions', 'read:equipment', 'write:dispense'],
  patient: ['read:own_records', 'read:own_appointments', 'write:own_appointments', 'read:own_billing']
};

module.exports = permissions;
