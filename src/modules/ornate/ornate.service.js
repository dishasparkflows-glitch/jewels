const axios = require('axios');
const ftp = require('basic-ftp');
const { Writable } = require('stream');
const path = require('path');
const Product = require('../product/product.model');
const Category = require('../category/category.model');
const cloudflareR2 = require('../../utils/cloudflareR2');

const ORNATE_BASE_URL = process.env.ORNATE_BASE_URL || 'http://142.79.228.244:2507/OnlineJewelleryShopping';
const ORNATE_USERNAME = process.env.ORNATE_USERNAME || 'admin';
const ORNATE_PASSWORD = process.env.ORNATE_PASSWORD || 'admin@123';
const ORNATE_TIMEOUT = Number(process.env.ORNATE_TIMEOUT) || 45000;

// ------------------------------- session tracker ----------------------------
let lastSessionId = '0';

// ------------------------------- token cache ----------------------------
let cachedOrnateToken = null;
let tokenExpiry = 0;

// ------------------------------- clear cached ornate token ----------------------------
function clearCachedOrnateToken() {
  cachedOrnateToken = null;
  tokenExpiry = 0;
  console.log('[Ornate NX] Token cache cleared');
}

// ------------------------------- get or generate ornate token ----------------------------
async function getOrnateToken(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && cachedOrnateToken && now < tokenExpiry) {
    return cachedOrnateToken;
  }

  try {
    console.log('[Ornate NX] Requesting auth token from ERP...');
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
      console.log('[Ornate NX] ✅ Token generated successfully:', token);
      return token;
    } else {
      throw new Error(`Ornate ERP rejected token generation: ${JSON.stringify(response.data?.Status || response.data)}`);
    }
  } catch (err) {
    clearCachedOrnateToken();
    console.error('[Ornate NX] ❌ GenerateToken failed:', err.message);
    throw new Error(`Ornate Token Generation Failed: ${err.message}`);
  }
}

// ------------------------------- get active event list ----------------------------
// EventId: 1 = Tag Added/Modified, 3 = Tag Sold, 4 = Metal Rate Changed
async function getOrnateEvents() {
  const token = await getOrnateToken();

  const response = await axios.post(
    `${ORNATE_BASE_URL}/GetEventData_API`,
    {
      EventList: [
        {
          UserName: ORNATE_USERNAME,
          Password: ORNATE_PASSWORD,
          Token: token,
        },
      ],
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: ORNATE_TIMEOUT }
  );

  return response.data;
}

// ------------------------------- get ornate erp categories ----------------------------
/**
 * Fetches all product categories (GroupName) from Ornate ERP without downloading images.
 * Returns distinct categories with product counts, metals, and sample item types.
 */
async function getOrnateErpCategories() {
  let token = await getOrnateToken();

  console.log('[Ornate NX] Fetching ERP labels to extract categories...');
  let response;
  try {
    response = await axios.post(
      `${ORNATE_BASE_URL}/GetLabelData_API`,
      {
        LabelDetail: [
          {
            UserName: ORNATE_USERNAME,
            Password: ORNATE_PASSWORD,
            Token: token,
            LastSessionId: '0',
          },
        ],
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
    );
  } catch (err) {
    const isTokenErr = err.response?.status === 401 || (err.message && err.message.toLowerCase().includes('token'));
    if (isTokenErr) {
      console.warn('[Ornate NX] Token may be expired/rejected, refreshing token and retrying category fetch...');
      token = await getOrnateToken(true);
      response = await axios.post(
        `${ORNATE_BASE_URL}/GetLabelData_API`,
        {
          LabelDetail: [
            {
              UserName: ORNATE_USERNAME,
              Password: ORNATE_PASSWORD,
              Token: token,
              LastSessionId: '0',
            },
          ],
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
      );
    } else {
      throw err;
    }
  }

  const status = response.data?.Status?.[0]?.Status;
  if (status !== 'Sucess') {
    clearCachedOrnateToken();
    throw new Error(`Ornate ERP failed to return label data: ${JSON.stringify(response.data?.Status || response.data)}`);
  }

  const labelDetails = response.data?.LabelDetail || [];
  const groupMap = new Map();

  for (const label of labelDetails) {
    const groupName = (label.GroupName || 'Uncategorized').trim();
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, {
        name: groupName,
        count: 0,
        itemTypes: new Set(),
        metals: new Set(),
        products: [],
      });
    }

    const group = groupMap.get(groupName);
    group.count += 1;
    if (label.ItemName) {
      group.itemTypes.add(label.ItemName.trim());
    }
    if (label.MetalName) {
      group.metals.add(label.MetalName.trim());
    }

    const uniqueLabelID = label.UniqueLabelID || label.BarcodeNo || label.LabelNo || '';
    const price =
      label.TodaysSalesValue ||
      label.TotalSalesAmt ||
      label.GoldAmt ||
      label.MRP ||
      0;

    group.products.push({
      uniqueLabelID,
      barcodeNo: label.BarcodeNo || '',
      labelNo: label.LabelNo || '',
      itemName: label.ItemName || '',
      groupName,
      grossWt: label.GrossWt || 0,
      netWt: label.NetWt || 0,
      price,
      metalName: label.MetalName || '',
      carat: label.Carat || '',
      inStock: label.InStock ?? 1,
    });
  }

  const categories = Array.from(groupMap.values()).map(g => ({
    name: g.name,
    count: g.count,
    itemTypes: Array.from(g.itemTypes).slice(0, 5),
    metals: Array.from(g.metals),
    products: g.products,
  })).sort((a, b) => b.count - a.count);

  return {
    totalProducts: labelDetails.length,
    categories,
  };
}

