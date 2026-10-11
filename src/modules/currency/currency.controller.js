const currencyService = require('./currency.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class CurrencyController {
  // Get all currencies
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await currencyService.getAll(req.query);
    if (req.query.page && req.query.limit) {
      ApiResponse.paginated(res, items, pagination, 'Currencies retrieved successfully');
    } else {
      ApiResponse.success(res, { items, pagination }, 'Currencies retrieved successfully');
    }
  });

  // Get one currency by ID
  getOne = catchAsync(async (req, res) => {
    const currency = await currencyService.getOne(req.params.id);
    ApiResponse.success(res, currency, 'Currency retrieved successfully');
  });

  // Get currency by currency code (e.g. USD)
  getByCode = catchAsync(async (req, res) => {
    const currency = await currencyService.getByCode(req.params.code);
    ApiResponse.success(res, currency, 'Currency retrieved successfully');
  });

  // Create new currency
  create = catchAsync(async (req, res) => {
    const currency = await currencyService.create(req.body);
    ApiResponse.created(res, currency, 'Currency created successfully');
  });

  // Update currency
  update = catchAsync(async (req, res) => {
    const currency = await currencyService.update(req.params.id, req.body);
    ApiResponse.success(res, currency, 'Currency updated successfully');
  });

  // Delete currency
  delete = catchAsync(async (req, res) => {
    const result = await currencyService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });

  // Synchronize live exchange rates
  syncLiveRates = catchAsync(async (req, res) => {
    const result = await currencyService.syncLiveRates();
    ApiResponse.success(res, result, result.message);
  });

  // Synchronize single currency rate
  syncOneRate = catchAsync(async (req, res) => {
    const currency = await currencyService.syncOneRate(req.params.id);
    ApiResponse.success(res, currency, `Live rate synced for ${currency.currencyInfo?.code}`);
  });
}

module.exports = new CurrencyController();
