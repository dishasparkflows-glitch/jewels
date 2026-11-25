const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { GoogleAuth } = require('google-auth-library');
const { GOOGLE } = require('../../config/constants');

const Product = require('../product/product.model');
const Diamond = require('../diamond/diamond.model');
const User = require('../user/user.model');
const Cart = require('../cart/cart.model');
const Wishlist = require('../wishlist/wishlist.model');
const Category = require('../category/category.model');
const Order = require('../order/order.model');

// ─── 5-Minute In-Memory Server Cache ──────────────────────────────────────────
const reportCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

// ------------------------------- get cached report ----------------------------
function getCachedReport(cacheKey) {
  const entry = reportCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    reportCache.delete(cacheKey);
    return null;
  }
  return entry.data;
}

// ------------------------------- set cached report ----------------------------
function setCachedReport(cacheKey, data) {
  if (reportCache.size > 200) {
    const oldestKey = reportCache.keys().next().value;
    reportCache.delete(oldestKey);
  }
  reportCache.set(cacheKey, { timestamp: Date.now(), data });
}

// ------------------------------- clear report cache ----------------------------
function clearReportCache() {
  reportCache.clear();
}

// ─── Date Validation & Helpers ────────────────────────────────────────────────
const VALID_NAMED_RANGES = ['today', 'yesterday', '7daysAgo', '30daysAgo', '90daysAgo'];
const isIsoDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

// ------------------------------- validate date range ----------------------------
function validateDateRange(startDate, endDate) {
  let start = startDate || '30daysAgo';
  let end = endDate || 'today';

  if (!VALID_NAMED_RANGES.includes(start) && !isIsoDate(start)) {
    return {
      valid: false,
      error: `Invalid startDate "${startDate}". Must be format YYYY-MM-DD or one of: ${VALID_NAMED_RANGES.join(', ')}`,
    };
  }
  if (!VALID_NAMED_RANGES.includes(end) && !isIsoDate(end)) {
    return {
      valid: false,
      error: `Invalid endDate "${endDate}". Must be format YYYY-MM-DD or one of: ${VALID_NAMED_RANGES.join(', ')}`,
    };
  }

  if (isIsoDate(start) && isIsoDate(end)) {
    const sTime = new Date(`${start}T00:00:00Z`).getTime();
    const eTime = new Date(`${end}T23:59:59Z`).getTime();
    if (sTime > eTime) {
      return {
        valid: false,
        error: `startDate (${start}) cannot be later than endDate (${end})`,
      };
    }
  }

  return { valid: true, startDate: start, endDate: end };
}

// ------------------------------- get previous period ----------------------------
function getPreviousPeriod(startDateStr, endDateStr) {
  let start, end;
  const today = new Date();

  if (startDateStr === 'today') {
    start = new Date(today);
    end = new Date(today);
  } else if (startDateStr === 'yesterday') {
    start = new Date(today);
    start.setDate(today.getDate() - 1);
    end = new Date(start);
  } else if (startDateStr === '7daysAgo') {
    start = new Date(today);
    start.setDate(today.getDate() - 7);
    end = new Date(today);
  } else if (startDateStr === '30daysAgo') {
    start = new Date(today);
    start.setDate(today.getDate() - 30);
    end = new Date(today);
  } else if (startDateStr === '90daysAgo') {
    start = new Date(today);
    start.setDate(today.getDate() - 90);
    end = new Date(today);
  } else {
    start = new Date(startDateStr);
    end = (endDateStr === 'today' || !endDateStr) ? new Date(today) : new Date(endDateStr);
    if (isNaN(start.getTime())) start = new Date(today);
    if (isNaN(end.getTime())) end = new Date(today);
  }

  const durationDays = Math.max(1, Math.round(Math.abs(end - start) / (1000 * 60 * 60 * 24)));
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (durationDays - 1));

  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    prevStartDate: formatDate(prevStart),
    prevEndDate: formatDate(prevEnd),
  };
}

// ------------------------------- calculate growth ----------------------------
function calculateGrowth(current, previous) {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const diff = current - previous;
  const percent = ((diff / previous) * 100).toFixed(1);
  return `${diff >= 0 ? '+' : ''}${percent}%`;
}

// ------------------------------- format ga date ----------------------------
function formatGaDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) {
    return { iso: dateStr || '', label: dateStr || '' };
  }
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const iso = `${year}-${month}-${day}`;
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { iso, label };
}

class AnalyticsService {
  // ------------------------------- constructor ----------------------------
  constructor() {
    this.client = null;
    this.clientKeyPath = null;
  }

  // ------------------------------- get analytics config ----------------------------
  getAnalyticsConfig() {
    const propertyId = (GOOGLE.GA4_PROPERTY_ID || '').trim();

    const candidateFiles = [
      path.join(__dirname, '../../config/firebase-service-account.json'),
      path.join(__dirname, '../../config/service-account.json'),
    ];

    for (const keyPath of candidateFiles) {
      if (fs.existsSync(keyPath)) {
        try {
          const stats = fs.statSync(keyPath);
          if (stats.size > 0) {
            return {
              propertyId,
              clientOptions: { keyFilename: keyPath },
              keyFile: keyPath,
              source: path.basename(keyPath),
              configured: true,
            };
          }
        } catch {}
      }
    }

    if (GOOGLE.GA_SERVICE_ACCOUNT_KEY) {
      try {
        const credentials = JSON.parse(GOOGLE.GA_SERVICE_ACCOUNT_KEY);
        return {
          propertyId,
          clientOptions: { credentials },
          keyFile: null,
          source: 'GA_SERVICE_ACCOUNT_KEY (env)',
          configured: true,
        };
      } catch (err) {
        console.warn('[AnalyticsService] Failed to parse GA_SERVICE_ACCOUNT_KEY JSON:', err.message);
      }
    }

    return {
      propertyId,
      clientOptions: null,
      keyFile: null,
      source: 'none',
      configured: false,
    };
  }