// ------------------------------- resolve or create category ----------------------------
async function resolveCategory(groupName, categoryCache) {
  if (!groupName || typeof groupName !== 'string') return null;
  const name = groupName.trim();
  if (!name) return null;
  const cacheKey = name.toLowerCase();

  if (categoryCache.has(cacheKey)) {
    return categoryCache.get(cacheKey);
  }

  let cat = await Category.findOne({
    name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    isDeleted: false,
  });

  if (!cat) {
    try {
      cat = await Category.create({
        name,
        type: 'category',
        status: 'active',
      });
      console.log(`[Ornate NX] Auto-created category for "${name}"`);
    } catch {
      cat = await Category.findOne({
        name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });
    }
  }

  if (cat?._id) {
    categoryCache.set(cacheKey, cat._id);
    return cat._id;
  }
  return null;
}

// ------------------------------- sync ornate labels ----------------------------
/**
 * Syncs Ornate ERP labels directly into the main Product table with `isOrnate: true`.
 * Downloads & uploads images to Cloudflare R2 only if product doesn't already have images.
 */
async function syncOrnateLabels(sessionIdOverride, options = null) {
  const token = await getOrnateToken();
  const sessionIdToPass = sessionIdOverride !== undefined ? sessionIdOverride : lastSessionId;

  console.log(`[Ornate NX] Syncing labels with LastSessionId: ${sessionIdToPass}...`);

  const response = await axios.post(
    `${ORNATE_BASE_URL}/GetLabelData_API`,
    {
      LabelDetail: [
        {
          UserName: ORNATE_USERNAME,
          Password: ORNATE_PASSWORD,
          Token: token,
          LastSessionId: sessionIdToPass,
        },
      ],
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
  );

  const status = response.data?.Status?.[0]?.Status;
  if (status !== 'Sucess') {
    clearCachedOrnateToken();
    console.error('[Ornate NX] GetLabelData_API returned failure:', response.data);
    return { success: false, count: 0, message: 'Ornate API returned failure' };
  }

  const labelDetails = response.data?.LabelDetail || [];
  const studdedDetails = response.data?.StuddedDetail || [];
  const newSessionId = response.data?.Session?.[0]?.SessionId;

  if (newSessionId) {
    lastSessionId = newSessionId;
    console.log(`[Ornate NX] Updated LastSessionId to: ${lastSessionId}`);
  }

  if (labelDetails.length === 0) {
    console.log('[Ornate NX] No new labels to sync.');
    return { success: true, count: 0, lastSessionId };
  }

  // Filter by productIds or categories if provided
  let labelsToProcess = labelDetails;
  let targetProductIds = null;
  let targetCategories = null;

  if (options) {
    if (Array.isArray(options)) {
      targetCategories = options;
    } else if (typeof options === 'object') {
      targetProductIds = options.productIds;
      targetCategories = options.categories;
    }
  }

  if (Array.isArray(targetProductIds) && targetProductIds.length > 0) {
    const idSet = new Set(targetProductIds.map(id => String(id).trim().toLowerCase()));
    labelsToProcess = labelDetails.filter(l => {
      const uId = String(l.UniqueLabelID || '').trim().toLowerCase();
      const bNo = String(l.BarcodeNo || '').trim().toLowerCase();
      const lNo = String(l.LabelNo || '').trim().toLowerCase();
      return (uId && idSet.has(uId)) || (bNo && idSet.has(bNo)) || (lNo && idSet.has(lNo));
    });
    console.log(`[Ornate NX] Filtering by ${targetProductIds.length} product IDs: ${labelsToProcess.length} of ${labelDetails.length} match.`);
  } else if (Array.isArray(targetCategories) && targetCategories.length > 0) {
    const selectedNormalized = new Set(targetCategories.map(c => String(c).trim().toLowerCase()));
    labelsToProcess = labelDetails.filter(l => l.GroupName && selectedNormalized.has(String(l.GroupName).trim().toLowerCase()));
    console.log(`[Ornate NX] Filtering by ${targetCategories.length} categories: ${labelsToProcess.length} of ${labelDetails.length} match.`);
  }

  if (labelsToProcess.length === 0) {
    console.log('[Ornate NX] No labels matching the criteria to sync.');
    return { success: true, count: 0, message: 'No labels matching the selected criteria', lastSessionId };
  }

  let upsertedCount = 0;
  let errorCount = 0;
  const errors = [];
  const categoryCache = new Map();

  // Setup FTP for downloading images directly to Cloudflare R2
  const ftpClient = new ftp.Client();
  ftpClient.ftp.verbose = false;
  ftpClient.ftp.timeout = 15000;
  let ftpConnected = false;

  try {
    await ftpClient.access({
      host: process.env.ORNATE_FTP_HOST || '142.79.228.244',
      user: process.env.ORNATE_FTP_USER || 'ecomm',
      password: process.env.ORNATE_FTP_PASSWORD || 'nx@123',
      port: Number(process.env.ORNATE_FTP_PORT) || 2166,
      secure: false,
    });
    ftpConnected = true;
    console.log('[Ornate NX] ✅ FTP Connected for image syncing.');
  } catch (err) {
    console.error('[Ornate NX] ⚠️ FTP connection failed for image sync:', err.message);
  }

  for (const label of labelsToProcess) {
    try {
      const uniqueLabelID = label.UniqueLabelID ? String(label.UniqueLabelID).trim() : '';
      const barcodeNo = label.BarcodeNo ? String(label.BarcodeNo).trim() : '';
      const labelNo = label.LabelNo ? String(label.LabelNo).trim() : '';
      const sku = uniqueLabelID || barcodeNo || labelNo;

      if (!sku) continue;

      // Compute final salePrice (use first available price field)
      const salePrice =
        Number(label.TodaysSalesValue) ||
        Number(label.TotalSalesAmt) ||
        Number(label.GoldAmt) ||
        Number(label.MRP) ||
        0;

      const mrp = Number(label.MRP) || salePrice;

      // Match studded details for this label
      const labelStudded = studdedDetails
        .filter((s) => s.UniqueLabelId === uniqueLabelID || s.UniqueLabelId === barcodeNo)
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

      // Check if product already exists in Product table and has images
      const matchCriteria = [];
      if (uniqueLabelID) matchCriteria.push({ uniqueLabelID });
      if (barcodeNo) matchCriteria.push({ barcodeNo });
      if (labelNo) matchCriteria.push({ labelNo });
      if (sku) matchCriteria.push({ sku });

      const existingProduct = await Product.findOne({ $or: matchCriteria })
        .select('ornateImages images sku uniqueLabelID barcodeNo labelNo slug')
        .lean();

      const hasOrnateImages =
        existingProduct &&
        ((Array.isArray(existingProduct.ornateImages) && existingProduct.ornateImages.length > 0) ||
         (Array.isArray(existingProduct.images) && existingProduct.images.length > 0));

      // Download from FTP and upload to Cloudflare R2 only if NO images exist yet
      const newlyUploadedImages = [];
      if (!hasOrnateImages && ftpConnected) {
        const rawPaths = [
          label.ImagePath1,
          label.ImagePath2,
          label.ImagePath3,
          label.ImagePath4,
          label.ImagePath5,
        ].filter(p => typeof p === 'string' && p.trim().length > 0);

        if (rawPaths.length > 0) {
          for (const rawPath of rawPaths) {
            try {
              const cleanPath = '/' + rawPath.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '');
              const chunks = [];
              const writable = new Writable({
                write(chunk, encoding, callback) {
                  chunks.push(chunk);
                  callback();
                },
              });

              await ftpClient.downloadTo(writable, cleanPath);
              const buffer = Buffer.concat(chunks);

              if (buffer && buffer.length > 0) {
                const filename = path.basename(cleanPath);
                const r2Data = await cloudflareR2.uploadBuffer(buffer, filename, 'OrnateProducts', 'image/jpeg');

                newlyUploadedImages.push({
                  url: r2Data.url,
                  public_id: r2Data.public_id,
                  mediaType: 'image',
                });
              }
            } catch (imgErr) {
              console.warn(`[Ornate NX] FTP image skipped ${rawPath} (${sku}): ${imgErr.message}`);
            }
          }
        }
      }

      // Resolve category
      const categoryId = await resolveCategory(label.GroupName, categoryCache);

      const title = label.ItemName?.trim() || label.GroupName?.trim() || `Ornate Jewellery ${sku}`;
      const inStockQty = (label.InStock ?? 1) > 0 ? (Number(label.Pcs) || 1) : 0;
      const isSold = label.InStock === 0 || inStockQty === 0;

      const setFields = {
        title,
        sku,
        tagNo: labelNo || uniqueLabelID,
        labelNo,
        barcode: barcodeNo,
        barcodeNo,
        uniqueLabelID,
        rfid: label.RFID || '',
        huid: label.HUID || '',
        companyCode: label.CompanyCode || '',
        itemCode: label.ItemMstId ? String(label.ItemMstId) : '',
        itemName: label.ItemName || '',
        groupName: label.GroupName || '',
        varietyName: label.VarietyName || '',
        metalName: label.MetalName || '',
        carat: label.Carat || '',
        purity: Number(label.Purity) || 0,
        grossWt: Number(label.GrossWt) || 0,
        netWt: Number(label.NetWt) || 0,
        fineWt: Number(label.FineWt) || 0,
        wastageWt: Number(label.SalWastWt || label.WastageWt) || 0,
        salesWastAmt: Number(label.SalesWastAmt) || 0,
        stoneWt: Number(label.StoneWt) || 0,
        stonePcs: Number(label.StonePcs) || 0,
        diamondWt: Number(label.DiamondWt) || 0,
        diamondPcs: Number(label.DiamondPcs) || 0,
        pcs: Number(label.Pcs) || 1,
        goldRate: Number(label.GoldRate) || 0,
        metalRate: Number(label.MetalRate) || 0,
        goldAmt: Number(label.GoldAmt) || 0,
        labourAmt: Number(label.LabourAmt) || 0,
        diamondAmt: Number(label.DiamondAmt) || 0,
        stoneAmt: Number(label.StoneAmt) || 0,
        gstPer: Number(label.GSTPer) || 3,
        gstAmt: Number(label.GSTAmt) || 0,
        totalSalesAmt: Number(label.TotalSalesAmt) || 0,
        todaysSalesValue: Number(label.TodaysSalesValue) || 0,
        mrp,
        price: mrp || salePrice,
        salePrice,
        displayPrice: salePrice,
        inStock: label.InStock ?? 1,
        stockQty: inStockQty,
        stockStatus: isSold ? 'Out of Stock' : 'In Stock',
        isSold,
        inapp: true,
        inweb: true,
        isOrnate: true,
        productType: 'ornate',
        studdedDetails: labelStudded,
        lastSyncedAt: new Date(),
        sessionId: newSessionId || lastSessionId,
      };

      if (categoryId) {
        setFields.category = [categoryId];
      }

      if (newlyUploadedImages.length > 0) {
        setFields.ornateImages = newlyUploadedImages;
        setFields.images = newlyUploadedImages;
      }

      const generatedSlug = (title + '-' + sku)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Upsert into Product collection with 1 flag: isOrnate: true
      await Product.findOneAndUpdate(
        { $or: matchCriteria },
        {
          $set: setFields,
          $setOnInsert: {
            slug: generatedSlug,
            status: 'active',
            isDeleted: false,
            description: label.Remark || label.ItemName || '',
            customGroupName: label.ItemName || '',
          },
        },
        { upsert: true, returnDocument: 'after', runValidators: false }
      );

      upsertedCount++;
    } catch (err) {
      errorCount++;
      errors.push(`${label.UniqueLabelID || label.BarcodeNo || 'unknown'}: ${err.message}`);
    }
  }

  if (ftpConnected) {
    try {
      ftpClient.close();
    } catch {}
  }

  console.log(`[Ornate NX] ✅ Label sync complete. Upserted: ${upsertedCount}, Errors: ${errorCount}`);
  return {
    success: true,
    count: upsertedCount,
    errorCount,
    errors: errors.slice(0, 20),
    lastSessionId,
  };
}

