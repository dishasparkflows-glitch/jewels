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
    const item = await Appointment.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Appointment not found');
    }
    return item;
  }

  // ------------------------------- get all appointments ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status && queryParams.status !== 'all') {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      const reg = new RegExp(queryParams.search, 'i');
      filter.$or = [
        { fullName: reg },
        { email: reg },
        { phoneNumber: reg },
        { 'customer.name': reg },
        { 'customer.email': reg },
        { 'customer.phone.number': reg },
      ];
    }

    const [items, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ appointmentDate: -1, 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Appointment.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get appointment lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null };
    if (queryParams.status && queryParams.status !== 'all') {
      filter.status = queryParams.status;
    }

    return await Appointment.find(filter)
      .sort({ appointmentDate: -1, 'appointment.date': -1 })
      .lean();
  }

  // ------------------------------- update appointment ----------------------------
  async update(id, data) {
    const item = await Appointment.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: false }
    );

    if (!item) {
      throw new ApiError(404, 'Appointment not found');
    }

    return item;
  }

  // ------------------------------- update status ----------------------------
  async updateStatus(id, status) {
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const item = await Appointment.findOneAndUpdate(
      { _id: id },
      { $set: { status } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Appointment not found');
    }

    return item;
  }

  // ------------------------------- delete appointment ----------------------------
  async delete(id) {
    const item = await Appointment.findOneAndUpdate(
      { _id: id },
      { $set: { 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Appointment not found');
    }

    return { message: 'Appointment deleted successfully', id };
  }

  // ------------------------------- bulk delete appointments ----------------------------
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Please provide an array of appointment IDs to delete');
    }

    const result = await Appointment.updateMany(
      { _id: { $in: ids } },
      { $set: { 'meta.deletedAt': new Date() } }
    );

    return {
      message: `${result.modifiedCount} appointment(s) deleted successfully`,
      deletedCount: result.modifiedCount,
      ids,
    };
  }
}

module.exports = new AppointmentService();
