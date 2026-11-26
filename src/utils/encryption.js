const crypto = require('crypto');
const {
  INTEGRATION_TOKEN_ENCRYPTION_KEY,
  PAYLOAD_ENCRYPTION_KEY,
  JWT,
} = require('../config/constants');

const ALGORITHM = 'aes-256-gcm';

// ------------------------------- get encryption key ----------------------------
const getEncryptionKey = () => {
  const keyHex =
    INTEGRATION_TOKEN_ENCRYPTION_KEY ||
    PAYLOAD_ENCRYPTION_KEY;

  if (keyHex && keyHex.length === 64) {
    return Buffer.from(keyHex, 'hex');
  }

  // Fallback: derive 32-byte key from JWT.SECRET or default secret
  const secret = JWT?.SECRET || 'jewels_default_encryption_secret_key';
  return crypto.createHash('sha256').update(secret).digest();
};

// ------------------------------- encrypt token ----------------------------
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

// ------------------------------- decrypt token ----------------------------
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

const isEncryptedPayload = (value) => {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{24}:[0-9a-f]+:[0-9a-f]{32}$/i.test(value.trim());
};

const encryptDatabaseUrl = (url) => {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (isEncryptedPayload(trimmed)) return trimmed;
  return encryptToken(trimmed);
};

const decryptDatabaseUrl = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^mongodb(\+srv)?:\/\//i.test(trimmed) || !isEncryptedPayload(trimmed)) {
    return trimmed;
  }
  try {
    return decryptToken(trimmed) || '';
  } catch {
    return trimmed;
  }
};

module.exports = {
  encryptToken,
  decryptToken,
  isEncryptedPayload,
  encryptDatabaseUrl,
  decryptDatabaseUrl,
};