// ------------------------------- sync ornate sold labels ----------------------------
/**
 * Marks physically sold items as unavailable/out of stock in the Product table.
 */
async function syncOrnateSoldLabels() {
  const token = await getOrnateToken();

  console.log('[Ornate NX] Fetching sold labels from Ornate ERP...');

  const response = await axios.post(
    `${ORNATE_BASE_URL}/GetSoldLabelData_API`,
    {
      SoldLabel: [
        {
          UserName: ORNATE_USERNAME,
          Password: ORNATE_PASSWORD,
          Token: token,
          RecordType: 'All',
          ReqBranchIssue: 'N',
        },
      ],
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: ORNATE_TIMEOUT }
  );

  const rawSoldList = response.data?.SoldLabel || [];
  const soldList = rawSoldList.filter(
    (item) => item && !item.IsBlankTable && (item.UniqueLabelId || item.UniqueLabelID || item.BarcodeNo || item.LabelNo)
  );

  const rawLabelDetail = response.data?.LabelDetail || [];
  const labelDetails = rawLabelDetail.filter(
    (l) => l && !l.IsBlankTable && (l.UniqueLabelID || l.BarcodeNo || l.LabelNo)
  );

  console.log(`[Ornate NX] Received ${soldList.length} sold labels, ${labelDetails.length} label details.`);

  let upsertedCount = 0;
  for (const label of labelDetails) {
    const uniqueLabelID = label.UniqueLabelID || label.BarcodeNo || label.LabelNo;
    if (!uniqueLabelID) continue;

    const sku = uniqueLabelID;
    const salePrice =
      Number(label.TodaysSalesValue) ||
      Number(label.TotalSalesAmt) ||
      Number(label.GoldAmt) ||
      Number(label.MRP) ||
      0;

    await Product.findOneAndUpdate(
      {
        $or: [
          { uniqueLabelID },
          { barcodeNo: label.BarcodeNo || uniqueLabelID },
          { sku },
        ],
      },
      {
        $set: {
          uniqueLabelID,
          labelNo: label.LabelNo || '',
          barcodeNo: label.BarcodeNo || '',
          itemName: label.ItemName || '',
          groupName: label.GroupName || '',
          grossWt: Number(label.GrossWt) || 0,
          netWt: Number(label.NetWt) || 0,
          salePrice,
          inStock: 0,
          stockQty: 0,
          stockStatus: 'Out of Stock',
          isSold: true,
          isOrnate: true,
          productType: 'ornate',
          lastSyncedAt: new Date(),
        },
        $setOnInsert: {
          title: label.ItemName || `Ornate Item ${sku}`,
          sku,
          status: 'active',
          isDeleted: false,
          ornateImages: [],
          images: [],
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: false }
    );
    upsertedCount++;
  }

  const soldIds = soldList
    .map((item) => item.UniqueLabelId || item.UniqueLabelID || item.BarcodeNo || item.LabelNo)
    .filter(Boolean);

  let modifiedCount = 0;
  if (soldIds.length > 0) {
    const result = await Product.updateMany(
      {
        isOrnate: true,
        $or: [
          { uniqueLabelID: { $in: soldIds } },
          { barcodeNo: { $in: soldIds } },
          { labelNo: { $in: soldIds } },
          { sku: { $in: soldIds } },
          { tagNo: { $in: soldIds } },
        ],
      },
      {
        $set: {
          inStock: 0,
          stockQty: 0,
          stockStatus: 'Out of Stock',
          isSold: true,
          lastSyncedAt: new Date(),
        },
      }
    );
    modifiedCount = result.modifiedCount;
  }

  const totalProcessed = Math.max(upsertedCount, modifiedCount);
  console.log(`[Ornate NX] ✅ Marked/Upserted ${totalProcessed} items as sold.`);
  return {
    success: true,
    count: totalProcessed,
    modifiedCount,
    upsertedCount,
    message: totalProcessed === 0
      ? 'Ornate ERP sold feed currently has 0 items.'
      : `Successfully synced ${totalProcessed} sold/non-stock product(s) from ERP.`,
  };
}

// ------------------------------- get ornate erp sold labels ----------------------------
async function getOrnateErpSoldLabels() {
  const token = await getOrnateToken();
  const response = await axios.post(
    `${ORNATE_BASE_URL}/GetSoldLabelData_API`,
    {
      SoldLabel: [
        {
          UserName: ORNATE_USERNAME,
          Password: ORNATE_PASSWORD,
          Token: token,
          RecordType: 'All',
          ReqBranchIssue: 'N',
        },
      ],
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: ORNATE_TIMEOUT }
  );

  const rawSoldList = response.data?.SoldLabel || [];
  const rawLabelDetail = response.data?.LabelDetail || [];

  const validSold = rawSoldList.filter(
    (s) => s && !s.IsBlankTable && (s.UniqueLabelId || s.UniqueLabelID || s.BarcodeNo || s.LabelNo)
  );

  const validDetails = rawLabelDetail.filter(
    (l) => l && !l.IsBlankTable && (l.UniqueLabelID || l.BarcodeNo || l.LabelNo)
  );

  const allSoldIds = new Set();
  const combinedItems = [];

  validDetails.forEach(d => {
    const id = d.UniqueLabelID || d.BarcodeNo || d.LabelNo;
    if (!id || allSoldIds.has(String(id).toLowerCase())) return;
    allSoldIds.add(String(id).toLowerCase());
    combinedItems.push({
      uniqueLabelID: d.UniqueLabelID || id,
      labelNo: d.LabelNo || '',
      barcodeNo: d.BarcodeNo || '',
      itemName: d.ItemName || '',
      groupName: d.GroupName || '',
      grossWt: d.GrossWt || 0,
      netWt: d.NetWt || 0,
      price: d.TodaysSalesValue || d.TotalSalesAmt || d.GoldAmt || d.MRP || 0,
      metalName: d.MetalName || '',
      carat: d.Carat || '',
    });
  });

  validSold.forEach(s => {
    const id = s.UniqueLabelId || s.UniqueLabelID || s.BarcodeNo || s.LabelNo;
    if (!id || allSoldIds.has(String(id).toLowerCase())) return;
    allSoldIds.add(String(id).toLowerCase());
    combinedItems.push({
      uniqueLabelID: s.UniqueLabelId || s.UniqueLabelID || id,
      labelNo: s.LabelNo || '',
      barcodeNo: s.BarcodeNo || '',
      itemName: s.ItemName || 'Sold Tag',
      groupName: s.GroupName || '',
      grossWt: s.GrossWt || 0,
      netWt: s.NetWt || 0,
      price: s.TodaysSalesValue || s.TotalSalesAmt || s.GoldAmt || s.MRP || 0,
      metalName: s.MetalName || '',
      carat: s.Carat || '',
    });
  });

  // Cross-reference with Product collection
  const dbMatch = await Product.find({
    isOrnate: true,
    $or: [
      { uniqueLabelID: { $in: Array.from(allSoldIds) } },
      { barcodeNo: { $in: Array.from(allSoldIds) } },
      { labelNo: { $in: Array.from(allSoldIds) } },
      { sku: { $in: Array.from(allSoldIds) } },
    ],
  }).select('uniqueLabelID labelNo barcodeNo inStock isSold status salePrice sku').lean();

  const dbMap = new Map();
  dbMatch.forEach(p => {
    if (p.uniqueLabelID) dbMap.set(p.uniqueLabelID.toLowerCase(), p);
    if (p.barcodeNo) dbMap.set(p.barcodeNo.toLowerCase(), p);
    if (p.labelNo) dbMap.set(p.labelNo.toLowerCase(), p);
    if (p.sku) dbMap.set(p.sku.toLowerCase(), p);
  });

  const enrichedItems = combinedItems.map(item => {
    const dbProduct = dbMap.get((item.uniqueLabelID || '').toLowerCase()) ||
                     dbMap.get((item.barcodeNo || '').toLowerCase()) ||
                     dbMap.get((item.labelNo || '').toLowerCase());
    return {
      ...item,
      inDb: !!dbProduct,
      dbStatus: dbProduct ? dbProduct.status : 'not_synced',
      currentInStock: dbProduct ? dbProduct.inStock : 0,
      alreadySoldInDb: dbProduct ? dbProduct.isSold || dbProduct.inStock === 0 : false,
    };
  });

  return {
    total: enrichedItems.length,
    items: enrichedItems,
  };
}

// ------------------------------- sync specific sold labels ----------------------------
async function syncSpecificSoldLabels(productIds) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new Error('Please select at least one product to mark as sold.');
  }

  const cleanIds = productIds.map(id => String(id).trim()).filter(Boolean);

  const result = await Product.updateMany(
    {
      isOrnate: true,
      $or: [
        { uniqueLabelID: { $in: cleanIds } },
        { barcodeNo: { $in: cleanIds } },
        { labelNo: { $in: cleanIds } },
        { sku: { $in: cleanIds } },
        { tagNo: { $in: cleanIds } },
      ],
    },
    {
      $set: {
        inStock: 0,
        stockQty: 0,
        stockStatus: 'Out of Stock',
        isSold: true,
        lastSyncedAt: new Date(),
      },
    }
  );

  return {
    success: true,
    modifiedCount: result.modifiedCount,
    message: `Marked ${result.modifiedCount} selected product(s) as Out of Stock (Sold).`,
  };
}

