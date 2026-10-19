const axios = require('axios');
const Category = require('../category/category.model');

const ORNATE_BASE_URL = process.env.ORNATE_BASE_URL || 'http://142.79.228.244:2507/OnlineJewelleryShopping';
const ORNATE_USERNAME = process.env.ORNATE_USERNAME || 'admin';
const ORNATE_PASSWORD = process.env.ORNATE_PASSWORD || 'admin@123';
const ORNATE_TIMEOUT = Number(process.env.ORNATE_TIMEOUT) || 45000;

// ------------------------------- session & token cache ----------------------------
let lastSessionId = '0';
let cachedOrnateToken = null;
let tokenExpiry = 0;

function getLastSessionId() {
  return lastSessionId;
}

function setLastSessionId(id) {
  if (id) lastSessionId = String(id);
}

function clearCachedOrnateToken() {
  cachedOrnateToken = null;
  tokenExpiry = 0;
}

/**
 * Generates or returns cached Ornate ERP bearer token
 */
async function getOrnateToken(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && cachedOrnateToken && now < tokenExpiry) {
    return cachedOrnateToken;
  }

  try {
    const response = await axios.post(
      `${ORNATE_BASE_URL}/GenerateToken_API`,
      {
        Token: [
          {
            UserName: ORNATE_USERNAME,
            Password: ORNATE_PASSWORD,
          },
        ],
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: ORNATE_TIMEOUT }
    );

    const status = response.data?.Status?.[0]?.Status;
    const token = response.data?.Token?.[0]?.Token;

    if (status === 'Sucess' && token) {
      cachedOrnateToken = token;
      tokenExpiry = now + 23 * 60 * 60 * 1000; // Cache for 23 hours
      return token;
    } else {
      throw new Error(`Ornate ERP rejected token generation: ${JSON.stringify(response.data?.Status || response.data)}`);
    }
  } catch (err) {
    clearCachedOrnateToken();
    console.error('[Ornate NX] GenerateToken failed:', err.message);
    throw new Error(`Ornate Token Generation Failed: ${err.message}`);
  }
}

/**
 * Generic helper for Ornate ERP POST APIs with automatic token handling and 401 retry.
 */
async function callOrnateApi(endpoint, wrapperKey, data = {}, timeout = ORNATE_TIMEOUT) {
  let token = await getOrnateToken();

  const sendRequest = (authToken) =>
    axios.post(
      `${ORNATE_BASE_URL}/${endpoint}`,
      {
        [wrapperKey]: [
          {
            UserName: ORNATE_USERNAME,
            Password: ORNATE_PASSWORD,
            Token: authToken,
            ...data,
          },
        ],
      },
      { headers: { 'Content-Type': 'application/json' }, timeout }
    );

  try {
    const response = await sendRequest(token);
    return response.data;
  } catch (err) {
    const isTokenErr =
      err.response?.status === 401 ||
      (err.message && err.message.toLowerCase().includes('token'));
    if (isTokenErr) {
      token = await getOrnateToken(true);
      const retryResponse = await sendRequest(token);
      return retryResponse.data;
    }
    throw err;
  }
}

/**
 * Reusable helper to fetch Ornate label data by sessionId (GetLabelData_API).
 */
async function fetchOrnateLabelData(sessionId = '0') {
  return callOrnateApi(
    'GetLabelData_API',
    'LabelDetail',
    { LastSessionId: String(sessionId) },
    60000
  );
}

/**
 * Fetch active event list from Ornate ERP
 */
async function getOrnateEvents() {
  return callOrnateApi('GetEventData_API', 'EventList');
}

/**
 * Resolve existing category by GroupName (DO NOT auto-create)
 */
