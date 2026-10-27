const mongoose = require('mongoose');
const axios = require('axios');
const ftp = require('basic-ftp');
const { Writable } = require('stream');
const path = require('path');
const Product = require('../product/product.model');
const cloudflareR2 = require('../../utils/cloudflareR2');
const ornateUtils = require('./ornate.utils');
const productGroupService = require('../productGroup/productGroup.service');

const {
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
  normalizeLabelSummary,
  buildProductIdentifierQuery,
  mapStuddedDetails,
  generateProductSlug,
  buildProductPayloadFromLabel,
  cleanPayload,
} = ornateUtils;

// ------------------------------- get ornate erp categories ----------------------------
/**
 * Fetches all product categories (GroupName) from Ornate ERP without downloading images.
 * Returns distinct categories with product counts, metals, and sample item types.
 */
async function getOrnateErpCategories() {
  const data = await fetchOrnateLabelData('0');

  const status = data?.Status?.[0]?.Status;
  if (status !== 'Sucess') {
    clearCachedOrnateToken();
    throw new Error(`Ornate ERP failed to return label data: ${JSON.stringify(data?.Status || data)}`);
  }

  const labelDetails = data?.LabelDetail || [];
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

    group.products.push(normalizeLabelSummary(label));
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

// ------------------------------- sync ornate labels ----------------------------
/**
 * Syncs Ornate ERP labels directly into the main Product table with `isOrnate: true`.
 * Downloads & uploads images to Cloudflare R2 only if product doesn't already have images.
 */
async function syncOrnateLabels(sessionIdOverride, options = null) {
  const sessionIdToPass = sessionIdOverride !== undefined ? sessionIdOverride : getLastSessionId();
  const data = await fetchOrnateLabelData(sessionIdToPass);

  const status = data?.Status?.[0]?.Status;
  if (status !== 'Sucess') {
    clearCachedOrnateToken();
    console.error('[Ornate NX] GetLabelData_API returned failure:', data);
    return { success: false, count: 0, message: 'Ornate API returned failure' };
  }

  const labelDetails = data?.LabelDetail || [];
  const studdedDetails = data?.StuddedDetail || [];
  const newSessionId = data?.Session?.[0]?.SessionId;

  if (labelDetails.length === 0) {
    if (newSessionId && !options) setLastSessionId(newSessionId);
    return { success: true, count: 0, lastSessionId: getLastSessionId() };
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
  } else if (Array.isArray(targetCategories) && targetCategories.length > 0) {
    const selectedNormalized = new Set(targetCategories.map(c => String(c).trim().toLowerCase()));
    labelsToProcess = labelDetails.filter(l => l.GroupName && selectedNormalized.has(String(l.GroupName).trim().toLowerCase()));
  }

  if (labelsToProcess.length === 0) {
    return { success: true, count: 0, message: 'No labels matching the selected criteria', lastSessionId: getLastSessionId() };
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
  } catch (err) {
    console.error('[Ornate NX] FTP connection failed for image sync:', err.message);
  }

  for (const label of labelsToProcess) {
    try {
      const { sku, tagNo, barcode } = extractLabelIdentifiers(label);
      if (!sku) throw new Error('Label has no identifier');

      // Check if product already exists in Product table and has images
      const existingProduct = await Product.findOne(
        buildProductIdentifierQuery({ sku, tagNo, barcode })
      )
        .select('colorImages basicInfo.sku basicInfo.slug ornate pricing')
        .lean();

      const hasImages =
        existingProduct &&
        (existingProduct.ornate?.ornateImages?.length > 0 ||
          existingProduct.colorImages?.some((color) => color.images?.length > 0));

      // Download from FTP and upload to Cloudflare R2 only if NO images exist yet
      const newlyUploadedImages = [];
      if (!hasImages && ftpConnected) {
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
                  key: r2Data.key,
                  mediaType: 'image',
                });
              }
            } catch {
              // Silently ignore skipped image
            }
          }
        }
      }

      // Resolve category
      const categoryId = await resolveCategory(label.GroupName, categoryCache);

      // Build product payload strictly matching product.model.js
      const { setFields } = buildProductPayloadFromLabel(label, {
        studdedDetails,
        existingProduct,
        categoryId,
        newlyUploadedImages,
        sessionId: newSessionId || sessionIdToPass,
      });

      // Upsert into Product collection with 1 flag: isOrnate: true
      const upsertedProduct = await Product.findOneAndUpdate(
        buildProductIdentifierQuery({ sku, tagNo, barcode }),
        {
          $set: setFields,
          $setOnInsert: {
            status: 'draft',
          },
        },
        { upsert: true, returnDocument: 'after', new: true, runValidators: false, setDefaultsOnInsert: false }
      );

      // Auto-assign to matching product_group or create a new entry
      if (upsertedProduct) {
        try {
          await productGroupService.assignOrnateProductToGroup(upsertedProduct, label);
        } catch (groupErr) {
          console.error(`[Ornate Sync] Auto-grouping failed for product ${upsertedProduct._id}:`, groupErr.message);
        }
      }

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

  // Advance the global cursor only after a complete, successful batch.
  if (errorCount === 0 && !options && newSessionId) setLastSessionId(newSessionId);

  return {
    success: errorCount === 0,
    count: upsertedCount,
    errorCount,
    errors: errors.slice(0, 20),
    lastSessionId: getLastSessionId(),
  };
}