// ------------------------------- sync ornate metal rate changes ----------------------------
async function syncOrnateMetalRateChanges() {
  const token = await getOrnateToken();

  console.log('[Ornate NX] Fetching metal rate changes from Ornate ERP...');

  const response = await axios.post(
    `${ORNATE_BASE_URL}/GetLabelDataMetalRateChanges_API`,
    {
      MetalRateChanges: [
        {
          UserName: ORNATE_USERNAME,
          Password: ORNATE_PASSWORD,
          Token: token,
        },
      ],
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: ORNATE_TIMEOUT }
  );

  const labelDetails = response.data?.LabelDetail || [];
  console.log(`[Ornate NX] Received ${labelDetails.length} metal rate change labels.`);

  if (labelDetails.length === 0) {
    return { success: true, count: 0, message: 'No metal rate changes found' };
  }

  let updatedCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const label of labelDetails) {
    try {
      const uniqueLabelID = label.UniqueLabelID || label.BarcodeNo;
      if (!uniqueLabelID) continue;

      const todaysSalesValue = Number(label.TodaysSalesValue) || 0;
      const totalSalesAmt = Number(label.TotalSalesAmt) || 0;
      const goldAmt = Number(label.GoldAmt) || 0;
      const goldRate = Number(label.GoldRate) || 0;
      const metalRate = Number(label.MetalRate) || 0;
      const labourAmt = Number(label.LabourAmt) || 0;
      const gstAmt = Number(label.GSTAmt) || 0;
      const mrp = Number(label.MRP) || 0;

      const newSalePrice = todaysSalesValue || totalSalesAmt || goldAmt || mrp || 0;

      if (newSalePrice > 0) {
        await Product.updateOne(
          {
            isOrnate: true,
            $or: [
              { uniqueLabelID },
              { barcodeNo: label.BarcodeNo || uniqueLabelID },
              { sku: uniqueLabelID },
            ],
          },
          {
            $set: {
              todaysSalesValue,
              totalSalesAmt,
              goldAmt,
              goldRate,
              metalRate,
              labourAmt,
              gstAmt,
              mrp,
              price: mrp || newSalePrice,
              salePrice: newSalePrice,
              displayPrice: newSalePrice,
              lastSyncedAt: new Date(),
            },
          }
        );
        updatedCount++;
      }
    } catch (err) {
      errorCount++;
      errors.push(`${label.UniqueLabelID || 'unknown'}: ${err.message}`);
      console.error(`[Ornate NX] ❌ Error updating metal rate for ${label.UniqueLabelID}:`, err.message);
    }
  }

  console.log(`[Ornate NX] ✅ Metal rate sync complete. Updated: ${updatedCount}, Errors: ${errorCount}`);
  return { success: true, count: updatedCount, errorCount, errors: errors.slice(0, 20) };
}

