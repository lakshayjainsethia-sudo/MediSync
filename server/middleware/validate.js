// Generic validator using express built-ins
// No new packages needed

const validateAppointmentInput = (req, res, next) => {
  const { symptoms, prescription } = req.body;
  
  // Reject if any field exceeds safe length
  if (symptoms && symptoms.length > 2000) {
    return res.status(400).json({ 
      error: 'Symptoms field exceeds maximum length'
    });
  }
  if (prescription && prescription.length > 5000) {
    return res.status(400).json({ 
      error: 'Prescription exceeds maximum length'
    });
  }
  
  // Reject obvious script injection attempts (backup to xss-clean)
  const dangerous = /<script|javascript:|on\w+=/i;
  const fields = Object.values(req.body).filter(v => typeof v === 'string');
  
  if (fields.some(f => dangerous.test(f))) {
    console.warn(
      `[SECURITY] XSS attempt from IP: ${req.ip}`
    );
    return res.status(400).json({ 
      error: 'Invalid characters in input'
    });
  }
  
  next();
};

const validateLoginInput = (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email and password required'
    });
  }
  
  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      error: 'Invalid email format'
    });
  }
  
  // Reject suspiciously long inputs
  if (email.length > 254 || password.length > 128) {
    return res.status(400).json({ 
      error: 'Input exceeds maximum length'
    });
  }
  
  next();
};

module.exports = {
  validateAppointmentInput,
  validateLoginInput
};