  // ------------------------------- get analytics client ----------------------------
  getClient() {
    const config = this.getAnalyticsConfig();
    if (!config.configured || !config.clientOptions) {
      this.client = null;
      this.clientKeyPath = null;
      return null;
    }

    const keyPath = config.clientOptions.keyFilename || 'inline';
    if (this.client && this.clientKeyPath === keyPath) {
      return this.client;
    }

    try {
      this.client = new BetaAnalyticsDataClient(config.clientOptions);
      this.clientKeyPath = keyPath;
      return this.client;
    } catch (err) {
      console.error('[AnalyticsService] Failed to initialize BetaAnalyticsDataClient:', err.message);
      this.client = null;
      return null;
    }
  }

  // ------------------------------- enrich products with db ----------------------------
  async enrichProductsWithDb(rawItems = [], activityType = 'cart') {
    if (!rawItems || rawItems.length === 0) return [];

    const allItemIds = rawItems.map((p) => p.itemId);
    const validObjectIds = [...new Set(allItemIds.filter((id) => mongoose.Types.ObjectId.isValid(id)))];
    const nonObjectIds = [...new Set(allItemIds.filter((id) => id && !mongoose.Types.ObjectId.isValid(id)))];

    const dbProductsMap = new Map();
    const registerProduct = (key, data) => {
      if (!key) return;
      const strKey = String(key);
      if (!dbProductsMap.has(strKey)) {
        dbProductsMap.set(strKey, data);
      }
    };

    const productUsersMap = new Map();

    if (validObjectIds.length > 0 || nonObjectIds.length > 0) {
      try {
        const queries = [];
        if (validObjectIds.length > 0) {
          queries.push(
            Product.find({ _id: { $in: validObjectIds }, 'meta.deletedAt': null })
              .select('basicInfo pricing colorImages ornate images productType categoryIds')
              .populate('categoryIds', 'name')
              .lean(),
            Diamond.find({ _id: { $in: validObjectIds }, 'meta.deletedAt': null })
              .select('title sku images price shape color clarity carat slug')
              .lean()
          );
        } else {
          queries.push(Promise.resolve([]), Promise.resolve([]));
        }

        if (nonObjectIds.length > 0) {
          queries.push(
            Product.find({ 'basicInfo.slug': { $in: nonObjectIds }, 'meta.deletedAt': null })
              .select('basicInfo pricing colorImages ornate images productType categoryIds')
              .populate('categoryIds', 'name')
              .lean()
          );
        } else {
          queries.push(Promise.resolve([]));
        }

        const [dbProducts, dbDiamonds, dbProductsBySlug] = await Promise.all(queries);

        const getProductImg = (prod) => {
          if (prod?.colorImages?.[0]?.images?.[0]?.url) return prod.colorImages[0].images[0].url;
          if (typeof prod?.colorImages?.[0]?.images?.[0] === 'string') return prod.colorImages[0].images[0];
          if (prod?.ornate?.ornateImages?.[0]?.url) return prod.ornate.ornateImages[0].url;
          if (typeof prod?.ornate?.ornateImages?.[0] === 'string') return prod.ornate.ornateImages[0];
          if (prod?.images?.[0]?.url) return prod.images[0].url;
          if (typeof prod?.images?.[0] === 'string') return prod.images[0];
          return null;
        };

        const getDiamondImg = (d) => {
          return d?.images?.[0]?.url || (typeof d?.images?.[0] === 'string' ? d.images[0] : null);
        };

        (dbProducts || []).forEach((prod) => {
          const title = prod.basicInfo?.title || 'Jewellery Product';
          const sku = prod.basicInfo?.sku || null;
          const slug = prod.basicInfo?.slug || null;
          const price = prod.pricing?.salePrice || prod.pricing?.mrp || 0;
          const category = prod.categoryIds?.[0]?.name || (prod.isOrnate ? 'Ornate' : 'Jewellery');

          const data = {
            id: String(prod._id),
            title,
            name: title,
            sku,
            slug,
            price,
            productType: prod.productType || (prod.isOrnate ? 'ornate' : 'jewelry'),
            itemType: 'product',
            category,
            image: getProductImg(prod),
          };
          registerProduct(prod._id, data);
          if (slug) registerProduct(slug, data);
        });

        (dbProductsBySlug || []).forEach((prod) => {
          const title = prod.basicInfo?.title || 'Jewellery Product';
          const sku = prod.basicInfo?.sku || null;
          const slug = prod.basicInfo?.slug || null;
          const price = prod.pricing?.salePrice || prod.pricing?.mrp || 0;
          const category = prod.categoryIds?.[0]?.name || (prod.isOrnate ? 'Ornate' : 'Jewellery');

          const data = {
            id: String(prod._id),
            title,
            name: title,
            sku,
            slug,
            price,
            productType: prod.productType || (prod.isOrnate ? 'ornate' : 'jewelry'),
            itemType: 'product',
            category,
            image: getProductImg(prod),
          };
          registerProduct(prod._id, data);
          if (slug) registerProduct(slug, data);
        });

        (dbDiamonds || []).forEach((d) => {
          const data = {
            id: String(d._id),
            title: d.title || 'Certified Diamond',
            name: d.title || 'Certified Diamond',
            sku: d.sku || null,
            slug: d.slug || String(d._id),
            price: d.price || null,
            productType: 'diamond',
            itemType: 'diamond',
            category: 'Loose Diamond',
            image: getDiamondImg(d),
          };
          registerProduct(d._id, data);
          if (d.slug) registerProduct(d.slug, data);
        });

        // Resolve customer lead contact details if customer IDs are present
        const directCustomerIds = [
          ...new Set(
            rawItems
              .flatMap((i) => i.customerIds || [])
              .filter((id) => id && id !== 'guest' && id !== '(not set)' && mongoose.Types.ObjectId.isValid(id))
          ),
        ];

        if (directCustomerIds.length > 0) {
          try {
            const users = await User.find({ _id: { $in: directCustomerIds } })
              .select('profile auth name email phone countryCode')
              .lean();

            const userMap = new Map();
            users.forEach((u) => {
              const fullName = (u.profile?.firstName
                ? `${u.profile.firstName} ${u.profile.lastName || ''}`.trim()
                : null) || u.name || 'Customer';
              const email = u.auth?.email || u.email || null;
              const rawPhone = (u.profile?.phone || u.phone || '').replace(/[^0-9]/g, '');
              const cCode = (u.profile?.countryCode || u.countryCode || '91').replace(/[^0-9]/g, '');
              userMap.set(String(u._id), {
                id: String(u._id),
                name: fullName,
                email,
                phone: rawPhone ? `+${cCode} ${rawPhone}` : null,
              });
            });

            rawItems.forEach((item) => {
              const prodKey = String(item.itemId);
              const matched = (item.customerIds || [])
                .map((cid) => userMap.get(String(cid)))
                .filter(Boolean);
              productUsersMap.set(prodKey, matched);
            });
          } catch (userErr) {
            console.warn('[AnalyticsService] Customer lead lookup notice:', userErr.message);
          }
        }
      } catch (dbErr) {
        console.warn('[AnalyticsService] MongoDB enrichment query notice:', dbErr.message);
      }
    }

    return rawItems.map((item) => {
      const dbProduct = dbProductsMap.get(String(item.itemId));
      const matchedUsers = productUsersMap.get(String(item.itemId)) || [];
      return {
        itemId: item.itemId,
        name: dbProduct?.name || item.name,
        count: item.count !== undefined ? item.count : (item.cartAdditions !== undefined ? item.cartAdditions : (item.views || 0)),
        users: matchedUsers,
        product: dbProduct
          ? {
              id: dbProduct.id || item.itemId,
              title: dbProduct.name,
              sku: dbProduct.sku,
              slug: dbProduct.slug,
              price: dbProduct.price,
              productType: dbProduct.productType,
              category: dbProduct.category,
              image: dbProduct.image,
            }
          : null,
      };
    });
  }

