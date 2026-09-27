const Appointment = require('./appointment.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class AppointmentService {
  // ------------------------------- create appointment ----------------------------
  async create(data) {
    return await Appointment.create(data);
  }

  // ------------------------------- get one appointment ----------------------------
  async getOne(id) {
    const item = await Appointment.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Appointment not found');
    }
    return item;
  }

  // ------------------------------- get all appointments ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      filter.$or = [
        { fullName: new RegExp(queryParams.search, 'i') },
        { email: new RegExp(queryParams.search, 'i') },
        { phoneNumber: new RegExp(queryParams.search, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ appointmentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Appointment.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get appointment lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false };
    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    return await Appointment.find(filter)
      .sort({ appointmentDate: -1 })
      .select('_id fullName email phoneNumber appointmentDate preferredTime status')
      .lean();
  }

  // ------------------------------- update appointment ----------------------------
  async update(id, data) {
    const item = await Appointment.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Appointment not found');
    }

    return item;
  }

  // ------------------------------- delete appointment ----------------------------
  async delete(id) {
    const item = await Appointment.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Appointment not found');
    }

    return { message: 'Appointment deleted successfully', id };
  }
}

module.exports = new AppointmentService();