// ------------------------------- sync ornate sold labels ----------------------------
/**
 * Marks physically sold items as unavailable/out of stock in the Product table.
 */
async function syncOrnateSoldLabels() {
  const data = await callOrnateApi('GetSoldLabelData_API', 'SoldLabel', {
    RecordType: 'All',
    ReqBranchIssue: 'N',
  });

  const rawSoldList = data?.SoldLabel || [];
  const soldList = rawSoldList.filter(
    (item) => item && !item.IsBlankTable && (item.UniqueLabelId || item.UniqueLabelID || item.BarcodeNo || item.LabelNo)
  );

  const rawLabelDetail = data?.LabelDetail || [];
  const labelDetails = rawLabelDetail.filter(
    (l) => l && !l.IsBlankTable && (l.UniqueLabelID || l.BarcodeNo || l.LabelNo)
  );

  let upsertedCount = 0;
  for (const label of labelDetails) {
    const uniqueLabelID = label.UniqueLabelID || label.BarcodeNo || label.LabelNo;
    if (!uniqueLabelID) continue;

    const sku = String(uniqueLabelID).trim();
    const { salePrice } = calculateLabelPrice(label);

    const soldProduct = await Product.findOneAndUpdate(
      buildProductIdentifierQuery({
        sku,
        tagNo: label.LabelNo || uniqueLabelID,
        barcode: label.BarcodeNo || uniqueLabelID,
      }),
      {
        $set: cleanPayload({
          stockStatus: 'Out of Stock',
          isOrnate: true,
          productType: 'silver',
          'pricing.salePrice': salePrice,
          'ornate.isSold': true,
          'ornate.stockQty': 0,
        }) || {},
        $setOnInsert: cleanPayload({
          'basicInfo.title': label.ItemName || `Ornate Item ${sku}`,
          'basicInfo.sku': sku,
          'basicInfo.slug': (label.ItemName || `Ornate Item ${sku}` + '-' + sku)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, ''),
          status: 'draft',
          'ornate.tagNo': String(label.LabelNo || uniqueLabelID),
          'ornate.barcode': String(label.BarcodeNo || uniqueLabelID),
        }) || {},
      },
      { upsert: true, returnDocument: 'after', new: true, runValidators: false, setDefaultsOnInsert: false }
    );

    if (soldProduct) {
      try {
        await productGroupService.assignOrnateProductToGroup(soldProduct, label);
      } catch (groupErr) {
        console.error(`[Ornate Sync] Auto-grouping failed for sold product ${soldProduct._id}:`, groupErr.message);
      }
    }

    upsertedCount++;
  }

  const soldIds = soldList
    .map((item) => item.UniqueLabelId || item.UniqueLabelID || item.BarcodeNo || item.LabelNo)
    .filter(Boolean).map((id) => String(id).trim());

  let modifiedCount = 0;
  if (soldIds.length > 0) {
    const result = await Product.updateMany(
      {
        isOrnate: true,
        ...buildProductIdentifierQuery(soldIds),
      },
      {
        $set: {
          stockStatus: 'Out of Stock',
          'ornate.isSold': true,
          'ornate.stockQty': 0,
        },
      }
    );
    modifiedCount = result.modifiedCount;
  }

  const totalProcessed = Math.max(upsertedCount, modifiedCount);
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
  const data = await callOrnateApi('GetSoldLabelData_API', 'SoldLabel', {
    RecordType: 'All',
    ReqBranchIssue: 'N',
  });

  const allSoldIds = new Set();
  const combinedItems = [];

  const addUniqueLabels = (list, defaultName = '') => {
    for (const item of list || []) {
      if (!item || item.IsBlankTable) continue;
      const id = item.UniqueLabelID || item.UniqueLabelId || item.BarcodeNo || item.LabelNo;
      if (!id) continue;
      const key = String(id).trim().toLowerCase();
      if (allSoldIds.has(key)) continue;
      allSoldIds.add(key);
      combinedItems.push(normalizeLabelSummary(item, defaultName));
    }
  };

  addUniqueLabels(data?.LabelDetail);
  addUniqueLabels(data?.SoldLabel, 'Sold Tag');

  if (combinedItems.length === 0) {
    return { total: 0, items: [] };
  }

  // Cross-reference with Product collection
  const dbMatch = await Product.find({
    isOrnate: true,
    ...buildProductIdentifierQuery(allSoldIds),
  }).select('basicInfo.sku stockStatus status pricing.salePrice ornate').lean();

  const dbMap = new Map();
  dbMatch.forEach((p) => {
    if (p.basicInfo?.sku) dbMap.set(p.basicInfo.sku.toLowerCase(), p);
    if (p.ornate?.tagNo) dbMap.set(p.ornate.tagNo.toLowerCase(), p);
    if (p.ornate?.barcode) dbMap.set(p.ornate.barcode.toLowerCase(), p);
  });

  const enrichedItems = combinedItems.map((item) => {
    const dbProduct =
      dbMap.get((item.sku || '').toLowerCase()) ||
      dbMap.get((item.uniqueLabelID || '').toLowerCase()) ||
      dbMap.get((item.barcodeNo || '').toLowerCase()) ||
      dbMap.get((item.labelNo || '').toLowerCase());

    return {
      ...item,
      inDb: Boolean(dbProduct),
      dbStatus: dbProduct ? dbProduct.status : 'not_synced',
      currentInStock: dbProduct ? (dbProduct.ornate?.stockQty ?? 0) : 0,
      alreadySoldInDb: dbProduct
        ? Boolean(
            dbProduct.ornate?.isSold ||
            dbProduct.ornate?.stockQty === 0 ||
            dbProduct.stockStatus === 'Out of Stock'
          )
        : false,
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
      ...buildProductIdentifierQuery(cleanIds),
    },
    {
      $set: {
        stockStatus: 'Out of Stock',
        'ornate.isSold': true,
        'ornate.stockQty': 0,
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
  const data = await callOrnateApi('GetLabelDataMetalRateChanges_API', 'MetalRateChanges');
  const labelDetails = data?.LabelDetail || [];

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
            ...buildProductIdentifierQuery({
              sku: uniqueLabelID,
              barcode: label.BarcodeNo || uniqueLabelID,
              tagNo: label.LabelNo || uniqueLabelID,
            }),
          },
          {
            $set: {
              'pricing.mrp': mrp || newSalePrice,
              'pricing.salePrice': newSalePrice,
              'ornate.goldAmt': goldAmt,
              'ornate.labourAmt': labourAmt,
            },
          }
        );
        updatedCount++;
      }
    } catch (err) {
      errorCount++;
      errors.push(`${label.UniqueLabelID || 'unknown'}: ${err.message}`);
      console.error(`[Ornate NX] Error updating metal rate for ${label.UniqueLabelID}:`, err.message);
    }
  }

  return { success: errorCount === 0, count: updatedCount, errorCount, errors: errors.slice(0, 20) };
}