  // ------------------------------- get analytics overview ----------------------------
  async getAnalyticsOverview({ startDate = '30daysAgo', endDate = 'today', limit = 10, offset = 0 } = {}) {
    const dateValidation = validateDateRange(startDate, endDate);
    const start = dateValidation.valid ? dateValidation.startDate : '30daysAgo';
    const end = dateValidation.valid ? dateValidation.endDate : 'today';
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

    const cacheKey = `overview:${start}:${end}:${parsedLimit}:${parsedOffset}`;
    const cached = getCachedReport(cacheKey);
    if (cached) return cached;

    const config = this.getAnalyticsConfig();
    const client = this.getClient();

    if (!client) {
      return this.getDatabaseOverview(start, end);
    }

    try {
      const property = `properties/${config.propertyId}`;
      const { prevStartDate, prevEndDate } = getPreviousPeriod(start, end);

      const [
        summaryRes,
        prevSummaryRes,
        timelineRes,
        topProductsRes,
        trafficSourcesRes,
      ] = await Promise.all([
        // 1. Current period summary
        client.runReport({
          property,
          dateRanges: [{ startDate: start, endDate: end }],
          metrics: [
            { name: 'totalUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
            { name: 'itemsAddedToCart' },
            { name: 'itemsViewed' },
          ],
        }),
        // 2. Previous period comparison
        client.runReport({
          property,
          dateRanges: [{ startDate: prevStartDate, endDate: prevEndDate }],
          metrics: [
            { name: 'totalUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'itemsAddedToCart' },
            { name: 'itemsViewed' },
          ],
        }).catch(() => [null]),
        // 3. Timeline
        client.runReport({
          property,
          dateRanges: [{ startDate: start, endDate: end }],
          dimensions: [{ name: start === 'today' ? 'hour' : 'date' }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'itemsViewed' },
          ],
          orderBys: [{ dimension: { dimensionName: start === 'today' ? 'hour' : 'date' }, desc: false }],
        }),
        // 4. Top viewed products
        client.runReport({
          property,
          dateRanges: [{ startDate: start, endDate: end }],
          dimensions: [{ name: 'itemId' }, { name: 'itemName' }],
          metrics: [{ name: 'itemsViewed' }],
          orderBys: [{ metric: { metricName: 'itemsViewed' }, desc: true }],
          limit: parsedLimit,
          offset: parsedOffset,
        }),
        // 5. Traffic acquisition sources
        client.runReport({
          property,
          dateRanges: [{ startDate: start, endDate: end }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 8,
        }),
      ]);

      const curRow = summaryRes[0]?.rows?.[0]?.metricValues || [];
      const totalUsers = parseInt(curRow[0]?.value || '0', 10);
      const totalSessions = parseInt(curRow[1]?.value || '0', 10);
      const pageViews = parseInt(curRow[2]?.value || '0', 10);
      const avgDurationSec = parseFloat(curRow[3]?.value || '0');
      const bounceRate = parseFloat(curRow[4]?.value || '0');
      const addToCart = parseInt(curRow[5]?.value || '0', 10);
      const productViews = parseInt(curRow[6]?.value || '0', 10);

      const prevRow = prevSummaryRes[0]?.rows?.[0]?.metricValues || [];
      const prevUsers = parseInt(prevRow[0]?.value || '0', 10);
      const prevSessions = parseInt(prevRow[1]?.value || '0', 10);
      const prevPageViews = parseInt(prevRow[2]?.value || '0', 10);
      const prevAddToCart = parseInt(prevRow[3]?.value || '0', 10);
      const prevProductViews = parseInt(prevRow[4]?.value || '0', 10);

      const trends = {
        users: calculateGrowth(totalUsers, prevUsers),
        sessions: calculateGrowth(totalSessions, prevSessions),
        pageViews: calculateGrowth(pageViews, prevPageViews),
        productViews: calculateGrowth(productViews, prevProductViews),
        addToCart: calculateGrowth(addToCart, prevAddToCart),
        addToWishlist: '+0%',
      };

      const timeline = (timelineRes[0]?.rows || []).map((row) => {
        const rawDate = row.dimensionValues?.[0]?.value || '';
        const { iso, label } = formatGaDate(rawDate);
        return {
          date: iso || rawDate,
          label: label || rawDate,
          users: parseInt(row.metricValues?.[0]?.value || '0', 10),
          sessions: parseInt(row.metricValues?.[1]?.value || '0', 10),
          pageViews: parseInt(row.metricValues?.[2]?.value || '0', 10),
          productViews: parseInt(row.metricValues?.[3]?.value || '0', 10),
        };
      });

      const rawTopProducts = (topProductsRes[0]?.rows || [])
        .map((row) => ({
          itemId: row.dimensionValues?.[0]?.value || '',
          name: row.dimensionValues?.[1]?.value || 'Jewellery Item',
          views: parseInt(row.metricValues?.[0]?.value || '0', 10),
        }))
        .filter((p) => p.itemId && p.itemId !== '(not set)');

      const enrichedTopProducts = await this.enrichProductsWithDb(rawTopProducts, 'views');

      const totalChannelSessions = (trafficSourcesRes[0]?.rows || []).reduce(
        (acc, r) => acc + parseInt(r.metricValues?.[0]?.value || '0', 10),
        0
      );

      const trafficSources = (trafficSourcesRes[0]?.rows || []).map((row) => {
        const channel = row.dimensionValues?.[0]?.value || 'Direct';
        const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
        const percentage = totalChannelSessions > 0 ? Math.round((sessions / totalChannelSessions) * 100) : 0;
        return { channel, sessions, percentage };
      });

      const result = {
        configured: true,
        propertyId: config.propertyId,
        summary: {
          totalUsers,
          totalSessions,
          pageViews,
          productViews,
          addToCart,
          addToWishlist: 0,
          avgDurationSec: Math.round(avgDurationSec),
          bounceRate: Math.round(bounceRate * 10) / 10,
          trends,
        },
        timeline,
        topProducts: enrichedTopProducts,
        trafficSources,
      };

      setCachedReport(cacheKey, result);
      return result;
    } catch (err) {
      console.error('[AnalyticsService] Error fetching GA4 overview:', err.message);
      return this.getDatabaseOverview(start, end);
    }
  }

  // ------------------------------- get product add to cart report ----------------------------
  async getProductAddToCartReport({
    startDate = '30daysAgo',
    endDate = 'today',
    limit = 10,
    offset = 0,
    sortBy = 'count',
    order = 'desc',
    refresh = false,
  } = {}) {
    const dateValidation = validateDateRange(startDate, endDate);
    if (!dateValidation.valid) {
      return { success: false, statusCode: 400, error: dateValidation.error };
    }

    const start = dateValidation.startDate;
    const end = dateValidation.endDate;
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

    const cacheKey = `add-to-cart:${start}:${end}:${parsedLimit}:${parsedOffset}:${sortBy}:${order}`;
    if (!refresh) {
      const cached = getCachedReport(cacheKey);
      if (cached) return cached;
    }

    const client = this.getClient();
    const config = this.getAnalyticsConfig();

    if (!client || !config.propertyId) {
      return this.getDatabaseCartReport({ startDate: start, endDate: end, limit: parsedLimit, offset: parsedOffset, sortBy, order });
    }

    try {
      const property = `properties/${config.propertyId}`;
      const isAsc = order === 'asc';

      let reportRes = null;
      let hasCustomerId = false;

      try {
        const [res] = await client.runReport({
          property,
          dateRanges: [{ startDate: start, endDate: end }],
          dimensions: [{ name: 'itemId' }, { name: 'itemName' }, { name: 'customEvent:shopper_id' }],
          metrics: [{ name: 'itemsAddedToCart' }],
          orderBys: [
            sortBy === 'name'
              ? { dimension: { dimensionName: 'itemName' }, desc: !isAsc }
              : { metric: { metricName: 'itemsAddedToCart' }, desc: !isAsc },
          ],
          limit: parsedLimit,
          offset: parsedOffset,
        });
        reportRes = [res];
        hasCustomerId = true;
      } catch {
        reportRes = await client.runReport({
          property,
          dateRanges: [{ startDate: start, endDate: end }],
          dimensions: [{ name: 'itemId' }, { name: 'itemName' }],
          metrics: [{ name: 'itemsAddedToCart' }],
          orderBys: [
            sortBy === 'name'
              ? { dimension: { dimensionName: 'itemName' }, desc: !isAsc }
              : { metric: { metricName: 'itemsAddedToCart' }, desc: !isAsc },
          ],
          limit: parsedLimit,
          offset: parsedOffset,
        });
      }

      const [totalsRes] = await client.runReport({
        property,
        dateRanges: [{ startDate: start, endDate: end }],
        metrics: [{ name: 'itemsAddedToCart' }],
      }).catch(() => [{ rows: [] }]);

      const totalItemsAdded = parseInt(totalsRes?.rows?.[0]?.metricValues?.[0]?.value || '0', 10);
      const totalRowsCount = reportRes[0]?.rowCount || reportRes[0]?.rows?.length || 0;

      const cartMap = new Map();
      (reportRes[0]?.rows || []).forEach((row) => {
        const itemId = row.dimensionValues?.[0]?.value || '';
        if (!itemId || itemId === '(not set)') return;
        const name = row.dimensionValues?.[1]?.value || 'Jewellery Item';
        const customerId = hasCustomerId ? row.dimensionValues?.[2]?.value || '' : null;
        const count = parseInt(row.metricValues?.[0]?.value || '0', 10);

        if (!cartMap.has(itemId)) {
          cartMap.set(itemId, {
            itemId,
            name,
            count: 0,
            customerIds: hasCustomerId ? [] : undefined,
          });
        }
        const entry = cartMap.get(itemId);
        entry.count += count;
        if (hasCustomerId && customerId && customerId !== '(not set)' && !entry.customerIds.includes(customerId)) {
          entry.customerIds.push(customerId);
        }
      });

      const rawRows = Array.from(cartMap.values());
      const enrichedRows = await this.enrichProductsWithDb(rawRows, 'cart');

      const page = Math.floor(parsedOffset / parsedLimit) + 1;
      const totalPages = Math.ceil(totalRowsCount / parsedLimit) || 1;

      const result = {
        success: true,
        reportType: 'add-to-cart',
        propertyId: config.propertyId,
        dateRange: { startDate: start, endDate: end },
        totals: {
          totalItemsAdded,
          uniqueProductsCount: totalRowsCount,
        },
        pagination: {
          total: totalRowsCount,
          page,
          limit: parsedLimit,
          offset: parsedOffset,
          totalPages,
        },
        data: enrichedRows,
      };

      setCachedReport(cacheKey, result);
      return result;
    } catch (err) {
      console.error('[AnalyticsService] Error fetching Add to Cart report:', err.message);
      return this.getDatabaseCartReport({ startDate: start, endDate: end, limit: parsedLimit, offset: parsedOffset, sortBy, order });
    }
  }

  // ------------------------------- get product wishlist report ----------------------------
  async getProductWishlistReport({
    startDate = '30daysAgo',
    endDate = 'today',
    limit = 10,
    offset = 0,
    sortBy = 'count',
    order = 'desc',
    refresh = false,
  } = {}) {
    const dateValidation = validateDateRange(startDate, endDate);
    if (!dateValidation.valid) {
      return { success: false, statusCode: 400, error: dateValidation.error };
    }

    const start = dateValidation.startDate;
    const end = dateValidation.endDate;
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

    const cacheKey = `wishlist:${start}:${end}:${parsedLimit}:${parsedOffset}:${sortBy}:${order}`;
    if (!refresh) {
      const cached = getCachedReport(cacheKey);
      if (cached) return cached;
    }

    const client = this.getClient();
    const config = this.getAnalyticsConfig();

    if (!client || !config.propertyId) {
      return this.getDatabaseWishlistReport({ startDate: start, endDate: end, limit: parsedLimit, offset: parsedOffset, sortBy, order });
    }

    try {
      const property = `properties/${config.propertyId}`;

      let reportRes = null;
      let hasCustomerId = false;

      try {
        const [res] = await client.runReport({
          property,
          dateRanges: [{ startDate: start, endDate: end }],
          dimensions: [
            { name: 'customEvent:product_id' },
            { name: 'customEvent:product_name' },
            { name: 'customEvent:shopper_id' },
          ],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'add_to_wishlist' } },
          },
          orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
          limit: parsedLimit,
          offset: parsedOffset,
        });
        reportRes = res;
        hasCustomerId = true;
      } catch {
        const [res] = await client.runReport({
          property,
          dateRanges: [{ startDate: start, endDate: end }],
          dimensions: [{ name: 'itemId' }, { name: 'itemName' }],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'add_to_wishlist' } },
          },
          limit: parsedLimit,
          offset: parsedOffset,
        });
        reportRes = res;
      }

      const totalRowsCount = reportRes?.rowCount || reportRes?.rows?.length || 0;

      const productMap = new Map();
      (reportRes?.rows || []).forEach((row) => {
        const itemId = row.dimensionValues?.[0]?.value || '';
        if (!itemId || itemId === '(not set)') return;
        const name = row.dimensionValues?.[1]?.value || 'Jewellery Item';
        const customerId = hasCustomerId ? row.dimensionValues?.[2]?.value || '' : null;
        const count = parseInt(row.metricValues?.[0]?.value || '0', 10);

        if (!productMap.has(itemId)) {
          productMap.set(itemId, {
            itemId,
            name,
            count: 0,
            customerIds: hasCustomerId ? [] : undefined,
          });
        }
        const entry = productMap.get(itemId);
        entry.count += count;
        if (hasCustomerId && customerId && customerId !== '(not set)' && !entry.customerIds.includes(customerId)) {
          entry.customerIds.push(customerId);
        }
      });

      const rawRows = Array.from(productMap.values());
      const enrichedRows = await this.enrichProductsWithDb(rawRows, 'wishlist');

      const page = Math.floor(parsedOffset / parsedLimit) + 1;
      const totalPages = Math.ceil(totalRowsCount / parsedLimit) || 1;

      const result = {
        success: true,
        reportType: 'wishlist',
        propertyId: config.propertyId,
        dateRange: { startDate: start, endDate: end },
        totals: {
          totalItemsAdded: enrichedRows.reduce((sum, r) => sum + r.count, 0),
          uniqueProductsCount: totalRowsCount,
        },
        pagination: {
          total: totalRowsCount,
          page,
          limit: parsedLimit,
          offset: parsedOffset,
          totalPages,
        },
        data: enrichedRows,
      };

      setCachedReport(cacheKey, result);
      return result;
    } catch (err) {
      console.error('[AnalyticsService] Error fetching Wishlist report:', err.message);
      return this.getDatabaseWishlistReport({ startDate: start, endDate: end, limit: parsedLimit, offset: parsedOffset, sortBy, order });
    }
  }

  // ------------------------------- test analytics connection ----------------------------
  async testAnalyticsConnection() {
    const config = this.getAnalyticsConfig();
    const client = this.getClient();

    if (!config.configured || !client) {
      return {
        success: false,
        configured: false,
        propertyId: config.propertyId,
        message: 'Google Analytics credentials not found. Please provide service-account.json or GA_SERVICE_ACCOUNT_KEY.',
      };
    }

    try {
      const [res] = await client.runReport({
        property: `properties/${config.propertyId}`,
        dateRanges: [{ startDate: 'today', endDate: 'today' }],
        metrics: [{ name: 'activeUsers' }],
      });

      return {
        success: true,
        configured: true,
        propertyId: config.propertyId,
        message: 'GA4 API connected successfully.',
        activeUsersToday: parseInt(res?.rows?.[0]?.metricValues?.[0]?.value || '0', 10),
      };
    } catch (err) {
      return {
        success: false,
        configured: true,
        propertyId: config.propertyId,
        error: err.message,
        message: 'Connected to service account, but failed to query GA4 Property ID. Ensure property permissions are granted.',
      };
    }
  }

  // ------------------------------- get google access token ----------------------------
  async getGoogleAccessToken() {
    const config = this.getAnalyticsConfig();
    if (!config.keyFile) {
      throw new Error('Service account key file not configured on server.');
    }

    const auth = new GoogleAuth({
      keyFile: config.keyFile,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();

    return {
      tokenType: 'Bearer',
      accessToken: tokenResponse.token,
    };
  }

  // ------------------------------- get analytics status ----------------------------
  async getStatus() {
    const config = this.getAnalyticsConfig();
    return {
      configured: config.configured,
      propertyId: config.propertyId,
      source: config.source,
      message: config.configured
        ? 'Google Analytics Data API client is configured and ready.'
        : 'Google Analytics credentials not configured yet.',
    };
  }

  // ------------------------------- get product views report ----------------------------
  async getProductViewsReport({
    startDate = '30daysAgo',
    endDate = 'today',
    limit = 10,
    offset = 0,
    sortBy = 'count',
    order = 'desc',
    refresh = false,
  } = {}) {
    const client = this.getClient();
    const config = this.getAnalyticsConfig();

    if (!client || !config.propertyId) {
      return this.getDatabaseViewsReport({ startDate, endDate, limit, offset, sortBy, order });
    }

    try {
      const property = `properties/${config.propertyId}`;
      const isAsc = order === 'asc';
      const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
      const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

      const [res] = await client.runReport({
        property,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'itemId' }, { name: 'itemName' }],
        metrics: [{ name: 'itemsViewed' }],
        orderBys: [
          sortBy === 'name'
            ? { dimension: { dimensionName: 'itemName' }, desc: !isAsc }
            : { metric: { metricName: 'itemsViewed' }, desc: !isAsc },
        ],
        limit: parsedLimit,
        offset: parsedOffset,
      });

      const totalRowsCount = res?.rowCount || res?.rows?.length || 0;
      const rawRows = (res?.rows || [])
        .map((row) => ({
          itemId: row.dimensionValues?.[0]?.value || '',
          name: row.dimensionValues?.[1]?.value || 'Jewellery Item',
          views: parseInt(row.metricValues?.[0]?.value || '0', 10),
        }))
        .filter((p) => p.itemId && p.itemId !== '(not set)');

      const enrichedRows = await this.enrichProductsWithDb(rawRows, 'views');
      const page = Math.floor(parsedOffset / parsedLimit) + 1;
      const totalPages = Math.ceil(totalRowsCount / parsedLimit) || 1;

      return {
        success: true,
        reportType: 'views',
        propertyId: config.propertyId,
        dateRange: { startDate, endDate },
        totals: {
          totalItemsAdded: enrichedRows.reduce((sum, r) => sum + (r.count || r.views || 0), 0),
          uniqueProductsCount: totalRowsCount,
        },
        pagination: {
          total: totalRowsCount,
          page,
          limit: parsedLimit,
          offset: parsedOffset,
          totalPages,
        },
        data: enrichedRows,
      };
    } catch (err) {
      console.error('[AnalyticsService] Error fetching Views report:', err.message);
      return this.getDatabaseViewsReport({ startDate, endDate, limit, offset, sortBy, order });
    }
  }

  // ------------------------------- get database cart report ----------------------------
  async getDatabaseCartReport({
    startDate = '30daysAgo',
    endDate = 'today',
    limit = 10,
    offset = 0,
    sortBy = 'count',
    order = 'desc',
  } = {}) {
    try {
      const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
      const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

      const cartAgg = await Cart.aggregate([
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.refId',
            count: { $sum: '$items.quantity' },
            customerIds: { $addToSet: '$userId' },
          },
        },
        { $sort: { count: order === 'asc' ? 1 : -1 } },
      ]);

      const totalRowsCount = cartAgg.length;
      const paginatedAgg = cartAgg.slice(parsedOffset, parsedOffset + parsedLimit);

      const rawRows = paginatedAgg.map((r) => ({
        itemId: String(r._id),
        name: 'Jewellery Item',
        count: r.count,
        customerIds: (r.customerIds || []).map((id) => String(id)),
      }));

      const enrichedRows = await this.enrichProductsWithDb(rawRows, 'cart');
      const page = Math.floor(parsedOffset / parsedLimit) + 1;
      const totalPages = Math.ceil(totalRowsCount / parsedLimit) || 1;

      return {
        success: true,
        reportType: 'add-to-cart',
        propertyId: null,
        dateRange: { startDate, endDate },
        totals: {
          totalItemsAdded: cartAgg.reduce((s, r) => s + r.count, 0),
          uniqueProductsCount: totalRowsCount,
        },
        pagination: {
          total: totalRowsCount,
          page,
          limit: parsedLimit,
          offset: parsedOffset,
          totalPages,
        },
        data: enrichedRows,
      };
    } catch (err) {
      console.error('[AnalyticsService] Error in getDatabaseCartReport:', err.message);
      return {
        success: true,
        reportType: 'add-to-cart',
        propertyId: null,
        dateRange: { startDate, endDate },
        totals: { totalItemsAdded: 0, uniqueProductsCount: 0 },
        pagination: { total: 0, page: 1, limit, offset, totalPages: 1 },
        data: [],
      };
    }
  }

  // ------------------------------- get database wishlist report ----------------------------
  async getDatabaseWishlistReport({
    startDate = '30daysAgo',
    endDate = 'today',
    limit = 10,
    offset = 0,
    sortBy = 'count',
    order = 'desc',
  } = {}) {
    try {
      const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
      const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

      const wishlistAgg = await Wishlist.aggregate([
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.refId',
            count: { $sum: 1 },
            customerIds: { $addToSet: '$userId' },
          },
        },
        { $sort: { count: order === 'asc' ? 1 : -1 } },
      ]);

      const totalRowsCount = wishlistAgg.length;
      const paginatedAgg = wishlistAgg.slice(parsedOffset, parsedOffset + parsedLimit);

      const rawRows = paginatedAgg.map((r) => ({
        itemId: String(r._id),
        name: 'Jewellery Item',
        count: r.count,
        customerIds: (r.customerIds || []).map((id) => String(id)),
      }));

      const enrichedRows = await this.enrichProductsWithDb(rawRows, 'wishlist');
      const page = Math.floor(parsedOffset / parsedLimit) + 1;
      const totalPages = Math.ceil(totalRowsCount / parsedLimit) || 1;

      return {
        success: true,
        reportType: 'wishlist',
        propertyId: null,
        dateRange: { startDate, endDate },
        totals: {
          totalItemsAdded: wishlistAgg.reduce((s, r) => s + r.count, 0),
          uniqueProductsCount: totalRowsCount,
        },
        pagination: {
          total: totalRowsCount,
          page,
          limit: parsedLimit,
          offset: parsedOffset,
          totalPages,
        },
        data: enrichedRows,
      };
    } catch (err) {
      console.error('[AnalyticsService] Error in getDatabaseWishlistReport:', err.message);
      return {
        success: true,
        reportType: 'wishlist',
        propertyId: null,
        dateRange: { startDate, endDate },
        totals: { totalItemsAdded: 0, uniqueProductsCount: 0 },
        pagination: { total: 0, page: 1, limit, offset, totalPages: 1 },
        data: [],
      };
    }
  }

  // ------------------------------- get database views report ----------------------------
  async getDatabaseViewsReport({
    startDate = '30daysAgo',
    endDate = 'today',
    limit = 10,
    offset = 0,
    sortBy = 'count',
    order = 'desc',
  } = {}) {
    try {
      const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
      const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

      const total = await Product.countDocuments({ 'meta.deletedAt': null });
      const products = await Product.find({ 'meta.deletedAt': null })
        .select('basicInfo pricing colorImages ornate images productType categoryIds')
        .populate('categoryIds', 'name')
        .sort({ createdAt: -1 })
        .skip(parsedOffset)
        .limit(parsedLimit)
        .lean();

      const rawRows = products.map((p) => ({
        itemId: String(p._id),
        name: p.basicInfo?.title || 'Jewellery Product',
        views: 0,
      }));

      const enrichedRows = await this.enrichProductsWithDb(rawRows, 'views');
      const page = Math.floor(parsedOffset / parsedLimit) + 1;
      const totalPages = Math.ceil(total / parsedLimit) || 1;

      return {
        success: true,
        reportType: 'views',
        propertyId: null,
        dateRange: { startDate, endDate },
        totals: {
          totalItemsAdded: 0,
          uniqueProductsCount: total,
        },
        pagination: {
          total,
          page,
          limit: parsedLimit,
          offset: parsedOffset,
          totalPages,
        },
        data: enrichedRows,
      };
    } catch (err) {
      console.error('[AnalyticsService] Error in getDatabaseViewsReport:', err.message);
      return {
        success: true,
        reportType: 'views',
        propertyId: null,
        dateRange: { startDate, endDate },
        totals: { totalItemsAdded: 0, uniqueProductsCount: 0 },
        pagination: { total: 0, page: 1, limit, offset, totalPages: 1 },
        data: [],
      };
    }
  }

  // ------------------------------- get database overview ----------------------------
  async getDatabaseOverview(startDate, endDate) {
    const config = this.getAnalyticsConfig();
    try {
      const [totalUsers, cartAgg, wishlistAgg] = await Promise.all([
        User.countDocuments({ 'meta.deletedAt': null }),
        Cart.aggregate([
          { $unwind: '$items' },
          { $group: { _id: null, total: { $sum: '$items.quantity' } } },
        ]),
        Wishlist.aggregate([
          { $unwind: '$items' },
          { $group: { _id: null, total: { $sum: 1 } } },
        ]),
      ]);

      const addToCart = cartAgg[0]?.total || 0;
      const addToWishlist = wishlistAgg[0]?.total || 0;

      const topProductsReport = await this.getDatabaseViewsReport({ limit: 5 });

      return {
        configured: Boolean(config.propertyId),
        propertyId: config.propertyId || null,
        summary: {
          totalUsers,
          totalSessions: 0,
          pageViews: 0,
          productViews: 0,
          addToCart,
          addToWishlist,
          avgDurationSec: 0,
          bounceRate: 0,
          trends: {},
        },
        timeline: [],
        topProducts: topProductsReport.data || [],
        trafficSources: [],
      };
    } catch (err) {
      console.error('[AnalyticsService] Error in getDatabaseOverview:', err.message);
      return {
        configured: false,
        propertyId: null,
        summary: {
          totalUsers: 0,
          totalSessions: 0,
          pageViews: 0,
          productViews: 0,
          addToCart: 0,
          addToWishlist: 0,
          avgDurationSec: 0,
          bounceRate: 0,
          trends: {},
        },
        timeline: [],
        topProducts: [],
        trafficSources: [],
      };
    }
  }

  // ------------------------------- get dashboard sales metrics ----------------------------
  async getDashboardSalesMetrics(query = {}) {
    try {
      const now = new Date();
      const period = query.period || '30days';
      const startDate = query.startDate;
      const endDate = query.endDate;

      let startTime, endTime;
      let numPoints = 11;
      const points = [];

      if (startDate && endDate) {
        startTime = new Date(startDate);
        startTime.setHours(0, 0, 0, 0);
        endTime = new Date(endDate);
        endTime.setHours(23, 59, 59, 999);
        const totalDuration = endTime.getTime() - startTime.getTime();
        const daysDiff = Math.max(1, Math.round(totalDuration / (1000 * 60 * 60 * 24)));
        numPoints = Math.min(12, Math.max(2, daysDiff + 1));
        for (let i = 0; i < numPoints; i++) {
          const d = new Date(startTime.getTime() + (totalDuration / (numPoints - 1 || 1)) * i);
          points.push(d);
        }
      } else if (period === 'today') {
        numPoints = 8;
        startTime = new Date(now);
        startTime.setHours(0, 0, 0, 0);
        endTime = new Date(now);
        endTime.setHours(23, 59, 59, 999);
        for (let i = 0; i < numPoints; i++) {
          const d = new Date(startTime);
          d.setHours(i * 3, 0, 0, 0);
          points.push(d);
        }
      } else if (period === 'yesterday') {
        numPoints = 8;
        startTime = new Date(now);
        startTime.setDate(now.getDate() - 1);
        startTime.setHours(0, 0, 0, 0);
        endTime = new Date(startTime);
        endTime.setHours(23, 59, 59, 999);
        for (let i = 0; i < numPoints; i++) {
          const d = new Date(startTime);
          d.setHours(i * 3, 0, 0, 0);
          points.push(d);
        }
      } else if (period === '7days') {
        numPoints = 7;
        for (let i = 0; i < numPoints; i++) {
          const d = new Date(now);
          d.setDate(now.getDate() - (numPoints - 1 - i));
          d.setHours(0, 0, 0, 0);
          points.push(d);
        }
        startTime = new Date(points[0]);
        endTime = new Date(now);
      } else if (period === '90days') {
        numPoints = 10;
        for (let i = 0; i < numPoints; i++) {
          const d = new Date(now);
          d.setDate(now.getDate() - (numPoints - 1 - i) * 9);
          d.setHours(0, 0, 0, 0);
          points.push(d);
        }
        startTime = new Date(points[0]);
        endTime = new Date(now);
      } else if (period === 'thisYear' || period === '1year') {
        numPoints = 12;
        const currentYear = now.getFullYear();
        for (let i = 0; i < 12; i++) {
          const d = new Date(currentYear, i, 1);
          points.push(d);
        }
        startTime = new Date(currentYear, 0, 1);
        endTime = new Date(now);
      } else {
        // Default: 30 days
        numPoints = 11;
        for (let i = 0; i < numPoints; i++) {
          const d = new Date(now);
          d.setDate(now.getDate() - (numPoints - 1 - i) * 3);
          d.setHours(0, 0, 0, 0);
          points.push(d);
        }
        startTime = new Date(points[0]);
        endTime = new Date(now);
      }

      // Query real orders in DB (checking meta.createdAt, orderTimeline, or createdAt)
      let orders = [];
      try {
        orders = await Order.find({
          'meta.deletedAt': null,
          orderStatus: { $ne: 'cancelled' },
          $or: [
            { 'meta.createdAt': { $gte: startTime, $lte: endTime } },
            { 'orderTimeline.placed.at': { $gte: startTime, $lte: endTime } },
            { createdAt: { $gte: startTime, $lte: endTime } },
          ],
        })
          .populate({
            path: 'items.refId',
            select: 'basicInfo categoryIds productType title sku',
            strictPopulate: false,
            populate: { path: 'categoryIds', select: 'name slug', strictPopulate: false },
          })
          .lean();
      } catch (err) {
        console.warn('[AnalyticsService] Orders query failed:', err.message);
        orders = [];
      }

      // Map real orders to closest anchor date
      const realDailyMetrics = new Array(numPoints).fill(null).map(() => ({ revenue: 0, orders: 0 }));
      const realCategoryMap = new Map();

      for (const order of orders) {
        const orderDateStr = order.orderTimeline?.placed?.at || order.meta?.createdAt || order.createdAt;
        const orderTime = orderDateStr ? new Date(orderDateStr).getTime() : Date.now();
        const orderRev = Number(order.pricing?.total) || Number(order.pricing?.subtotal) || 0;

        let closestIdx = numPoints - 1;
        let minDiff = Infinity;
        for (let i = 0; i < points.length; i++) {
          const diff = Math.abs(points[i].getTime() - orderTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        }
        realDailyMetrics[closestIdx].revenue += orderRev;
        realDailyMetrics[closestIdx].orders += 1;

        if (Array.isArray(order.items)) {
          for (const item of order.items) {
            const itemPrice = Number(item.totalItemPrice) || (Number(item.price) * (item.quantity || 1)) || 0;
            const p = item.refId;
            const catName = item.itemType === 'diamond' ? 'Diamond' : (p?.categoryIds?.[0]?.name || (
              item.title?.toLowerCase().includes('ring') ? 'Rings' :
              item.title?.toLowerCase().includes('earring') || item.title?.toLowerCase().includes('butti') ? 'Earrings' :
              item.title?.toLowerCase().includes('pendant') ? 'Pendant' :
              item.title?.toLowerCase().includes('necklace') ? 'Necklace' :
              item.title?.toLowerCase().includes('bangle') || item.title?.toLowerCase().includes('bracelet') ? 'Bangles' : 'Other Jewelry'
            ));
            realCategoryMap.set(catName, (realCategoryMap.get(catName) || 0) + itemPrice);
          }
        }
      }

      const formatCurrencyShort = (val) => {
        if (!val || val === 0) return '₹0';
        if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
        if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
        if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
        return `₹${Math.round(val).toLocaleString('en-IN')}`;
      };

      const timeline = points.map((date, idx) => {
        let label;
        if (period === 'today' || period === 'yesterday') {
          const h = date.getHours();
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 || 12;
          label = `${h12} ${ampm}`;
        } else if (period === 'thisYear' || period === '1year') {
          label = date.toLocaleDateString('en-US', { month: 'short' });
        } else {
          const day = String(date.getDate()).padStart(2, '0');
          const month = date.toLocaleDateString('en-US', { month: 'short' });
          label = `${day} ${month}`;
        }

        const rev = Math.round(realDailyMetrics[idx]?.revenue || 0);
        const ord = realDailyMetrics[idx]?.orders || 0;

        return {
          date: date.toISOString().split('T')[0],
          label,
          revenue: rev,
          orders: ord,
          formattedRevenue: formatCurrencyShort(rev),
        };
      });

      const totalSales = timeline.reduce((sum, item) => sum + item.revenue, 0);
      const totalOrdersCount = timeline.reduce((sum, item) => sum + item.orders, 0);

      // Category breakdown dynamically derived strictly from real orders
      const palette = ['#7c4a27', '#9d6935', '#be894e', '#d3aa76', '#e4caa3', '#f0dfc8', '#a07855', '#6b4423'];
      const totalCatRev = Array.from(realCategoryMap.values()).reduce((a, b) => a + b, 0);

      const categorySales = Array.from(realCategoryMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, catRev], idx) => {
          const pct = totalCatRev > 0 ? Math.round((catRev / totalCatRev) * 100) : 0;
          return {
            name,
            percentage: pct,
            revenue: Math.round(catRev),
            formattedRevenue: formatCurrencyShort(catRev),
            color: palette[idx % palette.length],
          };
        });

      return {
        timeline,
        categorySales,
        totalSales,
        formattedTotalSales: formatCurrencyShort(totalSales),
        totalOrders: totalOrdersCount,
      };
    } catch (error) {
      console.error('[AnalyticsService] Error in getDashboardSalesMetrics:', error);
      throw error;
    }
  }
}

module.exports = new AnalyticsService();
