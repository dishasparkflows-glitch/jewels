
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

const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  return cleaned;
};

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
