// ------------------------------- format order items ----------------------------
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

// ------------------------------- format currency ----------------------------
const formatCurrency = (val) => {
  if (val === undefined || val === null || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.-]/g, ''));
  if (isNaN(num)) return String(val).trim();
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ------------------------------- format currency with rupee symbol ----------------------------
const formatRupee = (num, useRupeeSymbol = true) => {
  const n = Number(num || 0);
  const symbol = useRupeeSymbol ? '₹' : 'Rs. ';
  return symbol + formatCurrency(Number.isFinite(n) ? n : 0);
};

// ------------------------------- format date ----------------------------
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

// ------------------------------- format short date (e.g. 17 Nov 2026) ----------------------------
const formatShortDate = (dateVal) => {
  const fallback = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (!dateVal) return fallback();
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return fallback();
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return fallback();
  }
};

// ------------------------------- format date & time (e.g. 16 Nov 2026, 05:24 PM) ----------------------------
const formatDateTime = (dateVal) => {
  const fallback = () => `${formatShortDate(new Date())}, 10:00 AM`;
  if (!dateVal) return fallback();
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return fallback();
    const dateStr = formatShortDate(d);
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return fallback();
  }
};

// ------------------------------- format time ----------------------------
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

// ------------------------------- format address ----------------------------
const formatAddress = (address) => {
  if (!address) return '';
  if (typeof address === 'string') return address.trim();

  const parts = [
    address.address || address.addressLine || address.addressLine1,
    address.apartment || address.addressLine2,
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

const templateFormatters = {
  orderItems: formatOrderItems,
  currency: formatCurrency,
  rupee: formatRupee,
  date: formatDate,
  shortDate: formatShortDate,
  dateTime: formatDateTime,
  time: formatTime,
  address: formatAddress,
};

// ------------------------------- get formatter ----------------------------
const getFormatter = (name) => {
  if (!name || typeof name !== 'string') return null;
  return templateFormatters[name.trim()] || null;
};

module.exports = {
  formatOrderItems,
  formatCurrency,
  formatRupee,
  formatDate,
  formatShortDate,
  formatDateTime,
  formatTime,
  formatAddress,
  templateFormatters,
  getFormatter,
};