// ------------------------------- run ornate full sync ----------------------------
async function runOrnateFullSync() {
  console.log('[Ornate NX] 🔄 Starting Ornate NX Full Sync...');
  const results = {};

  try {
    const eventRes = await getOrnateEvents();
    const eventList = eventRes?.EventList || [];

    console.log(`[Ornate NX] Active events from ERP: ${JSON.stringify(eventList)}`);
    results.events = eventList;

    // Baseline: label sync (new/modified products)
    console.log('[Ornate NX] Running label sync (EventId 1 / baseline)...');
    results.labelSync = await syncOrnateLabels();

    // Check & sync sold labels
    console.log('[Ornate NX] Running sold label sync...');
    results.soldSync = await syncOrnateSoldLabels();

    // Check for metal rate changes
    const hasRateEvent = eventList.some((evt) => evt.EventId === 4 || evt.EventID === 4);
    if (hasRateEvent) {
      console.log('[Ornate NX] EventId 4 detected — running metal rate change sync...');
      results.metalRateSync = await syncOrnateMetalRateChanges();
    } else {
      console.log('[Ornate NX] No EventId 4 detected, skipping metal rate sync.');
    }

    console.log('[Ornate NX] ✅ Full sync complete.');
    return { success: true, results };
  } catch (err) {
    console.error('[Ornate NX] ❌ Full Sync Error:', err.message);
    throw err;
  }
}

