const appointmentService = require('./appointment.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class AppointmentController {
  // ------------------------------- create appointment ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await appointmentService.create(req.body);
    await redisClient.deleteByPattern('appointments:*');
    ApiResponse.created(res, null, 'Appointment booked successfully');
  });

  // ------------------------------- get all appointments ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await appointmentService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Appointments retrieved successfully'
    );
  });

  // ------------------------------- get appointment lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `appointments:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => appointmentService.getLookup(req.query));
    ApiResponse.success(res, items, 'Appointment lookup list retrieved');
  });

  // ------------------------------- get one appointment ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await appointmentService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Appointment retrieved successfully');
  });

  // ------------------------------- update appointment ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await appointmentService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('appointments:*');
    ApiResponse.success(res, null, 'Appointment updated successfully');
  });

  // ------------------------------- update status ----------------------------
  updateStatus = catchAsync(async (req, res) => {
    const { status } = req.body;
    const item = await appointmentService.updateStatus(req.params.id, status);
    await redisClient.deleteByPattern('appointments:*');
    ApiResponse.success(res, null, `Appointment status updated to ${status}`);
  });


  // ------------------------------- delete appointment ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await appointmentService.delete(req.params.id);
    await redisClient.deleteByPattern('appointments:*');
    ApiResponse.success(res, null, result.message);
  });

  // ------------------------------- bulk delete appointments ----------------------------
  bulkDelete = catchAsync(async (req, res) => {
    const { ids } = req.body;
    const result = await appointmentService.bulkDelete(ids);
    await redisClient.deleteByPattern('appointments:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new AppointmentController();
