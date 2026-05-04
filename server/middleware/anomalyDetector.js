const geoip = require('geoip-lite');
const Session = require('../models/Session');
const { alertSecurityEvent } = require('../utils/alerter');

const detectAnomalies = async (user, currentIp, currentDeviceOS) => {
  try {
    const recentSessions = await Session.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    if (recentSessions.length === 0) return; // First login

    const lastSession = recentSessions[0];
    const geoCurrent = geoip.lookup(currentIp);
    const geoLast = geoip.lookup(lastSession.ip);

    // 1. Impossible Travel Detection
    if (geoCurrent && geoLast) {
      if (geoCurrent.country !== geoLast.country || geoCurrent.city !== geoLast.city) {
        // If cities differ, check time difference
        const timeDiffMinutes = (Date.now() - lastSession.createdAt.getTime()) / 60000;
        
        // If country changed within 12 hours, or city within 1 hour, flag impossible travel
        if ((geoCurrent.country !== geoLast.country && timeDiffMinutes < 720) ||
            (geoCurrent.city !== geoLast.city && timeDiffMinutes < 60)) {
          
          alertSecurityEvent('IMPOSSIBLE_TRAVEL', 'HIGH', {
            userId: user._id,
            email: user.email,
            previousLocation: `${geoLast.city}, ${geoLast.country}`,
            currentLocation: `${geoCurrent.city}, ${geoCurrent.country}`,
            timeDiffMinutes: Math.round(timeDiffMinutes)
          });
        }
      }
    }

    // 2. Rapid Device Switching (Device Spoofing/Cookie Theft)
    if (lastSession.deviceOS !== 'Unknown OS' && currentDeviceOS !== 'Unknown OS') {
      if (lastSession.deviceOS !== currentDeviceOS) {
        const timeDiffMinutes = (Date.now() - lastSession.createdAt.getTime()) / 60000;
        // If switched OS within 5 minutes
        if (timeDiffMinutes < 5) {
          alertSecurityEvent('RAPID_DEVICE_SWITCH', 'MEDIUM', {
            userId: user._id,
            email: user.email,
            previousDevice: lastSession.deviceOS,
            currentDevice: currentDeviceOS,
            timeDiffMinutes: Math.round(timeDiffMinutes)
          });
        }
      }
    }
  } catch (err) {
    console.error('Anomaly Detection Error', err);
  }
};

module.exports = { detectAnomalies };