async function resolveCategory(groupName, categoryCache) {
  if (!groupName || typeof groupName !== 'string') return null;
  const name = groupName.trim();
  if (!name) return null;
  const cacheKey = name.toLowerCase();

  if (categoryCache && categoryCache.has(cacheKey)) {
    return categoryCache.get(cacheKey);
  }

  // Only match existing categories in our catalog - NEVER auto-create new categories
  let cat = await Category.findOne({
    name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  });

  if (!cat) {
    // Optional plural match (e.g. "Ring" -> "Rings")
    cat = await Category.findOne({
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?$`, 'i') },
    });
  }

  const resultId = cat?._id || null;
  if (categoryCache) {
    categoryCache.set(cacheKey, resultId);
  }
  return resultId;
}

/**
 * Extracts SKU and standard identifier fields from an Ornate ERP label
 */
function extractLabelIdentifiers(label = {}) {
  const uniqueLabelID = label.UniqueLabelID ? String(label.UniqueLabelID).trim() : '';
  const barcodeNo = label.BarcodeNo ? String(label.BarcodeNo).trim() : '';
  const labelNo = label.LabelNo ? String(label.LabelNo).trim() : '';
  const sku = uniqueLabelID || barcodeNo || labelNo;
  const tagNo = labelNo || uniqueLabelID;
  const barcode = barcodeNo;

  return { uniqueLabelID, barcodeNo, labelNo, sku, tagNo, barcode };
}

/**
 * Computes salePrice and MRP from an Ornate ERP label
 */
function calculateLabelPrice(label = {}) {
  const salePrice =
    Number(label.TodaysSalesValue) ||
    Number(label.TotalSalesAmt) ||
    Number(label.GoldAmt) ||
    Number(label.MRP) ||
    0;

  const mrp = Number(label.MRP) || salePrice;
  return { salePrice, mrp };
}

/**
 * Maps studded detail records for a given label ID
 */
function mapStuddedDetails(studdedDetails = [], uniqueLabelID = '', barcodeNo = '') {
  if (!Array.isArray(studdedDetails) || studdedDetails.length === 0) return [];
  const uId = String(uniqueLabelID).toLowerCase();
  const bNo = String(barcodeNo).toLowerCase();

  return studdedDetails
    .filter((s) => {
      const sId = String(s.UniqueLabelId || '').toLowerCase();
      return (uId && sId === uId) || (bNo && sId === bNo);
    })
    .map((s) => ({
      stoneName: s.StyleName || s.MetalName || 'Stone',
      pieces: Number(s.Pcs) || 0,
      caratWeight: Number(s.NetWt) || Number(s.GrossWt) || 0,
      rate: Number(s.Rate) || 0,
      amount: Number(s.Amount) || 0,
      clarity: s.Clarity || '',
      color: s.Colour || '',
      cut: s.CutShape || '',
      shape: s.CutShape || '',
    }));
}

/**
 * Generates SEO slug from title and SKU
 */
function generateProductSlug(title = '', sku = '') {
  return `${title}-${sku}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds the complete MongoDB product payload strictly aligned with product.model.js
 */
function buildProductPayloadFromLabel(label, {
  existingProduct = null,
  categoryId = null,
  newlyUploadedImages = [],
} = {}) {
  const { sku, tagNo, barcode } = extractLabelIdentifiers(label);
  const { salePrice, mrp } = calculateLabelPrice(label);

  const title = label.ItemName?.trim() || label.GroupName?.trim() || `Ornate Jewellery ${sku}`;
  const inStockQty = (label.InStock ?? 1) > 0 ? (Number(label.Pcs) || 1) : 0;
  const isSold = label.InStock === 0 || inStockQty === 0;
  const description = label.Remark || label.ItemName || '';
  const gstPercentage = Number(label.GSTPer) || 3;
  const baseMetalWeight = Number(label.NetWt) || Number(label.GrossWt) || 0;
  const baseLabourCharge = Number(label.LabourAmt) || 0;
  const goldAmt = Number(label.GoldAmt) || 0;
  const diamondAmt = Number(label.DiamondAmt) || 0;
  const itemCode = label.ItemMstId ? String(label.ItemMstId) : '';

  const generatedSlug = generateProductSlug(title, sku);
  const activeSlug = existingProduct?.basicInfo?.slug || generatedSlug;

  const setFields = {
    // Structured Product Blocks (matching product.model.js)
    basicInfo: {
      title,
      sku,
      slug: activeSlug,
      description,
      remark: label.Remark || '',
      productType: 'silver',
      isOrnate: true,
    },
    pricing: {
      mrp,
      salePrice,
      costPrice: Number(label.TotalCostAmt) || 0,
      ornatePrice: mrp || salePrice || 0,
      gstPercentage,
      markupPercentage: 0,
      mrpMarkupPercentage: 0,
    },
    specifications: {
      metalWeight: baseMetalWeight,
    },
    ornate: {
      tagNo,
      barcode,
      itemCode,
      customGroupName: label.ItemName || label.GroupName || '',
      companyCode: label.CompanyCode || '',
      carat: label.Carat || '',
      groupName: label.GroupName || '',
      metalName: label.MetalName || '',
      remark: label.Remark || '',
      ornateImages: Array.isArray(newlyUploadedImages) && newlyUploadedImages.length > 0
        ? newlyUploadedImages
        : (existingProduct?.ornate?.ornateImages || []),
      goldAmt,
      labourAmt: baseLabourCharge,
      diamondAmt,
      stockQty: inStockQty,
      isSold,
    },

    // Core schema fields
    productType: 'silver',
    isOrnate: true,
    remark: label.Remark || '',
    gstPercentage,
    baseMetalWeight,
    baseLabourCharge,
    stockStatus: isSold ? 'Out of Stock' : 'In Stock',
    categoryIds: categoryId ? [categoryId] : [],
  };

  if (Array.isArray(newlyUploadedImages) && newlyUploadedImages.length > 0) {
    setFields.images = newlyUploadedImages;
  }

  return {
    sku,
    title,
    generatedSlug,
    setFields,
  };
}

module.exports = {
  ORNATE_BASE_URL,
  ORNATE_USERNAME,
  ORNATE_PASSWORD,
  ORNATE_TIMEOUT,
  getLastSessionId,
  setLastSessionId,
  getOrnateToken,
  clearCachedOrnateToken,
  callOrnateApi,
  fetchOrnateLabelData,
  getOrnateEvents,
  resolveCategory,
  extractLabelIdentifiers,
  calculateLabelPrice,
  mapStuddedDetails,
  generateProductSlug,
  buildProductPayloadFromLabel,
};
