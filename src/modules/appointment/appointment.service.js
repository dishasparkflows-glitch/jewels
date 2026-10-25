const Appointment = require('./appointment.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class AppointmentService {
  // ------------------------------- create appointment ----------------------------
  async create(data) {
    const payload = { ...data };

    // Standardize customer if passed in alternative formats
    if (!payload.customer && (payload.fullName || payload.name || payload.email || payload.phoneNumber || payload.phone)) {
      payload.customer = {
        name: payload.fullName || payload.name || '',
        email: payload.email || '',
        phone: {
          countryCode: '91',
          number: String(payload.phoneNumber || payload.phone || '').replace(/^\+91\s*/, ''),
        },
      };
    }

    // Standardize appointment if passed in alternative formats
    if (!payload.appointment && (payload.appointmentDate || payload.date || payload.preferredTime || payload.serviceType)) {
      payload.appointment = {
        date: payload.appointmentDate || payload.date || null,
        preferredTime: payload.preferredTime || payload.time || '',
        serviceType: payload.serviceType || payload.service || 'Jewellery Viewing',
      };
    }

    // Discard any extra top-level fields
    delete payload.fullName;
    delete payload.phoneNumber;
    delete payload.appointmentDate;
    delete payload.preferredTime;
    delete payload.serviceType;

    return await Appointment.create(payload);
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
        { 'customer.name': reg },
        { 'customer.email': reg },
        { 'customer.phone.number': reg },
        { 'appointment.serviceType': reg },
        { customId: reg },
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
    const filter = { 'meta.deletedAt': null };
    if (queryParams.status && queryParams.status !== 'all') {
      filter.status = queryParams.status;
    }

    return await Appointment.find(filter)
      .sort({ 'appointment.date': -1, 'meta.createdAt': -1 })
      .lean();
  }

  // ------------------------------- update appointment ----------------------------
  async update(id, data) {
    const payload = { ...data };
    delete payload.fullName;
    delete payload.phoneNumber;
    delete payload.appointmentDate;
    delete payload.preferredTime;
    delete payload.serviceType;

    const item = await Appointment.findOneAndUpdate(
      { _id: id },
      { $set: payload },
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