// ------------------------------- test ornate connection ----------------------------
async function testOrnateConnection() {
  const start = Date.now();
  try {
    const token = await getOrnateToken(true);
    const latencyMs = Date.now() - start;
    return {
      success: true,
      latencyMs,
      token,
      baseUrl: ORNATE_BASE_URL,
      message: `Successfully connected to Ornate ERP in ${latencyMs}ms`,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return {
      success: false,
      latencyMs,
      baseUrl: ORNATE_BASE_URL,
      error: err.message,
      suggestion: 'Check if the on-premise Ornate ERP PC at 142.79.228.244 is running and port 2507 is open.',
    };
  }
}

// ------------------------------- push order to ornate ----------------------------
async function pushOrderToOrnate(orderId) {
  try {
    const mongoose = require('mongoose');
    let OrderModel;
    try {
      OrderModel = mongoose.model('Order');
    } catch {
      console.warn('[Ornate NX] Order model not registered yet in Mongoose');
      return null;
    }

    const token = await getOrnateToken();
    const order = await OrderModel.findById(orderId)
      .populate('user')
      .populate('orderItems.product');

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const address = order.shippingAddress || {};
    const user = order.user || {};

    const orderVouNo = `ORD-${order._id.toString().slice(-6).toUpperCase()}`;
    const createdAt = new Date(order.createdAt || Date.now());
    const orderVouDate = `${String(createdAt.getMonth() + 1).padStart(2, '0')}/${String(createdAt.getDate()).padStart(2, '0')}/${createdAt.getFullYear()}`;

    const rawMethod = (order.paymentInfo?.paymentMethod || '').toUpperCase();
    const paymentMode = rawMethod === 'COD' ? 'COD' : (rawMethod || 'Net Banking');
    const paymentBankName = rawMethod === 'COD' ? 'COD' : 'Net Banking';
    const refNo = order._id.toString().slice(-12).toUpperCase();

    const orderMst = [
      {
        OrderVouNo: orderVouNo,
        OrderVouDate: orderVouDate,
        OrderAmt: String(order.totalPrice || order.totalAmount || 0),
        PaymentMode: paymentMode,
        PaymentAmt: String(order.totalPrice || order.totalAmount || 0),
        PaymentBankName: paymentBankName,
        Remarks: paymentMode,
        Refno: refNo,
        CustomerName:
          user.name ||
          `${address.firstName || ''} ${address.lastName || ''}`.trim() ||
          'Customer',
        BlockNo: address.apartment || '',
        BuildingName: address.street || '',
        Street: address.street || '',
        Area: address.city || '',
        City: address.city || '',
        State: address.state || '',
        Pincode: address.zipCode || address.pincode || '',
        Country: address.country || 'India',
        EmailId: user.email || 'customer@neirah.in',
        MobileNo: address.phone || user.phone || '9999999999',
      },
    ];

    const orderTran = (order.orderItems || []).map((item, idx) => {
      const prod = item.product || {};
      const delDate = new Date();
      delDate.setDate(delDate.getDate() + 7);
      const deliveryDateStr = `${String(delDate.getMonth() + 1).padStart(2, '0')}/${String(delDate.getDate()).padStart(2, '0')}/${delDate.getFullYear()}`;

      return {
        OrderVouNo: orderVouNo,
        UniqueLabelID: prod.uniqueLabelID || prod.sku || `ITEM-${idx + 1}`,
        CompanyCode: prod.companyCode || 'MFG',
        ItemName: prod.title || prod.itemName || 'Jewellery',
        GrossWt: String(prod.grossWt || 0),
        NetWt: String(prod.netWt || 0),
        Pcs: String(prod.pcs || 1),
        Qty: String(item.quantity || 1),
        DeliveryDate: deliveryDateStr,
      };
    });

    const response = await axios.post(
      `${ORNATE_BASE_URL}/PlaceOrderData_API`,
      {
        Token: [
          {
            UserName: ORNATE_USERNAME,
            Password: ORNATE_PASSWORD,
            Token: token,
          },
        ],
        OrderMst: orderMst,
        OrderTran: orderTran,
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: ORNATE_TIMEOUT }
    );

    console.log(`[Ornate NX] ✅ Pushed order ${order._id} to Ornate ERP:`, response.data);
    return response.data;
  } catch (err) {
    console.error(
      `[Ornate NX] ❌ Failed to push order ${orderId} to Ornate ERP:`,
      err?.response?.data || err.message
    );
    return null;
  }
}

module.exports = {
  getOrnateToken,
  clearCachedOrnateToken,
  testOrnateConnection,
  getOrnateEvents,
  getOrnateErpCategories,
  getOrnateErpSoldLabels,
  syncSpecificSoldLabels,
  syncOrnateLabels,
  syncOrnateSoldLabels,
  syncOrnateMetalRateChanges,
  runOrnateFullSync,
  pushOrderToOrnate,
};
