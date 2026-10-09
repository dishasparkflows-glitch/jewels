/**
 * WhatsApp Module Utility Functions
 */

/**
 * Normalizes ConnectWhats base URL:
 * - Trims whitespace and trailing slashes
 * - Replaces 'api.connectwhats.com' with 'app.connectwhats.com'
 * - Strips trailing '/api'
 *
 * @param {string} [url] - Raw API URL
 * @returns {string} Normalized URL
 */
const normalizeUrl = (url) => {
  let clean = (url || process.env.CONNECTWHATS_API_URL || 'https://app.connectwhats.com')
    .trim()
    .replace(/\/+$/, '');

  if (clean.includes('api.connectwhats.com')) {
    clean = clean.replace('api.connectwhats.com', 'app.connectwhats.com');
  }

  if (clean.endsWith('/api')) {
    clean = clean.substring(0, clean.length - 4);
  }

  return clean;
};

/**
 * Normalizes phone numbers to standard international format (default 91 for 10-digit Indian numbers)
 * Strips all non-digit characters.
 *
 * @param {string|number} phone - Raw phone number
 * @returns {string} Normalized numeric phone string
 */
const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  return cleaned;
};

/**
 * Safely resolves a nested dot-separated property path from an object without using eval.
 * Example paths: 'customer.name', 'order.shippingAddress.city'
 *
 * @param {Object} obj - Source object
 * @param {string} path - Dot-separated path
 * @returns {*} Resolved value or undefined
 */
const getValueByPath = (obj, path) => {
  if (!obj || !path || typeof path !== 'string') return undefined;
  const parts = path.trim().split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
};

/**
 * Extracts {{1}}, {{2}} placeholder positions from a template body string.
 *
 * @param {string} bodyText - Template body text
 * @returns {number[]} Array of sorted unique variable positions
 */
const extractTemplateVariables = (bodyText) => {
  if (!bodyText || typeof bodyText !== 'string') return [];
  const regex = /\{\{(\d+)\}\}/g;
  const positions = [];
  let match;
  while ((match = regex.exec(bodyText)) !== null) {
    positions.push(parseInt(match[1], 10));
  }
  return [...new Set(positions)].sort((a, b) => a - b);
};

module.exports = {
  normalizeUrl,
  normalizePhoneNumber,
  getValueByPath,
  extractTemplateVariables,
};
