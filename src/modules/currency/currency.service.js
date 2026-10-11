const https = require('https');
const Currency = require('./currency.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

// Default initial currencies matching the luxury admin portal screenshot
const DEFAULT_CURRENCIES = [
  {
    currencyInfo: { code: 'INR', name: 'Indian Rupee', symbol: '₹', countryCode: 'IN' },
    exchangeRate: { baseCurrency: 'INR', rate: 1, inrRate: 1, lastFetchedAt: new Date() },
    settings: { isBaseCurrency: true, useLiveRate: false, isActive: true, sortOrder: 1 },
    metadata: { isDeleted: false },
  },
  {
    currencyInfo: { code: 'USD', name: 'US Dollar', symbol: '$', countryCode: 'US' },
    exchangeRate: { baseCurrency: 'INR', rate: 0.0103, inrRate: 96.83, lastFetchedAt: new Date() },
    settings: { isBaseCurrency: false, useLiveRate: true, isActive: true, sortOrder: 2 },
    metadata: { isDeleted: false },
  },
  {
    currencyInfo: { code: 'EUR', name: 'Euro', symbol: '€', countryCode: 'EU' },
    exchangeRate: { baseCurrency: 'INR', rate: 0.0092, inrRate: 108.5538, lastFetchedAt: new Date() },
    settings: { isBaseCurrency: false, useLiveRate: true, isActive: true, sortOrder: 3 },
    metadata: { isDeleted: false },
  },
  {
    currencyInfo: { code: 'GBP', name: 'British Pound', symbol: '£', countryCode: 'GB' },
    exchangeRate: { baseCurrency: 'INR', rate: 0.0078, inrRate: 128.082, lastFetchedAt: new Date() },
    settings: { isBaseCurrency: false, useLiveRate: true, isActive: true, sortOrder: 4 },
    metadata: { isDeleted: false },
  },
  {
    currencyInfo: { code: 'AED', name: 'UAE Dirham', symbol: 'AED', countryCode: 'AE' },
    exchangeRate: { baseCurrency: 'INR', rate: 0.0379, inrRate: 26.3842, lastFetchedAt: new Date() },
    settings: { isBaseCurrency: false, useLiveRate: true, isActive: true, sortOrder: 5 },
    metadata: { isDeleted: false },
  },
  {
    currencyInfo: { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', countryCode: 'CA' },
    exchangeRate: { baseCurrency: 'INR', rate: 0.0148, inrRate: 67.7133, lastFetchedAt: new Date() },
    settings: { isBaseCurrency: false, useLiveRate: true, isActive: true, sortOrder: 6 },
    metadata: { isDeleted: false },
  },
  {
    currencyInfo: { code: 'AUD', name: 'Australian Dollar', symbol: 'AU$', countryCode: 'AU' },
    exchangeRate: { baseCurrency: 'INR', rate: 0.0148, inrRate: 67.7133, lastFetchedAt: new Date() },
    settings: { isBaseCurrency: false, useLiveRate: true, isActive: true, sortOrder: 7 },
    metadata: { isDeleted: false },
  },
  {
    currencyInfo: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', countryCode: 'JP' },
    exchangeRate: { baseCurrency: 'INR', rate: 1.6347, inrRate: 0.6117, lastFetchedAt: new Date() },
    settings: { isBaseCurrency: false, useLiveRate: true, isActive: true, sortOrder: 8 },
    metadata: { isDeleted: false },
  },
];

/**
 * Fetch external forex rates using native https
 */
function fetchForexRates(base = 'INR') {
  return new Promise((resolve, reject) => {
    const url = `https://open.er-api.com/v6/latest/${base}`;
    https.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.rates) {
            resolve(parsed.rates);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

class CurrencyService {
  /**
   * Seed default currencies if database collection is empty
   */
  async seedIfEmpty() {
    const count = await Currency.countDocuments({ 'metadata.isDeleted': false });
    if (count === 0) {
      for (const cur of DEFAULT_CURRENCIES) {
        await Currency.findOneAndUpdate(
          { 'currencyInfo.code': cur.currencyInfo.code },
          { $setOnInsert: cur },
          { upsert: true, new: true }
        );
      }
    }
  }

  /**
   * Get all currencies with search, filter, and pagination
   */
  async getAll(queryParams = {}) {
    await this.seedIfEmpty();

    const filter = { 'metadata.isDeleted': false };

    if (queryParams.activeOnly === 'true' || queryParams.status === 'active') {
      filter['settings.isActive'] = true;
    }

    if (queryParams.search) {
      const q = new RegExp(queryParams.search.trim(), 'i');
      filter.$or = [
        { 'currencyInfo.code': q },
        { 'currencyInfo.name': q },
        { 'currencyInfo.symbol': q },
      ];
    }

    const sortOptions = {
      'settings.sortOrder': 1,
      'settings.isBaseCurrency': -1,
      createdAt: 1,
    };

    if (queryParams.page && queryParams.limit) {
      const { page, limit, skip } = getPagination(queryParams);
      const [items, totalDocs] = await Promise.all([
        Currency.find(filter).sort(sortOptions).skip(skip).limit(limit).lean(),
        Currency.countDocuments(filter),
      ]);
      return {
        items,
        pagination: getPaginationMeta(totalDocs, page, limit),
      };
    }

    const items = await Currency.find(filter).sort(sortOptions).lean();
    return {
      items,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalDocs: items.length,
        limit: items.length,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }

  /**
   * Get currency by ID
   */
  async getOne(id) {
    const currency = await Currency.findOne({ _id: id, 'metadata.isDeleted': false });
    if (!currency) {
      throw new ApiError(404, 'Currency not found');
    }
    return currency;
  }

  /**
   * Get currency by code (e.g. USD, EUR)
   */
  async getByCode(code) {
    const currency = await Currency.findOne({
      'currencyInfo.code': code.toUpperCase(),
      'metadata.isDeleted': false,
    });
    if (!currency) {
      throw new ApiError(404, `Currency ${code} not found`);
    }
    return currency;
  }

  /**
   * Create new currency
   */
  async create(data) {
    const code = (data.currencyInfo?.code || '').trim().toUpperCase();
    if (!code) {
      throw new ApiError(400, 'Currency code is required');
    }

    // Check if code already exists
    const existing = await Currency.findOne({
      'currencyInfo.code': code,
      'metadata.isDeleted': false,
    });
    if (existing) {
      throw new ApiError(409, `Currency with code "${code}" already exists`);
    }

    // If marked as base currency, unset previous base
    if (data.settings?.isBaseCurrency) {
      await Currency.updateMany({}, { $set: { 'settings.isBaseCurrency': false } });
    }

    // Calculate rates if one is provided
    let inrRate = Number(data.exchangeRate?.inrRate) || 1;
    let rate = Number(data.exchangeRate?.rate) || (inrRate > 0 ? 1 / inrRate : 1);

    if (data.settings?.isBaseCurrency) {
      inrRate = 1;
      rate = 1;
    }

    const doc = new Currency({
      currencyInfo: {
        code,
        name: data.currencyInfo?.name || code,
        symbol: data.currencyInfo?.symbol || code,
        countryCode: (data.currencyInfo?.countryCode || '').trim().toUpperCase(),
      },
      exchangeRate: {
        baseCurrency: data.exchangeRate?.baseCurrency || 'INR',
        rate: Number(rate.toFixed(6)),
        inrRate: Number(inrRate.toFixed(4)),
        lastFetchedAt: new Date(),
      },
      settings: {
        isBaseCurrency: Boolean(data.settings?.isBaseCurrency),
        useLiveRate: data.settings?.useLiveRate !== undefined ? Boolean(data.settings.useLiveRate) : true,
        isActive: data.settings?.isActive !== undefined ? Boolean(data.settings.isActive) : true,
        sortOrder: Number(data.settings?.sortOrder) || 0,
      },
      metadata: {
        isDeleted: false,
      },
    });

    return await doc.save();
  }

  /**
   * Update currency
   */
  async update(id, data) {
    const currency = await Currency.findOne({ _id: id, 'metadata.isDeleted': false });
    if (!currency) {
      throw new ApiError(404, 'Currency not found');
    }

    // Check unique code if changed
    if (data.currencyInfo?.code) {
      const nextCode = data.currencyInfo.code.trim().toUpperCase();
      if (nextCode !== currency.currencyInfo.code) {
        const existing = await Currency.findOne({
          _id: { $ne: id },
          'currencyInfo.code': nextCode,
          'metadata.isDeleted': false,
        });
        if (existing) {
          throw new ApiError(409, `Currency with code "${nextCode}" already exists`);
        }
        currency.currencyInfo.code = nextCode;
      }
    }

    if (data.currencyInfo?.name !== undefined) currency.currencyInfo.name = data.currencyInfo.name;
    if (data.currencyInfo?.symbol !== undefined) currency.currencyInfo.symbol = data.currencyInfo.symbol;
    if (data.currencyInfo?.countryCode !== undefined) currency.currencyInfo.countryCode = data.currencyInfo.countryCode.trim().toUpperCase();

    // If making base currency, unset others
    if (data.settings?.isBaseCurrency) {
      await Currency.updateMany({ _id: { $ne: id } }, { $set: { 'settings.isBaseCurrency': false } });
      currency.settings.isBaseCurrency = true;
      currency.exchangeRate.rate = 1;
      currency.exchangeRate.inrRate = 1;
      currency.settings.useLiveRate = false;
    } else if (data.settings?.isBaseCurrency === false) {
      currency.settings.isBaseCurrency = false;
    }

    if (data.settings?.useLiveRate !== undefined) currency.settings.useLiveRate = Boolean(data.settings.useLiveRate);
    if (data.settings?.isActive !== undefined) currency.settings.isActive = Boolean(data.settings.isActive);
    if (data.settings?.sortOrder !== undefined) currency.settings.sortOrder = Number(data.settings.sortOrder);

    // If rate changed manually
    if (!currency.settings.isBaseCurrency) {
      if (data.exchangeRate?.inrRate !== undefined) {
        const newInr = Number(data.exchangeRate.inrRate);
        currency.exchangeRate.inrRate = Number(newInr.toFixed(4));
        currency.exchangeRate.rate = newInr > 0 ? Number((1 / newInr).toFixed(6)) : 1;
        currency.exchangeRate.lastFetchedAt = new Date();
      } else if (data.exchangeRate?.rate !== undefined) {
        const newRate = Number(data.exchangeRate.rate);
        currency.exchangeRate.rate = Number(newRate.toFixed(6));
        currency.exchangeRate.inrRate = newRate > 0 ? Number((1 / newRate).toFixed(4)) : 1;
        currency.exchangeRate.lastFetchedAt = new Date();
      }
    }

    return await currency.save();
  }

  /**
   * Delete currency (soft delete)
   */
  async delete(id) {
    const currency = await Currency.findOne({ _id: id, 'metadata.isDeleted': false });
    if (!currency) {
      throw new ApiError(404, 'Currency not found');
    }
    if (currency.settings?.isBaseCurrency) {
      throw new ApiError(400, 'Cannot delete the base currency');
    }

    currency.metadata.isDeleted = true;
    await currency.save();
    return { id, message: `${currency.currencyInfo.code} deleted successfully` };
  }

  /**
   * Sync real-time live rates for all currencies where useLiveRate is true
   */
  async syncLiveRates() {
    await this.seedIfEmpty();

    const liveRates = await fetchForexRates('INR');
    if (!liveRates) {
      throw new ApiError(503, 'Forex rates provider temporarily unreachable');
    }

    const currencies = await Currency.find({
      'metadata.isDeleted': false,
      'settings.isBaseCurrency': false,
      'settings.useLiveRate': true,
    });

    let updatedCount = 0;
    const now = new Date();

    for (const cur of currencies) {
      const code = cur.currencyInfo.code.toUpperCase();
      const ratePerInr = liveRates[code];

      if (ratePerInr && ratePerInr > 0) {
        const inrPerUnit = 1 / ratePerInr;
        cur.exchangeRate.rate = Number(ratePerInr.toFixed(6));
        cur.exchangeRate.inrRate = Number(inrPerUnit.toFixed(4));
        cur.exchangeRate.lastFetchedAt = now;
        await cur.save();
        updatedCount++;
      }
    }

    return {
      updatedCount,
      timestamp: now,
      message: `Successfully synchronized live rates for ${updatedCount} currencies`,
    };
  }

  /**
   * Sync single currency live rate
   */
  async syncOneRate(id) {
    const currency = await Currency.findOne({ _id: id, 'metadata.isDeleted': false });
    if (!currency) {
      throw new ApiError(404, 'Currency not found');
    }
    if (currency.settings?.isBaseCurrency) {
      return currency;
    }

    const liveRates = await fetchForexRates('INR');
    if (!liveRates) {
      throw new ApiError(503, 'Forex rates provider temporarily unreachable');
    }

    const code = currency.currencyInfo.code.toUpperCase();
    const ratePerInr = liveRates[code];
    if (ratePerInr && ratePerInr > 0) {
      const inrPerUnit = 1 / ratePerInr;
      currency.exchangeRate.rate = Number(ratePerInr.toFixed(6));
      currency.exchangeRate.inrRate = Number(inrPerUnit.toFixed(4));
      currency.exchangeRate.lastFetchedAt = new Date();
      await currency.save();
    }

    return currency;
  }
}

module.exports = new CurrencyService();
