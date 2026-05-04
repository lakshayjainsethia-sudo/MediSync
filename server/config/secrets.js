// Abstract secrets manager to prepare for AWS Secrets Manager or Vault
require('dotenv').config();

const secrets = {
  get jwtSecret() {
    if (!process.env.JWT_SECRET) throw new Error('CRITICAL: JWT_SECRET is missing');
    return process.env.JWT_SECRET;
  },
  
  get jwtRefreshSecret() {
    if (!process.env.JWT_REFRESH_SECRET) throw new Error('CRITICAL: JWT_REFRESH_SECRET is missing');
    return process.env.JWT_REFRESH_SECRET;
  },

  get encryptionSecret() {
    if (!process.env.ENCRYPTION_SECRET) throw new Error('CRITICAL: ENCRYPTION_SECRET is missing');
    return process.env.ENCRYPTION_SECRET;
  },
  
  get mongoUri() {
    if (!process.env.MONGO_URI) throw new Error('CRITICAL: MONGO_URI is missing');
    return process.env.MONGO_URI;
  },
  
  // Future hook for loading from AWS/Vault
  async loadRemoteSecrets() {
    // e.g. const remote = await secretsManager.getSecretValue({ SecretId: 'medisync-prod' }).promise();
    return true;
  }
};

module.exports = secrets;
