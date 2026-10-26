const path = require('path');
const fs = require('fs');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const Product = require('../product/product.model');

class AnalyticsService {
  constructor() {
    this.client = null;
    this.clientKeyPath = null;
  }

  /**
   * Resolve GA4 property ID and service account credentials configuration
   */
  getAnalyticsConfig() {
    const propertyId = (process.env.GA4_PROPERTY_ID || '555775827').trim();

    // 1. Primary: src/config/service-account.json
    const serviceAccountPath = path.join(__dirname, '../../config/service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      try {
        const stats = fs.statSync(serviceAccountPath);
        if (stats.size > 0) {
          return {
            propertyId,
            clientOptions: { keyFilename: serviceAccountPath },
            source: 'service-account.json',
            configured: true,
          };
        }
      } catch (e) {
        // fall through
      }
    }

    // 4. Inline JSON string from environment variable
    if (process.env.GA_SERVICE_ACCOUNT_KEY) {
      try {
        const credentials = JSON.parse(process.env.GA_SERVICE_ACCOUNT_KEY);
        return {
          propertyId,
          clientOptions: { credentials },
          source: 'GA_SERVICE_ACCOUNT_KEY (env)',
          configured: true,
        };
      } catch (err) {
        console.warn('[AnalyticsService] Failed to parse GA_SERVICE_ACCOUNT_KEY JSON:', err);
      }
    }

