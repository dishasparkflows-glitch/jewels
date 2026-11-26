const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit-table');
const axios = require('axios');

const fontsDir = path.resolve(__dirname, '../assets/fonts');

/**
 * Configure serif and sans fonts from bundled TTF assets
 */
function setupFonts(doc) {
  const georgiaPath = path.join(fontsDir, 'georgia.ttf');
  const georgiaBoldPath = path.join(fontsDir, 'georgiab.ttf');
  const segoePath = path.join(fontsDir, 'segoeui.ttf');
  const segoeBoldPath = path.join(fontsDir, 'segoeuib.ttf');

  let hasCustomFonts = false;

  if (fs.existsSync(georgiaPath) && fs.existsSync(georgiaBoldPath)) {
    doc.registerFont('Serif', georgiaPath);
    doc.registerFont('Serif-Bold', georgiaBoldPath);
    hasCustomFonts = true;
  } else {
    doc.registerFont('Serif', 'Times-Roman');
    doc.registerFont('Serif-Bold', 'Times-Bold');
  }

  if (fs.existsSync(segoePath) && fs.existsSync(segoeBoldPath)) {
    doc.registerFont('Sans', segoePath);
    doc.registerFont('Sans-Bold', segoeBoldPath);
  } else {
    doc.registerFont('Sans', 'Helvetica');
    doc.registerFont('Sans-Bold', 'Helvetica-Bold');
  }

  return hasCustomFonts;
}

/**
 * Format currency with Indian Rupee symbol
 */
function formatCurrency(num, useRupeeSymbol = true) {
  const n = Number(num || 0);
  const symbol = useRupeeSymbol ? '₹' : 'Rs. ';
  return symbol + n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format date (e.g. 17 Nov 2026)
 */
function formatDate(dateVal) {
  if (!dateVal) return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}

/**
 * Format full date & time (e.g. 16 Nov 2026, 05:24 PM)
 */
function formatDateTime(dateVal) {
  if (!dateVal) return formatDate(new Date()) + ', 10:00 AM';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return formatDate(new Date()) + ', 10:00 AM';
    const dateStr = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return formatDate(new Date()) + ', 10:00 AM';
  }
}

/**
 * Generates an official Tax Invoice number (e.g. NI/2026-27/000145)
 */
function generateInvoiceNumber(order) {
  if (order.invoiceNumber) return order.invoiceNumber;
  const digits = String(order.orderNumber || '1').replace(/[^0-9]/g, '');
  const cleanNum = (digits || '1').padStart(6, '0');
  const d = order.createdAt ? new Date(order.createdAt) : new Date();
  const year = d.getFullYear();
  const nextYear = String(year + 1).slice(-2);
  return `NI/${year}-${nextYear}/${cleanNum}`;
}

/**
 * Extracts line item attributes in structured format
 */
function extractItemDetails(item) {
  const attrs = item.selectedAttributes || {};
  const refDoc = item.refId;
  const isSilver =
    item.productType === 'silver' ||
    refDoc?.basicInfo?.productType === 'silver' ||
    Boolean(refDoc?.isOrnate) ||
    String(item.title || '').toLowerCase().startsWith('92.5') ||
    String(item.selectedMetal || '').toLowerCase().includes('silver');

  const shape = attrs.diamondShape || (item.title && item.title.includes('Round') ? 'Round' : null);
  const type = attrs.diamondType || (isSilver ? null : 'Lab Grown Diamond');
  const color = attrs.diamondColor || (attrs.color ? attrs.color : null);
  const clarity = attrs.diamondClarity || (attrs.clarity ? attrs.clarity : null);
  const carat = attrs.caratWeight || null;
  const purity = attrs.metalPurity || (item.selectedMetal && item.selectedMetal.includes('KT') ? item.selectedMetal.split(' ')[0] + ' Gold' : (isSilver ? 'Silver 92.5' : null));
  const metalColor = attrs.metalColor || (item.selectedMetal ? item.selectedMetal.replace(/^[0-9]+KT\s*/i, '').trim() : null);
  const size = attrs.size || item.selectedSize || null;

  return {
    shape,
    type,
    color,
    clarity,
    carat,
    purity,
    metalColor,
    size,
    isSilver,
  };
}

/**
 * Attempts to safely fetch an image buffer with a fast timeout
 */
