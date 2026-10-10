const appointmentService = require('./appointment.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class AppointmentController {
  // ------------------------------- create appointment ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await appointmentService.create(req.body);
    ApiResponse.created(res, item, 'Appointment booked successfully');
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
    const items = await appointmentService.getLookup(req.query);
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
    ApiResponse.success(res, item, 'Appointment updated successfully');
  });

  // ------------------------------- delete appointment ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await appointmentService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });

  // ------------------------------- bulk delete appointments ----------------------------
  bulkDelete = catchAsync(async (req, res) => {
    const { ids } = req.body;
    const result = await appointmentService.bulkDelete(ids);
    ApiResponse.success(res, result, result.message);
  });
}

module.exports = new AppointmentController();
