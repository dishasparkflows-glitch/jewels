const { TEST_PAYMENT_PHONE_NUMBERS } = require('../config/constants');

/**
 * Utility to check if a user/order qualifies for the ₹1 test payment override.
 * Controlled by TEST_PAYMENT_PHONE_NUMBERS in .env (JSON array or comma-separated numbers).
 */

function getTestPaymentPhoneNumbers() {
  const raw = TEST_PAYMENT_PHONE_NUMBERS || '';

  if (!raw) return [];

  try {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((p) => String(p).replace(/[^0-9]/g, '').slice(-10))
          .filter(Boolean);
      }
    }
  } catch {}

  return raw
    .split(',')
    .map((p) => String(p).replace(/[^0-9]/g, '').slice(-10))
    .filter(Boolean);
}

function normalizePhone(p) {
  if (!p) return '';
  return String(p).replace(/[^0-9]/g, '').slice(-10);
}

function isTestPaymentUser({ user = null, customer = null, shippingAddress = null, phone = null } = {}) {
  const testPhones = getTestPaymentPhoneNumbers();
  if (testPhones.length === 0) return false;

  const candidatePhones = [
    phone,
    user?.profile?.phone,
    user?.auth?.phone,
    user?.phone,
    customer?.phone,
    shippingAddress?.phone,
  ]
    .map(normalizePhone)
    .filter(Boolean);

  return candidatePhones.some((cp) => testPhones.includes(cp));
}

module.exports = {
  getTestPaymentPhoneNumbers,
  normalizePhone,
  isTestPaymentUser,
};
