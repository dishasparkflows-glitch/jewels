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
      const reg = new RegExp(queryParams.search, 'i');
      filter.$or = [
        { 'customer.name': reg },
        { 'customer.email': reg },
        { 'customer.phone.number': reg },
      ];
    }

    const [items, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ 'appointment.date': -1, 'meta.createdAt': -1 })
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
      .sort({ 'appointment.date': -1 })
      .select('_id customer appointment status meta')
      .lean();
  }

  // ------------------------------- update appointment ----------------------------
  async update(id, data) {
    const item = await Appointment.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
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
      { _id: { $in: ids }, isDeleted: false },
      { $set: { isDeleted: true } }
    );

    return {
      message: `${result.modifiedCount} appointment(s) deleted successfully`,
      deletedCount: result.modifiedCount,
      ids,
    };
  }
}

module.exports = new AppointmentService();
