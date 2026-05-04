const LoginAttempt = require('../models/LoginAttempt');
const { securityLogger } = require('../utils/logger');
const { alertSecurityEvent } = require('../utils/alerter');

const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_MINUTES = 15;

const checkIPBlock = async (req, res, next) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const attempt = await LoginAttempt.findOne({ ip });
    
    if (attempt && attempt.lockUntil && attempt.lockUntil > Date.now()) {
      securityLogger.warn('Blocked IP attempted access', { ip, requestId: req.id });
      const minutesLeft = Math.ceil((attempt.lockUntil - Date.now()) / 60000);
      return res.status(429).json({
        message: `Too many login attempts. IP blocked. Try again after ${minutesLeft} minutes.`
      });
    }
    
    // If lock is expired, reset attempts
    if (attempt && attempt.lockUntil && attempt.lockUntil <= Date.now()) {
        await LoginAttempt.deleteOne({ ip });
    }
    
    next();
  } catch (error) {
    securityLogger.error('IP Blocker Error', { error: error.message, stack: error.stack, ip: req.ip });
    next();
  }
};

const recordFailedLogin = async (ip) => {
  try {
    let attempt = await LoginAttempt.findOne({ ip });
    if (!attempt) {
      attempt = new LoginAttempt({ ip, attempts: 1 });
    } else {
      attempt.attempts += 1;
      
      // Progressive delay (exponential backoff)
      if (attempt.attempts >= MAX_ATTEMPTS) {
        // e.g. 5 attempts = 15m, 6 attempts = 30m, 7 attempts = 60m
        const factor = Math.pow(2, attempt.attempts - MAX_ATTEMPTS);
        attempt.lockUntil = new Date(Date.now() + (BASE_LOCKOUT_MINUTES * factor * 60000));
        
        securityLogger.warn(`IP Locked out due to brute force`, { ip, attempts: attempt.attempts, factor });
        alertSecurityEvent('BRUTE_FORCE_LOCK', 'HIGH', { ip, attempts: attempt.attempts });
      } else if (attempt.attempts >= 3) {
        alertSecurityEvent('REPEATED_LOGIN_FAILURES', 'MEDIUM', { ip, attempts: attempt.attempts });
      }
    }
    await attempt.save();
  } catch (error) {
    securityLogger.error('Record Failed Login Error', { error: error.message, ip });
  }
};

const recordSuccessfulLogin = async (ip) => {
  try {
    await LoginAttempt.deleteOne({ ip });
  } catch (error) {
    securityLogger.error('Record Successful Login Error', { error: error.message, ip });
  }
};

module.exports = { checkIPBlock, recordFailedLogin, recordSuccessfulLogin };
