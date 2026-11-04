const currencyService = require('./currency.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class CurrencyController {
    // ------------------------------- get all currencies ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await currencyService.getAll(req.query);
    if (req.query.page && req.query.limit) {
      ApiResponse.paginated(res, items, pagination, 'Currencies retrieved successfully');
    } else {
      ApiResponse.success(res, { items, pagination }, 'Currencies retrieved successfully');
    }
  });

    // ------------------------------- get single currency ----------------------------
  getOne = catchAsync(async (req, res) => {
    const currency = await currencyService.getOne(req.params.id);
    ApiResponse.success(res, currency, 'Currency retrieved successfully');
  });

    // ------------------------------- get currency by code ----------------------------
  getByCode = catchAsync(async (req, res) => {
    const currency = await currencyService.getByCode(req.params.code);
    ApiResponse.success(res, currency, 'Currency retrieved successfully');
  });

    // ------------------------------- create currency ----------------------------
  create = catchAsync(async (req, res) => {
    const currency = await currencyService.create(req.body);
    ApiResponse.created(res, null, 'Currency created successfully');
  });

    // ------------------------------- update currency ----------------------------
  update = catchAsync(async (req, res) => {
    const currency = await currencyService.update(req.params.id, req.body);
    ApiResponse.success(res, null, 'Currency updated successfully');
  });

    // ------------------------------- delete currency ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await currencyService.delete(req.params.id);
    ApiResponse.success(res, null, result.message);
  });

  // ------------------------------- sync live rates ----------------------------
  syncLiveRates = catchAsync(async (req, res) => {
    const result = await currencyService.syncLiveRates();
    ApiResponse.success(res, null, result.message);
  });

  // ------------------------------- sync one rate ----------------------------
  syncOneRate = catchAsync(async (req, res) => {
    const currency = await currencyService.syncOneRate(req.params.id);
    ApiResponse.success(res, currency, `Live rate synced for ${currency.currencyInfo?.code}`);
  });
}

module.exports = new CurrencyController();
