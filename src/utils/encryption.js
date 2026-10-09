const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

/**
 * Validates or derives a 32-byte encryption key for AES-256-GCM.
 */
const getEncryptionKey = () => {
  const keyHex =
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
    process.env.SHIPROCKET_TOKEN_ENCRYPTION_KEY ||
    process.env.PAYLOAD_ENCRYPTION_KEY;

  if (keyHex && keyHex.length === 64) {
    return Buffer.from(keyHex, 'hex');
  }

  // Fallback: derive 32-byte key from JWT_SECRET or default secret
  const secret = process.env.JWT_SECRET || 'jewels_default_encryption_secret_key';
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypts a plain text string securely using AES-256-GCM.
 * @param {string} text - The token to encrypt.
 * @returns {string} - The IV, encrypted data, and auth tag concatenated with colons.
 */
const encryptToken = (text) => {
  if (!text) return null;
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12); // 96-bit IV is standard for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
  } catch (error) {
    console.error('[Encryption] Failed to encrypt token:', error.message);
    throw new Error('Failed to encrypt token');
  }
};

/**
 * Decrypts a secure token payload using AES-256-GCM.
 * @param {string} encryptedPayload - The payload formatted as iv:encryptedData:authTag.
 * @returns {string} - The decrypted plain text token.
 */
const decryptToken = (encryptedPayload) => {
  if (!encryptedPayload) return null;
  try {
    const key = getEncryptionKey();
    const parts = encryptedPayload.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const authTag = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[Encryption] Failed to decrypt token:', error.message);
    throw new Error('Failed to decrypt token');
  }
};

module.exports = { encryptToken, decryptToken };