async function fetchImageBuffer(url) {
  if (!url || typeof url !== 'string') return null;
  if (fs.existsSync(url)) {
    try {
      return fs.readFileSync(url);
    } catch {
      return null;
    }
  }
  if (/^https?:\/\//i.test(url)) {
    try {
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 2000 });
      if (res.status === 200 && res.data) {
        return Buffer.from(res.data);
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Resolves the primary thumbnail URL for an order item
 */
function resolveItemImageUrl(item) {
  if (item?.image) return item.image;
  if (item?.thumbnail) return item.thumbnail;
  const prod = item?.refId;
  if (!prod) return '';
  if (prod.image?.url) return prod.image.url;
  if (typeof prod.image === 'string' && prod.image) return prod.image;
  if (Array.isArray(prod.ornate?.ornateImages) && prod.ornate.ornateImages.length > 0) {
    const found = prod.ornate.ornateImages.find((img) => img?.url);
    if (found?.url) return found.url;
  }
  if (Array.isArray(prod.colorImages) && prod.colorImages.length > 0) {
    for (const ci of prod.colorImages) {
      if (Array.isArray(ci.images)) {
        const found = ci.images.find((img) => img?.url && (img.mediaType === 'image' || !/\.(webm|mp4|mov)$/i.test(img.url)));
        if (found?.url) return found.url;
      }
    }
  }
  if (Array.isArray(prod.media) && prod.media.length > 0) {
    const found = prod.media.find((m) => m?.url);
    if (found?.url) return found.url;
  }
  if (Array.isArray(prod.basicInfo?.images) && prod.basicInfo.images.length > 0) {
    return prod.basicInfo.images[0];
  }
  if (prod.assets?.thumbnail) return prod.assets.thumbnail;
  return '';
}

/**
 * Vector drawing helpers for luxury icons without relying on font emoji glyphs
 */
function drawPhoneIcon(doc, x, y, color = '#8C6D46') {
  doc.save();
  doc.strokeColor(color).fillColor(color).lineWidth(0.8);
  doc.path(
    `M ${x + 2.2},${y + 1} ` +
    `C ${x + 1.2},${y + 1} ${x + 0.6},${y + 1.8} ${x + 0.6},${y + 2.8} ` +
    `C ${x + 0.6},${y + 5.8} ${x + 3.8},${y + 9} ${x + 6.8},${y + 9} ` +
    `C ${x + 7.8},${y + 9} ${x + 8.6},${y + 8.4} ${x + 8.6},${y + 7.4} ` +
    `L ${x + 7.5},${y + 5.9} ` +
    `C ${x + 7.2},${y + 5.5} ${x + 6.7},${y + 5.5} ${x + 6.3},${y + 5.8} ` +
    `L ${x + 5.8},${y + 6.3} ` +
    `C ${x + 4.8},${y + 5.7} ${x + 3.9},${y + 4.8} ${x + 3.3},${y + 3.8} ` +
    `L ${x + 3.8},${y + 3.3} ` +
    `C ${x + 4.1},${y + 2.9} ${x + 4.1},${y + 2.4} ${x + 3.7},${y + 2.1} ` +
    `Z`
  ).fill();
  doc.restore();
}

function drawMailIcon(doc, x, y, color = '#8C6D46') {
  doc.save();
  doc.strokeColor(color).lineWidth(0.8);
  doc.roundedRect(x, y, 10.5, 7.5, 1).stroke();
  doc.path(`M ${x + 0.5},${y + 0.5} L ${x + 5.25},${y + 4.5} L ${x + 10},${y + 0.5}`).stroke();
  doc.restore();
}

function drawGlobeIcon(doc, x, y, color = '#8C6D46') {
  doc.save();
  doc.strokeColor(color).lineWidth(0.8);
  doc.circle(x + 4.5, y + 4.5, 4.5).stroke();
  doc.ellipse(x + 4.5, y + 4.5, 2.2, 4.5).stroke();
  doc.moveTo(x, y + 4.5).lineTo(x + 9, y + 4.5).stroke();
  doc.restore();
}

function drawCardIcon(doc, x, y, color = '#8C6D46') {
  doc.save();
  doc.strokeColor(color).lineWidth(0.85);
  doc.roundedRect(x, y, 13, 9.5, 1.5).stroke();
  doc.moveTo(x, y + 3.2).lineTo(x + 13, y + 3.2).stroke();
  doc.rect(x + 2.2, y + 5.6, 3.2, 1.8).fill(color);
  doc.restore();
}

function drawLotusEmblem(doc, cx, cy, color = '#8C6D46') {
  doc.save();
  doc.strokeColor(color).lineWidth(1.0);
  // Four-petal luxury diamond lotus emblem
  doc.path(`M ${cx},${cy - 10} Q ${cx + 5},${cy - 5} ${cx},${cy} Q ${cx - 5},${cy - 5} ${cx},${cy - 10} Z`).stroke();
  doc.path(`M ${cx},${cy + 10} Q ${cx + 5},${cy + 5} ${cx},${cy} Q ${cx - 5},${cy + 5} ${cx},${cy + 10} Z`).stroke();
  doc.path(`M ${cx - 10},${cy} Q ${cx - 5},${cy - 5} ${cx},${cy} Q ${cx - 5},${cy + 5} ${cx - 10},${cy} Z`).stroke();
  doc.path(`M ${cx + 10},${cy} Q ${cx + 5},${cy - 5} ${cx},${cy} Q ${cx + 5},${cy + 5} ${cx + 10},${cy} Z`).stroke();
  doc.circle(cx, cy, 1.6).fill(color);
  doc.restore();
}

function drawCornerBotanical(doc, pageWidth) {
  doc.save();
  doc.strokeColor('#E6DACA').lineWidth(0.7);
  // Subtle top-right botanical leaf line art
  const ox = pageWidth;
  doc.path(`M ${ox - 95},0 Q ${ox - 65},22 ${ox - 20},45`).stroke();
  doc.path(`M ${ox - 72},14 Q ${ox - 82},28 ${ox - 62},32 Q ${ox - 60},20 ${ox - 72},14 Z`).stroke();
  doc.path(`M ${ox - 50},25 Q ${ox - 58},42 ${ox - 36},44 Q ${ox - 36},30 ${ox - 50},25 Z`).stroke();
  doc.path(`M ${ox - 28},38 Q ${ox - 32},54 ${ox - 12},56 Q ${ox - 14},42 ${ox - 28},38 Z`).stroke();
  doc.path(`M ${ox - 42},0 Q ${ox - 25},20 ${ox},32`).stroke();
  doc.path(`M ${ox - 26},10 Q ${ox - 10},4 ${ox - 6},20 Q ${ox - 20},20 ${ox - 26},10 Z`).stroke();
  doc.restore();
}

function drawBottomBorderPattern(doc, pageWidth, pageHeight) {
  doc.save();
  doc.strokeColor('#EAE0D2').lineWidth(0.65);
  const baseY = pageHeight;
  const step = 26;
  for (let x = 0; x < pageWidth + step; x += step) {
    doc.circle(x, baseY - 2, 13).stroke();
    doc.circle(x + step / 2, baseY - 2, 13).stroke();
  }
  doc.restore();
}

function drawDiamondFallback(doc, boxX, boxY, boxSize) {
  const cx = boxX + boxSize / 2;
  const cy = boxY + boxSize / 2;
  doc.save();
  doc.strokeColor('#8C6D46').fillColor('#FAF5EE').lineWidth(0.8);
  doc.path(`M ${cx - 7},${cy - 8} L ${cx + 7},${cy - 8} L ${cx + 13},${cy - 2} L ${cx},${cy + 10} L ${cx - 13},${cy - 2} Z`).fillAndStroke();
  
  doc.strokeColor('#C9B6A1').lineWidth(0.6);
  doc.moveTo(cx - 7, cy - 8).lineTo(cx - 5, cy - 2).lineTo(cx, cy + 10).stroke();
  doc.moveTo(cx + 7, cy - 8).lineTo(cx + 5, cy - 2).lineTo(cx, cy + 10).stroke();
  doc.moveTo(cx - 5, cy - 2).lineTo(cx + 5, cy - 2).stroke();
  doc.moveTo(cx - 7, cy - 8).lineTo(cx, cy - 2).lineTo(cx + 7, cy - 8).stroke();
  doc.restore();
}

function drawProperSocialIcon(doc, type, cx, cy, color = '#8C6D46') {
  doc.save();
  doc.strokeColor(color).fillColor(color);

  if (type === 'instagram') {
    doc.lineWidth(0.85);
    doc.roundedRect(cx - 5.5, cy - 5.5, 11, 11, 2.6).stroke();
    doc.circle(cx, cy, 2.4).stroke();
    doc.circle(cx + 2.7, cy - 2.7, 0.7).fill();
  } else if (type === 'facebook') {
    doc.lineWidth(0.85);
    doc.circle(cx, cy, 5.5).stroke();
    doc.lineWidth(0.95).lineCap('round').lineJoin('round');
    doc.path('M ' + (cx + 1.8) + ',' + (cy - 3.8) + ' C ' + (cx + 0.5) + ',' + (cy - 4) + ' ' + (cx - 0.4) + ',' + (cy - 3.5) + ' ' + (cx - 0.4) + ',' + (cy - 2) + ' L ' + (cx - 0.4) + ',' + (cy + 4.2)).stroke();
    doc.path('M ' + (cx - 2.4) + ',' + (cy - 0.8) + ' L ' + (cx + 1.6) + ',' + (cy - 0.8)).stroke();
  } else if (type === 'pinterest') {
    doc.lineWidth(0.85);
    doc.circle(cx, cy, 5.5).stroke();
    doc.lineWidth(0.9).lineCap('round').lineJoin('round');
    doc.path('M ' + (cx - 0.3) + ',' + (cy - 3.5) + ' Q ' + (cx - 0.5) + ',' + cy + ' ' + (cx - 1.2) + ',' + (cy + 4.2)).stroke();
    doc.path('M ' + (cx - 0.3) + ',' + (cy - 3.4) + ' C ' + (cx + 2.8) + ',' + (cy - 3.4) + ' ' + (cx + 2.8) + ',' + (cy + 0.2) + ' ' + (cx - 0.3) + ',' + (cy + 0.2)).stroke();
  } else if (type === 'youtube') {
    doc.lineWidth(0.85);
    doc.roundedRect(cx - 5.5, cy - 4, 11, 8, 2).stroke();
    doc.path('M ' + (cx - 1.2) + ',' + (cy - 2) + ' L ' + (cx + 2) + ',' + cy + ' L ' + (cx - 1.2) + ',' + (cy + 2) + ' Z').fill();
  } else if (type === 'whatsapp') {
    doc.lineWidth(0.85);
    doc.circle(cx, cy - 0.3, 5.2).stroke();
    doc.path('M ' + (cx - 3.2) + ',' + (cy + 3.2) + ' L ' + (cx - 4.6) + ',' + (cy + 4.8) + ' L ' + (cx - 2) + ',' + (cy + 4.2)).stroke();
    doc.lineWidth(0.9).lineCap('round');
    doc.path('M ' + (cx - 1.8) + ',' + (cy - 1.5) + ' Q ' + (cx - 0.5) + ',' + (cy + 0.5) + ' ' + (cx + 1.8) + ',' + (cy + 1.8)).stroke();
  } else if (type === 'twitter') {
    doc.lineWidth(0.85);
    doc.circle(cx, cy, 5.5).stroke();
    doc.lineWidth(0.9).lineCap('round');
    doc.path('M ' + (cx - 2.8) + ',' + (cy - 2.8) + ' L ' + (cx + 2.8) + ',' + (cy + 2.8)).stroke();
    doc.path('M ' + (cx + 2.8) + ',' + (cy - 2.8) + ' L ' + (cx - 2.8) + ',' + (cy + 2.8)).stroke();
  } else if (type === 'linkedin') {
    doc.lineWidth(0.85);
    doc.roundedRect(cx - 5.5, cy - 5.5, 11, 11, 2).stroke();
    doc.circle(cx - 2.5, cy - 2.5, 0.7).fill();
    doc.path('M ' + (cx - 2.5) + ',' + (cy - 0.8) + ' L ' + (cx - 2.5) + ',' + (cy + 3.5)).stroke();
    doc.path('M ' + (cx - 0.2) + ',' + (cy - 0.8) + ' L ' + (cx - 0.2) + ',' + (cy + 3.5)).stroke();
    doc.path('M ' + (cx - 0.2) + ',' + (cy + 0.5) + ' Q ' + (cx + 1.5) + ',' + (cy - 1) + ' ' + (cx + 2.5) + ',' + (cy + 0.5) + ' L ' + (cx + 2.5) + ',' + (cy + 3.5)).stroke();
  }

  doc.restore();
}

function drawSocialIcons(doc, rightMargin, y, social = {}) {
  // Ordered platforms from setting.model.js (lines 162-170)
  const orderedPlatforms = ['instagram', 'facebook', 'pinterest', 'youtube', 'whatsapp', 'twitter', 'linkedin'];
  const active = [];

  for (const p of orderedPlatforms) {
    const url = social[p];
    if (url && typeof url === 'string' && url.trim().length > 0) {
      active.push({ type: p, url: url.trim() });
    }
  }

  // If no social links configured, display nothing
  if (active.length === 0) return;

  const iconSpacing = 16;
  const totalW = active.length * iconSpacing;
  const startX = rightMargin - totalW + 6;

  // Divider line before icons
  doc.strokeColor('#D8CBBF').lineWidth(0.8).moveTo(startX - 14, y - 1).lineTo(startX - 14, y + 11).stroke();

  // Draw each found icon with clean vector geometry and clickable link
  active.forEach((item, idx) => {
    const cx = startX + idx * iconSpacing;
    const cy = y + 4.5;
    drawProperSocialIcon(doc, item.type, cx, cy, '#8C6D46');
    doc.link(cx - 6, cy - 6, 12, 12, item.url);
  });
}

/**
 * Generates an A4 Luxury PDF invoice matching Neirah's exact visual design
 * @param {Object} order The Mongoose order document or lean object
 * @param {Object} [options]
 * @param {Object} [options.setting] Settings document from setting.model.js
 * @param {string} [options.brandName] Override brand name
 * @returns {Promise<Buffer>}
 */
async function generateInvoicePDF(order, options = {}) {
  // Fetch store setting from DB if not passed
  let setting = options.setting;
  if (!setting) {
    try {
      const Setting = require('../modules/setting/setting.model');
      setting = (await Setting.findOne({ 'meta.deletedAt': null }).lean()) || (await Setting.findOne().lean());
    } catch (_) {
      setting = null;
    }
  }

  // Pre-fetch logo image and thumbnails for items if available
  const logoUrl = setting?.logoImage?.url || setting?.mobileLogoImage?.url;
  const items = Array.isArray(order.items) ? order.items : [];
  const [logoBuffer, itemImageBuffers] = await Promise.all([
    logoUrl ? fetchImageBuffer(logoUrl) : Promise.resolve(null),
    Promise.all(
      items.map(async (item) => {
        const url = resolveItemImageUrl(item);
        if (url) {
          return await fetchImageBuffer(url);
        }
        return null;
      })
    ),
  ]);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margins: { top: 32, bottom: 25, left: 36, right: 36 },
        size: 'A4',
        bufferPages: true,
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const hasCustomFonts = setupFonts(doc);

      // Page dimensions
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const leftMargin = 36;
      const rightMargin = pageWidth - 36; // 559.28
      const contentWidth = rightMargin - leftMargin; // 523.28

      // Background warm ivory tint + subtle luxury accents
      doc.rect(0, 0, pageWidth, pageHeight).fill('#FAF7F2');
      drawCornerBotanical(doc, pageWidth);
      drawBottomBorderPattern(doc, pageWidth, pageHeight);

      let y = 34;

      const brandName = (
        options.brandName ||
        setting?.businessDetails?.companyName ||
        'NEIRAH'
      ).toUpperCase();

      // ─── 1. Header: Brand Logo & Tax Invoice Badge ───
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, leftMargin, y - 2, { fit: [130, 38] });
        } catch (_) {
          drawLotusEmblem(doc, leftMargin + 12, y + 15, '#8C6D46');
          doc.font('Serif').fontSize(20).fillColor('#2B2015').text(brandName, leftMargin + 30, y + 2, { characterSpacing: 2 });
          const brandWidth = doc.widthOfString(brandName, { characterSpacing: 2 });
          doc.font('Sans').fontSize(8).fillColor('#8C6D46').text('®', leftMargin + 30 + brandWidth + 1, y + 1);
          doc.font('Sans').fontSize(6.5).fillColor('#8C6D46').text('LUXURY JEWELLERS', leftMargin + 30, y + 25, {
            characterSpacing: 2.2,
          });
        }
      } else {
        drawLotusEmblem(doc, leftMargin + 12, y + 15, '#8C6D46');
        doc.font('Serif').fontSize(20).fillColor('#2B2015').text(brandName, leftMargin + 30, y + 2, { characterSpacing: 2 });
        const brandWidth = doc.widthOfString(brandName, { characterSpacing: 2 });
        doc.font('Sans').fontSize(8).fillColor('#8C6D46').text('®', leftMargin + 30 + brandWidth + 1, y + 1);
        doc.font('Sans').fontSize(6.5).fillColor('#8C6D46').text('LUXURY JEWELLERS', leftMargin + 30, y + 25, {
          characterSpacing: 2.2,
        });
      }

      // Vertical Divider next to logo
      const logoRightX = leftMargin + 160;
      doc.strokeColor('#D8CBBF').lineWidth(0.8).moveTo(logoRightX, y + 4).lineTo(logoRightX, y + 32).stroke();

      // Shaping Masterpieces tagline
      doc.font('Sans-Bold').fontSize(7.5).fillColor('#6E5233').text('SHAPING MASTERPIECES', logoRightX + 16, y + 8, {
        characterSpacing: 1.2,
      });
      doc.font('Sans').fontSize(7.5).fillColor('#7A5B3A').text('FINE JEWELLERY', logoRightX + 16, y + 20, {
        characterSpacing: 1.4,
      });

      // Right Badge: TAX INVOICE
      const badgeWidth = 114;
      const badgeHeight = 26;
      const badgeX = rightMargin - badgeWidth;
      doc.roundedRect(badgeX, y + 3, badgeWidth, badgeHeight, 8).fillAndStroke('#FDFBF8', '#B89F82');
      doc.font('Serif-Bold').fontSize(10.5).fillColor('#2B2015').text('TAX INVOICE', badgeX, y + 10, {
        width: badgeWidth,
        align: 'center',
        characterSpacing: 0.8,
      });

      y += 54;

      // ─── 2. Order Invoice Row ───
      doc.font('Serif-Bold').fontSize(18).fillColor('#2B2015').text('Order Invoice', leftMargin, y);
      const receivedStr = formatDateTime(order.meta?.createdAt || order.createdAt);
      doc.font('Sans-Bold').fontSize(8.5).fillColor('#2B2015').text(`Order ID: #${order.orderNumber || 'ORD-0000'}`, leftMargin, y + 23, { continued: true });
      doc.font('Sans').fillColor('#6B5E51').text(`   |   Received: ${receivedStr}`);

      // Right: Invoice No & Date
      const invoiceNo = generateInvoiceNumber(order);
      const invoiceDateStr = formatDate(order.updatedAt || order.createdAt || new Date());

      doc.font('Sans').fontSize(8.5).fillColor('#6B5E51').text('Invoice No. :', rightMargin - 205, y + 4, { width: 95, align: 'right' });
      doc.font('Sans-Bold').fontSize(8.5).fillColor('#2B2015').text(invoiceNo, rightMargin - 105, y + 4, { width: 105, align: 'right' });

      doc.font('Sans').fontSize(8.5).fillColor('#6B5E51').text('Invoice Date :', rightMargin - 205, y + 20, { width: 95, align: 'right' });
      doc.font('Sans-Bold').fontSize(8.5).fillColor('#2B2015').text(invoiceDateStr, rightMargin - 105, y + 20, { width: 105, align: 'right' });

      y += 46;

      // ─── 3. Customer Details & Shipping Address (Side-by-Side Cards) ───
      const cardWidth = (contentWidth - 14) / 2; // ~254.6pt
      const cardHeight = 84;

      // Left Card: Customer Details
      doc.roundedRect(leftMargin, y, cardWidth, cardHeight, 8).fillAndStroke('#FDFCF9', '#E8DFD3');

      // User profile icon
      doc.save();
      doc.strokeColor('#8C6D46').lineWidth(0.9);
      doc.circle(leftMargin + 18, y + 17, 3.5).stroke();
      doc.path(`M ${leftMargin + 13},${y + 26} Q ${leftMargin + 18},${y + 22} ${leftMargin + 23},${y + 26}`).stroke();
      doc.restore();

      doc.font('Serif-Bold').fontSize(10).fillColor('#2B2015').text('Customer Details', leftMargin + 28, y + 13);

      const custName =
        (order.shippingAddress?.fullName ||
          `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() ||
          order.userId?.profile?.firstName ||
          'Valued Customer'
        ).trim() || 'Valued Customer';
      const custPhone = order.customer?.phone || order.shippingAddress?.phone || 'N/A';
      const custEmail = order.customer?.email || order.shippingAddress?.email || order.userId?.auth?.email || 'N/A';

      doc.font('Sans-Bold').fontSize(10.5).fillColor('#2B2015').text(custName, leftMargin + 28, y + 30, {
        width: cardWidth - 36,
        ellipsis: true,
      });

      // Phone
      drawPhoneIcon(doc, leftMargin + 28, y + 49, '#8C6D46');
      doc.font('Sans').fontSize(8.5).fillColor('#4A3E31').text(custPhone, leftMargin + 43, y + 48);

      // Email
      drawMailIcon(doc, leftMargin + 28, y + 64, '#8C6D46');
      doc.font('Sans').fontSize(8).fillColor('#4A3E31').text(custEmail, leftMargin + 43, y + 63, {
        width: cardWidth - 52,
        ellipsis: true,
      });

      // Right Card: Shipping Address
      const rightCardX = leftMargin + cardWidth + 14;
      doc.roundedRect(rightCardX, y, cardWidth, cardHeight, 8).fillAndStroke('#FDFCF9', '#E8DFD3');

      // Pin icon
      doc.save();
      doc.strokeColor('#8C6D46').fillColor('#8C6D46').lineWidth(0.8);
      doc.circle(rightCardX + 18, y + 16, 3.5).stroke();
      doc.circle(rightCardX + 18, y + 16, 1.2).fill();
      doc.path(`M ${rightCardX + 15.5},${y + 18.5} L ${rightCardX + 18},${y + 24} L ${rightCardX + 20.5},${y + 18.5}`).fill();
      doc.restore();

      doc.font('Serif-Bold').fontSize(10).fillColor('#2B2015').text('Shipping Address', rightCardX + 28, y + 13);

      const addr = order.shippingAddress || {};
      const street = [addr.addressLine, addr.apartment].filter(Boolean).join(', ') || 'Address not specified';
      const cityStatePin = [addr.city, addr.state].filter(Boolean).join(', ') + (addr.postalCode ? ` – ${addr.postalCode}` : '');
      const country = (addr.country || 'India').toUpperCase();

      doc.font('Sans').fontSize(8.5).fillColor('#4A3E31').text(street, rightCardX + 28, y + 30, {
        width: cardWidth - 36,
        height: 14,
        ellipsis: true,
      });
      doc.font('Sans').fontSize(8.5).fillColor('#4A3E31').text(cityStatePin, rightCardX + 28, y + 46, {
        width: cardWidth - 36,
        ellipsis: true,
      });
      doc.font('Sans').fontSize(8.5).fillColor('#4A3E31').text(country, rightCardX + 28, y + 62);

      y += cardHeight + 18;

      // ─── 5. Order Items Section ───
      const itemsCount = items.length;
      doc.font('Serif-Bold').fontSize(13.5).fillColor('#2B2015').text(
        `Order Items (${itemsCount} ${itemsCount === 1 ? 'Item' : 'Items'})`,
        leftMargin,
        y
      );
      y += 20;

      // Table Header Strip (Rounded luxury header)
      const tableHeaderHeight = 24;
      doc.roundedRect(leftMargin, y, contentWidth, tableHeaderHeight, 4).fill('#EFE6DA');
      doc.font('Sans-Bold').fontSize(8.5).fillColor('#3D2E1E').text('Product', leftMargin + 12, y + 7);
      doc.font('Sans-Bold').fontSize(8.5).fillColor('#3D2E1E').text('Qty', leftMargin + 305, y + 7, { width: 40, align: 'center' });
      doc.font('Sans-Bold').fontSize(8.5).fillColor('#3D2E1E').text('Price', leftMargin + 365, y + 7, { width: 70, align: 'right' });
      doc.font('Sans-Bold').fontSize(8.5).fillColor('#3D2E1E').text('Total', leftMargin + 442, y + 7, { width: 70, align: 'right' });

      y += tableHeaderHeight + 10;

      // Inventory Line Items
      items.forEach((item, index) => {
        // Page break safety check
        if (y > 670) {
          doc.addPage();
          doc.rect(0, 0, pageWidth, pageHeight).fill('#FAF7F2');
          y = 36;
          doc.font('Serif-Bold').fontSize(12).fillColor('#2B2015').text('Order Inventory (Continued)', leftMargin, y);
          y += 16;
          doc.strokeColor('#2B2015').lineWidth(1.2).moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
          y += 8;
        }

        const itemStartY = y;
        const thumbBoxSize = 54;
        const itemImgBuf = itemImageBuffers[index];

        // Thumbnail Box
        doc.roundedRect(leftMargin, y, thumbBoxSize, thumbBoxSize, 6).fillAndStroke('#FDFCF9', '#E8DFD3');

        if (itemImgBuf) {
          try {
            doc.image(itemImgBuf, leftMargin + 3, y + 3, {
              fit: [thumbBoxSize - 6, thumbBoxSize - 6],
              align: 'center',
              valign: 'center',
            });
          } catch {
            drawDiamondFallback(doc, leftMargin, y, thumbBoxSize);
          }
        } else {
          drawDiamondFallback(doc, leftMargin, y, thumbBoxSize);
        }

        // Product Information beside thumbnail
        const textX = leftMargin + thumbBoxSize + 12;
        const textWidth = 235;
        const refDoc = item.refId;
        const itemTitle = item.title || refDoc?.basicInfo?.title || refDoc?.title || 'Fine Jewellery Masterpiece';

        doc.font('Sans-Bold').fontSize(9.5).fillColor('#2B2015').text(itemTitle, textX, y, {
          width: textWidth,
          lineGap: 1.5,
        });

        const titleHeight = doc.heightOfString(itemTitle, { width: textWidth, lineGap: 1.5 });
        let currentItemY = y + titleHeight + 4;

        const details = extractItemDetails(item);

        // Pills Row: SKU & Shape
        const itemSku = item.sku || refDoc?.sku || refDoc?.basicInfo?.sku || `RJ-${index + 1}`;
        const skuText = `SKU: ${itemSku}`;
        const shapeText = details.shape ? `Shape: ${details.shape}` : null;

        doc.font('Sans-Bold').fontSize(7);
        const skuPillW = doc.widthOfString(skuText) + 12;
        const pillH = 13;

        doc.roundedRect(textX, currentItemY, skuPillW, pillH, 4).fillAndStroke('#F5EFE6', '#E4D9CC');
        doc.fillColor('#4A3E31').text(skuText, textX + 6, currentItemY + 2.5);

        let nextPillX = textX + skuPillW + 6;
        if (shapeText) {
          const shapePillW = doc.widthOfString(shapeText) + 12;
          doc.roundedRect(nextPillX, currentItemY, shapePillW, pillH, 4).fillAndStroke('#F5EFE6', '#E4D9CC');
          doc.fillColor('#4A3E31').text(shapeText, nextPillX + 6, currentItemY + 2.5);
        }

        currentItemY += pillH + 5;

        // Attributes Line 1 (Type, Color, Clarity)
        const line1Parts = [];
        if (details.type) line1Parts.push(`Type: ${details.type}`);
        if (details.color) line1Parts.push(`Color: ${details.color}`);
        if (details.clarity) line1Parts.push(`Clarity: ${details.clarity}`);
        if (line1Parts.length > 0) {
          doc.font('Sans').fontSize(7.5).fillColor('#6B5E51').text(line1Parts.join('   |   '), textX, currentItemY);
          currentItemY += 11;
        }

        // Attributes Line 2 (Carat, Metal, Color, Size)
        const line2Parts = [];
        if (details.carat) line2Parts.push(`Carat: ${details.carat} CT`);
        if (details.purity) line2Parts.push(`Metal: ${details.purity}`);
        if (details.metalColor) line2Parts.push(`Color: ${details.metalColor}`);
        if (details.size) line2Parts.push(`Size: ${details.size}`);
        if (line2Parts.length > 0) {
          doc.font('Sans').fontSize(7.5).fillColor('#6B5E51').text(line2Parts.join('   |   '), textX, currentItemY);
          currentItemY += 12;
        }

        // Qty, Price, Total Columns aligned with row
        const rowCenterY = itemStartY + 18;
        const itemQty = item.quantity || 1;
        const itemPrice = item.price || 0;
        const itemTotalPrice = item.totalItemPrice || itemPrice * itemQty;

        doc.font('Sans').fontSize(9).fillColor('#2B2015').text(String(itemQty), leftMargin + 310, rowCenterY, {
          width: 40,
          align: 'center',
        });

        doc.font('Sans').fontSize(9).fillColor('#2B2015').text(formatCurrency(itemPrice, hasCustomFonts), leftMargin + 370, rowCenterY, {
          width: 70,
          align: 'right',
        });

        doc.font('Sans-Bold').fontSize(9.5).fillColor('#2B2015').text(formatCurrency(itemTotalPrice, hasCustomFonts), leftMargin + 445, rowCenterY, {
          width: 70,
          align: 'right',
        });

        y = Math.max(currentItemY + 6, itemStartY + thumbBoxSize + 10);
        doc.strokeColor('#E8DFD3').lineWidth(0.5).moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
        y += 12;
      });

      y += 4;

      // ─── 6. Bottom Section: Left Payment Information & Right Financial Summary Card ───
      const bottomY = y + 4;
      const summaryBoxWidth = 240;
      const summaryBoxX = rightMargin - summaryBoxWidth;
      const leftBoxWidth = 245;

      // Left Column: Payment Information Card
      drawCardIcon(doc, leftMargin, bottomY + 14, '#8C6D46');
      doc.font('Serif-Bold').fontSize(12).fillColor('#2B2015').text('Payment Information', leftMargin + 18, bottomY + 12);

      const isCod = order.payment?.method === 'cod';
      const payMethodStatus = isCod ? 'Cash On Delivery' : `Online (${order.payment?.status === 'paid' ? 'Paid' : 'Pending'})`;
      doc.roundedRect(leftMargin, bottomY + 34, leftBoxWidth, 32, 8).fillAndStroke('#FBF8F3', '#E4D9CB');
      doc.font('Sans').fontSize(8.5).fillColor('#6B5E51').text('Payment Method', leftMargin + 14, bottomY + 45);
      doc.font('Sans-Bold').fontSize(8.5).fillColor('#2B2015').text(payMethodStatus, leftMargin, bottomY + 45, {
        width: leftBoxWidth - 14,
        align: 'right',
      });

      // Right Column: Financial Summary Card
      const pricing = order.pricing || {};
      const subtotal = pricing.subtotal || 0;
      const discount = pricing.discount || order.coupon?.discountAmount || 0;
      const tax = pricing.tax ?? Math.round(subtotal * 0.03);
      const shipping = pricing.shipping || 0;
      const grandTotal = pricing.total ?? (subtotal - discount + tax + shipping);

      const summaryRows = [
        { label: 'Subtotal', value: formatCurrency(subtotal, hasCustomFonts), isGreen: false },
        ...(discount > 0 ? [{ label: 'Coupon Discount', value: `-${formatCurrency(discount, hasCustomFonts)}`, isGreen: true }] : []),
        { label: 'Estimated GST (3%)', value: formatCurrency(tax, hasCustomFonts), isGreen: false },
        { label: 'Shipping', value: shipping === 0 ? 'FREE' : formatCurrency(shipping, hasCustomFonts), isGreen: shipping === 0 },
      ];

      const totalBoxH = 34;
      const summaryBodyH = summaryRows.length * 18 + 14;
      const totalCardH = summaryBodyH + totalBoxH;

      // Card Background & Border
      doc.roundedRect(summaryBoxX, bottomY, summaryBoxWidth, totalCardH, 8).fillAndStroke('#FDFCF9', '#E4D9CB');

      // Draw rows
      let sY = bottomY + 12;
      summaryRows.forEach((r) => {
        doc.font('Sans').fontSize(8.5).fillColor(r.isGreen ? '#1E7E34' : '#4A3E31').text(r.label, summaryBoxX + 14, sY);
        doc.font('Sans-Bold').fontSize(8.5).fillColor(r.isGreen ? '#1E7E34' : '#2B2015').text(r.value, summaryBoxX, sY, {
          width: summaryBoxWidth - 14,
          align: 'right',
        });
        sY += 18;
      });

      // Total Amount Dark Bronze Accent Bar at bottom of card
      const totalBarY = bottomY + summaryBodyH;
      doc.save();
      doc.roundedRect(summaryBoxX, totalBarY, summaryBoxWidth, totalBoxH, 8).fill('#826644');
      doc.rect(summaryBoxX, totalBarY, summaryBoxWidth, 8).fill('#826644');
      doc.restore();

      doc.font('Serif-Bold').fontSize(11.5).fillColor('#FFFFFF').text('Total Amount', summaryBoxX + 14, totalBarY + 10);
      doc.font('Sans-Bold').fontSize(12.5).fillColor('#FFFFFF').text(formatCurrency(grandTotal, hasCustomFonts), summaryBoxX, totalBarY + 9, {
        width: summaryBoxWidth - 14,
        align: 'right',
      });

      // ─── 7. Luxury Diamond Divider & Thank-You Section ───
      const dividerY = Math.max(bottomY + totalCardH + 26, 680);
      const midX = pageWidth / 2;
      doc.strokeColor('#DFD4C6').lineWidth(0.8).moveTo(leftMargin, dividerY).lineTo(midX - 16, dividerY).stroke();
      doc.strokeColor('#DFD4C6').lineWidth(0.8).moveTo(midX + 16, dividerY).lineTo(rightMargin, dividerY).stroke();

      // Center diamond icon on divider
      doc.save();
      doc.strokeColor('#8C6D46').lineWidth(0.8);
      doc.path(`M ${midX - 5},${dividerY - 4} L ${midX + 5},${dividerY - 4} L ${midX + 8},${dividerY} L ${midX},${dividerY + 7} L ${midX - 8},${dividerY} Z`).stroke();
      doc.moveTo(midX - 8, dividerY).lineTo(midX + 8, dividerY).stroke();
      doc.moveTo(midX - 5, dividerY - 4).lineTo(midX, dividerY + 7).lineTo(midX + 5, dividerY - 4).stroke();
      doc.restore();

      // Brand & Thank You Row
      const tyY = dividerY + 18;
      doc.font('Serif').fontSize(17).fillColor('#2B2015').text(brandName, leftMargin, tyY, { characterSpacing: 2 });
      const tyBrandW = doc.widthOfString(brandName, { characterSpacing: 2 });
      doc.font('Sans').fontSize(7.5).fillColor('#8C6D46').text('®', leftMargin + tyBrandW + 1, tyY);
      doc.font('Sans').fontSize(6.5).fillColor('#6B5E51').text('LUXURY JEWELLERS', leftMargin, tyY + 21, {
        characterSpacing: 2,
      });

      const tyDividerX = leftMargin + 150;
      doc.strokeColor('#D8CBBF').lineWidth(0.8).moveTo(tyDividerX, tyY + 2).lineTo(tyDividerX, tyY + 36).stroke();

      doc.font('Serif-Bold').fontSize(11).fillColor('#2B2015').text('Thank you for your purchase!', tyDividerX + 20, tyY);
      doc.font('Sans').fontSize(8.5).fillColor('#4A3E31').text(
        'We truly appreciate your trust in Neirah Jewellers.',
        tyDividerX + 20,
        tyY + 15
      );
      doc.font('Sans').fontSize(8.5).fillColor('#4A3E31').text(
        'For any assistance, feel free to contact our support team.',
        tyDividerX + 20,
        tyY + 27
      );

      // ─── 8. Footer Contact Bar at Bottom ───
      const footerY = 778;

      const bDetails = setting?.businessDetails || {};
      const mobileNumber = bDetails.mobileNumber || '+91 84600 91955';
      const emailAddress = bDetails.emailAddress || 'support@neirah.in';

      let website = 'www.neirah.in';
      if (emailAddress && emailAddress.includes('@')) {
        const domain = emailAddress.split('@')[1];
        if (domain && domain.includes('.')) {
          website = domain.startsWith('www.') ? domain : `www.${domain}`;
        }
      }

      const fTextY = footerY + 6;
      doc.font('Sans').fontSize(8.5);
      const phoneW = doc.widthOfString(mobileNumber);
      const emailW = doc.widthOfString(emailAddress);
      const websiteW = doc.widthOfString(website);

      const phoneItemW = 14 + phoneW;
      const emailItemW = 16 + emailW;
      const websiteItemW = 15 + websiteW;
      const itemGap = 28;

      const totalFooterW = phoneItemW + itemGap + emailItemW + itemGap + websiteItemW;
      let curX = Math.round((pageWidth - totalFooterW) / 2);

      // Phone
      drawPhoneIcon(doc, curX, fTextY + 1, '#8C6D46');
      doc.font('Sans').fontSize(8.5).fillColor('#4A3E31');
      doc.text(mobileNumber, curX + 14, fTextY, { lineBreak: false });
      const cleanPhone = mobileNumber.replace(/\s+/g, '');
      doc.link(curX + 14, fTextY - 1, phoneW, 11, `tel:${cleanPhone}`);
      curX += phoneItemW;
      doc.strokeColor('#D8CBBF').lineWidth(0.7).moveTo(curX + itemGap / 2, fTextY - 1).lineTo(curX + itemGap / 2, fTextY + 11).stroke();
      curX += itemGap;

      // Email
      drawMailIcon(doc, curX, fTextY + 1.5, '#8C6D46');
      doc.font('Sans').fontSize(8.5).fillColor('#4A3E31');
      doc.text(emailAddress, curX + 16, fTextY, { lineBreak: false });
      doc.link(curX + 16, fTextY - 1, emailW, 11, `mailto:${emailAddress}`);
      curX += emailItemW;
      doc.strokeColor('#D8CBBF').lineWidth(0.7).moveTo(curX + itemGap / 2, fTextY - 1).lineTo(curX + itemGap / 2, fTextY + 11).stroke();
      curX += itemGap;

      // Website
      drawGlobeIcon(doc, curX, fTextY + 0.5, '#8C6D46');
      doc.font('Sans').fontSize(8.5).fillColor('#4A3E31');
      doc.text(website, curX + 15, fTextY, { lineBreak: false });
      const webUrl = website.startsWith('http') ? website : `https://${website}`;
      doc.link(curX + 15, fTextY - 1, websiteW, 11, webUrl);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateInvoicePDF,
  formatCurrency,
  formatDate,
};