// ------------------------------- run ornate full sync ----------------------------
async function runOrnateFullSync() {
  const results = {};

  try {
    const eventRes = await getOrnateEvents();
    const eventList = eventRes?.EventList || [];
    results.events = eventList;

    // Baseline: label sync (new/modified products)
    results.labelSync = await syncOrnateLabels();

    // Check & sync sold labels
    results.soldSync = await syncOrnateSoldLabels();

    // Check for metal rate changes
    const hasRateEvent = eventList.some((evt) => evt.EventId === 4 || evt.EventID === 4);
    if (hasRateEvent) {
      results.metalRateSync = await syncOrnateMetalRateChanges();
    }

    const success = [results.labelSync, results.soldSync, results.metalRateSync].filter(Boolean).every((result) => result.success);
    return { success, results };
  } catch (err) {
    console.error('[Ornate NX] Full Sync Error:', err.message);
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
    let OrderModel;
    try {
      OrderModel = mongoose.model('Order');
    } catch {
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

    return response.data;
  } catch (err) {
    console.error(
      `[Ornate NX] Failed to push order ${orderId} to Ornate ERP:`,
      err?.response?.data || err.message
    );
    return null;
  }
}

module.exports = {
  ...ornateUtils,
  getOrnateErpCategories,
  syncOrnateLabels,
  syncOrnateSoldLabels,
  getOrnateErpSoldLabels,
  syncSpecificSoldLabels,
  syncOrnateMetalRateChanges,
  runOrnateFullSync,
  testOrnateConnection,
  pushOrderToOrnate,
};
