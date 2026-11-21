// Lightweight local-safe IP lookup fallback for Windows/local environments
// Avoids 160MB+ synchronous memory-mapped binary file locks from geoip-lite on OneDrive

const lookup = (ip) => {
  if (!ip) return null;

  // Localhost / Loopback / Private subnets
  const cleanIp = ip.replace(/^::ffff:/, '');
  if (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp === 'localhost' ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('172.16.')
  ) {
    return {
      country: 'Local',
      region: 'LAN',
      city: 'Local Area Network',
      timezone: 'UTC'
    };
  }

  // Fallback for non-local IPs without blocking the main event loop
  return {
    country: 'US',
    region: 'VA',
    city: 'Ashburn',
    timezone: 'America/New_York'
  };
};

module.exports = { lookup };