    return {
      propertyId,
      clientOptions: null,
      source: 'none',
      configured: false,
    };
  }

  /**
   * Lazily initialize Google Analytics Data API client
   */
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
      console.error('[AnalyticsService] Failed to initialize BetaAnalyticsDataClient:', err);
      this.client = null;
      return null;
    }
  }

  /**
   * Current connection status check
   */
  async getStatus() {
    const config = this.getAnalyticsConfig();
    return {
      configured: config.configured,
      propertyId: config.propertyId,
      source: config.source,
      message: config.configured
        ? 'Google Analytics Data API client is configured and ready.'
        : 'Google Analytics credentials not configured yet. The senior developer can configure GA4_PROPERTY_ID and service account credentials.',
    };
  }

  /**
   * Overview Report: Total Users, Sessions, Page Views, Avg Duration, Engagement Rate
   */
  async getOverview({ startDate = '30daysAgo', endDate = 'today' } = {}) {
    const config = this.getAnalyticsConfig();
    const client = this.getClient();

    if (!client) {
      const sample = this._getSampleOverview();
      return {
        configured: false,
        propertyId: config.propertyId,
        ...sample,
      };
    }

    try {
      // 1. Current period report
      const [currentResponse] = await client.runReport({
        property: `properties/${config.propertyId}`,
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
          { name: 'engagementRate' },
        ],
      });

      // 2. Previous period for trend calculation (same number of days)
      const prevStartDate = this._getPreviousPeriodStartDate(startDate);
      const [prevResponse] = await client.runReport({
        property: `properties/${config.propertyId}`,
        dateRanges: [{ startDate: prevStartDate, endDate: startDate }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
        ],
      }).catch(() => [null]);

      const curValues = currentResponse?.rows?.[0]?.metricValues || [];
      const totalUsers = parseInt(curValues[0]?.value || 0, 10);
      const totalSessions = parseInt(curValues[1]?.value || 0, 10);
      const pageViews = parseInt(curValues[2]?.value || 0, 10);
      const avgDurationSec = parseFloat(curValues[3]?.value || 0);
      const engagementRate = parseFloat(curValues[4]?.value || 0);

      const prevValues = prevResponse?.rows?.[0]?.metricValues || [];
      const prevUsers = parseInt(prevValues[0]?.value || 0, 10);
      const prevSessions = parseInt(prevValues[1]?.value || 0, 10);
      const prevPageViews = parseInt(prevValues[2]?.value || 0, 10);

      return {
        configured: true,
        propertyId: config.propertyId,
        summary: {
          totalUsers,
          totalSessions,
          pageViews,
          averageSessionDuration: this._formatDuration(avgDurationSec),
          engagementRate: `${(engagementRate * 100).toFixed(1)}%`,
          trends: {
            users: this._calcPercentChange(totalUsers, prevUsers),
            sessions: this._calcPercentChange(totalSessions, prevSessions),
            pageViews: this._calcPercentChange(pageViews, prevPageViews),
          },
        },
      };
    } catch (err) {
      console.error('[AnalyticsService] Error fetching GA4 overview:', err);
      return {
        configured: false,
        error: err.message,
        propertyId: config.propertyId,
        ...this._getSampleOverview(),
      };
    }
  }

  /**
   * Timeline Report: Daily breakdown for charts
   */
  async getTimeline({ startDate = '30daysAgo', endDate = 'today' } = {}) {
    const config = this.getAnalyticsConfig();
    const client = this.getClient();

    if (!client) {
      return {
        configured: false,
        timeline: this._getSampleTimeline(),
      };
    }

    try {
      const [response] = await client.runReport({
        property: `properties/${config.propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      });

      const timeline = (response.rows || []).map((row) => {
        const rawDate = row.dimensionValues[0]?.value || '';
        // Format YYYYMMDD to YYYY-MM-DD
        const formattedDate = rawDate.length === 8
          ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
          : rawDate;

        return {
          date: formattedDate,
          users: parseInt(row.metricValues[0]?.value || 0, 10),
          sessions: parseInt(row.metricValues[1]?.value || 0, 10),
          pageViews: parseInt(row.metricValues[2]?.value || 0, 10),
        };
      });

      return { configured: true, timeline };
    } catch (err) {
      console.error('[AnalyticsService] Error fetching GA4 timeline:', err);
      return {
        configured: false,
        error: err.message,
        timeline: this._getSampleTimeline(),
      };
    }
  }

  /**
   * Top Products Report: Most viewed products enriched with catalog metadata
   */
  async getTopProducts({ startDate = '30daysAgo', endDate = 'today', limit = 10 } = {}) {
    const config = this.getAnalyticsConfig();
    const client = this.getClient();

    if (!client) {
      const sampleProducts = await this._getSampleTopProducts(limit);
      return {
        configured: false,
        topProducts: sampleProducts,
      };
    }

    try {
      // Query pagePath matching /product/
      const [response] = await client.runReport({
        property: `properties/${config.propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: {
              matchType: 'CONTAINS',
              value: '/product',
            },
          },
        },
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: Math.max(limit, 20),
      });

      const rawItems = (response.rows || []).map((row) => ({
        pagePath: row.dimensionValues[0]?.value || '',
        pageTitle: row.dimensionValues[1]?.value || '',
        views: parseInt(row.metricValues[0]?.value || 0, 10),
        users: parseInt(row.metricValues[1]?.value || 0, 10),
      }));

      // Extract product IDs / slugs from /product/:id
      const enrichedProducts = await this._enrichProductsFromCatalog(rawItems, limit);

      return { configured: true, topProducts: enrichedProducts };
    } catch (err) {
      console.error('[AnalyticsService] Error fetching top products:', err);
      const sample = await this._getSampleTopProducts(limit);
      return {
        configured: false,
        error: err.message,
        topProducts: sample,
      };
    }
  }

  /**
   * Traffic Sources Report: Channel groupings and sources
   */
  async getTrafficSources({ startDate = '30daysAgo', endDate = 'today' } = {}) {
    const config = this.getAnalyticsConfig();
    const client = this.getClient();

    if (!client) {
      return {
        configured: false,
        trafficSources: this._getSampleTrafficSources(),
      };
    }

    try {
      const [response] = await client.runReport({
        property: `properties/${config.propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      });

      const trafficSources = (response.rows || []).map((row) => ({
        channel: row.dimensionValues[0]?.value || 'Direct',
        sessions: parseInt(row.metricValues[0]?.value || 0, 10),
        users: parseInt(row.metricValues[1]?.value || 0, 10),
      }));

      return { configured: true, trafficSources };
    } catch (err) {
      console.error('[AnalyticsService] Error fetching traffic sources:', err);
      return {
        configured: false,
        error: err.message,
        trafficSources: this._getSampleTrafficSources(),
      };
    }
  }

  /**
   * Realtime Report: Active users right now (last 30 minutes)
   */
  async getRealtime() {
    const config = this.getAnalyticsConfig();
    const client = this.getClient();

    if (!client) {
      return {
        configured: false,
        activeUsers: 1,
        activePages: [{ pagePath: '/', activeUsers: 1 }],
      };
    }

    try {
      const [response] = await client.runRealtimeReport({
        property: `properties/${config.propertyId}`,
        dimensions: [{ name: 'unifiedScreenName' }],
        metrics: [{ name: 'activeUsers' }],
      });

      let totalActive = 0;
      const pages = (response.rows || []).map((row) => {
        const count = parseInt(row.metricValues[0]?.value || 0, 10);
        totalActive += count;
        return {
          pagePath: row.dimensionValues[0]?.value || '/',
          activeUsers: count,
        };
      });

      return {
        configured: true,
        activeUsers: Math.max(totalActive, 0),
        activePages: pages.slice(0, 5),
      };
    } catch (err) {
      console.warn('[AnalyticsService] Realtime report error:', err);
      return {
        configured: false,
        error: err.message,
        activeUsers: 0,
        activePages: [],
      };
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  async _enrichProductsFromCatalog(rawItems, limit) {
    if (!rawItems.length) return [];

    const extracted = [];
    for (const item of rawItems) {
      const match = item.pagePath.match(/\/product\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        extracted.push({
          rawId: match[1],
          views: item.views,
          users: item.users,
          fallbackTitle: item.pageTitle || 'Product',
        });
      }
    }

    if (!extracted.length) return [];

    const ids = extracted.map((e) => e.rawId);
    let catalogProducts = [];
    try {
      catalogProducts = await Product.find({
        $or: [
          { _id: { $in: ids.filter((id) => id.match(/^[0-9a-fA-F]{24}$/)) } },
          { 'basicInfo.slug': { $in: ids } },
        ],
        'meta.deletedAt': null,
      })
        .select('_id basicInfo pricing ornate colorImages')
        .lean();
    } catch (err) {
      console.warn('[AnalyticsService] Catalog enrichment query error:', err);
    }

    const prodMap = new Map();
    for (const p of catalogProducts) {
      prodMap.set(String(p._id), p);
      if (p.basicInfo?.slug) prodMap.set(p.basicInfo.slug, p);
    }

    const results = [];
    for (const e of extracted) {
      const prod = prodMap.get(e.rawId);
      const title = prod?.basicInfo?.title || e.fallbackTitle.replace(/ \| Neirah.*$/i, '').trim() || 'Product';
      const price = prod?.pricing?.salePrice || prod?.pricing?.mrp || 0;
      const image = prod?.colorImages?.[0]?.images?.[0]?.url || prod?.ornate?.ornateImages?.[0]?.url || '';

      results.push({
        id: prod ? String(prod._id) : e.rawId,
        title,
        price,
        image,
        views: e.views,
        users: e.users,
        sku: prod?.basicInfo?.sku || prod?.ornate?.tagNo || '',
      });

      if (results.length >= limit) break;
    }

    return results;
  }

  async _getSampleTopProducts(limit = 5) {
    try {
      const dbProducts = await Product.find({ 'meta.deletedAt': null })
        .select('_id basicInfo pricing ornate colorImages')
        .limit(limit)
        .lean();

      return dbProducts.map((p, idx) => ({
        id: String(p._id),
        title: p.basicInfo?.title || 'Jewellery Item',
        price: p.pricing?.salePrice || p.pricing?.mrp || 0,
        image: p.colorImages?.[0]?.images?.[0]?.url || p.ornate?.ornateImages?.[0]?.url || '',
        views: Math.max(0, 15 - idx * 2) * 12,
        users: Math.max(0, 15 - idx * 2) * 8,
        sku: p.basicInfo?.sku || p.ornate?.tagNo || '',
      }));
    } catch {
      return [];
    }
  }

  _getSampleOverview() {
    return {
      summary: {
        totalUsers: 1420,
        totalSessions: 2180,
        pageViews: 6850,
        averageSessionDuration: '2m 45s',
        engagementRate: '68.4%',
        trends: {
          users: '+14.2%',
          sessions: '+18.5%',
          pageViews: '+22.1%',
        },
      },
    };
  }

  _getSampleTimeline() {
    const list = [];
    const now = new Date();
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      list.push({
        date: iso,
        users: 70 + Math.floor(Math.sin(i) * 20) + (i % 4) * 10,
        sessions: 110 + Math.floor(Math.sin(i) * 30) + (i % 5) * 15,
        pageViews: 320 + Math.floor(Math.sin(i) * 80) + (i % 4) * 40,
      });
    }
    return list;
  }

  _getSampleTrafficSources() {
    return [
      { channel: 'Direct', sessions: 850, users: 540 },
      { channel: 'Organic Search', sessions: 620, users: 430 },
      { channel: 'Social Media', sessions: 410, users: 290 },
      { channel: 'Referral', sessions: 180, users: 110 },
      { channel: 'Email', sessions: 120, users: 50 },
    ];
  }

  _calcPercentChange(current, previous) {
    if (!previous || previous === 0) return current > 0 ? '+100%' : '0%';
    const diff = ((current - previous) / previous) * 100;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(1)}%`;
  }

  _formatDuration(seconds) {
    const s = Math.round(Number(seconds) || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}m ${rem}s`;
  }

  _getPreviousPeriodStartDate(startDate) {
    if (startDate === '7daysAgo') return '14daysAgo';
    if (startDate === '30daysAgo') return '60daysAgo';
    if (startDate === '90daysAgo') return '180daysAgo';
    return '60daysAgo';
  }
}

module.exports = new AnalyticsService();
