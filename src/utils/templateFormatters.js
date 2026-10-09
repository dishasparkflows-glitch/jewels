/**
 * Template Formatter Registry
 * Provides reusable formatters for WhatsApp template variables.
 */

/**
 * Format order items array into numbered luxury summary text.
 * Example output:
 * 1. GOLD SHOW PC (x1) - ₹7,437.60
 * 2. Diamond Solitaire Ring (x1) - ₹28,619.16
 */
const formatOrderItems = (items) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return '1. Luxury Jewellery Selection';
  }

  const lines = items.map((item, index) => {
    const name = item.name || item.title || item.product?.title || item.product?.name || 'Jewellery Selection';
    const qty = item.quantity || 1;
    const rawPrice = item.price !== undefined ? item.price : (item.product?.price || 0);
    let priceStr = '0.00';
    if (typeof rawPrice === 'number') {
      priceStr = rawPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (rawPrice) {
      const num = parseFloat(String(rawPrice).replace(/[^\d.-]/g, ''));
      priceStr = !isNaN(num) ? num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(rawPrice);
    }
    return `${index + 1}. ${name} (x${qty}) - ₹${priceStr}`;
  });

  return lines.join('\n');
};

/**
 * Format number or string into Indian Rupee currency representation.
 * Example: 7437.6 -> "7,437.60"
 */
const formatCurrency = (val) => {
  if (val === undefined || val === null || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.-]/g, ''));
  if (isNaN(num)) return String(val).trim();
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Format date value into a human-readable date.
 * Example: "2026-09-20" -> "Sunday, 20 September 2026"
 */
const formatDate = (val) => {
  if (!val) return '';
  if (typeof val === 'string' && /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(val)) {
    return val.trim();
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val).trim();
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Format time value into standard 12-hour AM/PM format.
 * Example: "13:00" -> "01:00 PM"
 */
const formatTime = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{1,2}:\d{2}\s*(?:AM|PM)$/i.test(str)) {
    return str.toUpperCase();
  }
  const match = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    let hour = parseInt(match[1], 10);
    const min = match[2];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
    return `${hourStr}:${min} ${ampm}`;
  }
  return str;
};

/**
 * Format address object or string into a single readable string.
 * Example: { address: 'A-28', city: 'Jaipur', state: 'Rajasthan', pincode: '302004' }
 */
const formatAddress = (address) => {
  if (!address) return '';
  if (typeof address === 'string') return address.trim();

  const parts = [
    address.address || address.addressLine1,
    address.addressLine2 || address.apartment,
    address.city,
    address.state,
    address.pincode || address.postalCode ? `(${address.pincode || address.postalCode})` : null,
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  const fallback = [address.city, address.state].filter(Boolean);
  return fallback.join(', ') || 'Registered Address';
};

/**
 * Central Formatter Registry
 */
const templateFormatters = {
  orderItems: formatOrderItems,
  currency: formatCurrency,
  date: formatDate,
  time: formatTime,
  address: formatAddress,
};

/**
 * Safe formatter lookup
 */
const getFormatter = (name) => {
  if (!name || typeof name !== 'string') return null;
  return templateFormatters[name.trim()] || null;
};

module.exports = {
  formatOrderItems,
  formatCurrency,
  formatDate,
  formatTime,
  formatAddress,
  templateFormatters,
  getFormatter,
};
