const Address = require('./address.model');
const ApiError = require('../../utils/ApiError');

class AddressService {
    // ------------------------------- get user addresses ----------------------------
  async getUserAddresses(userId) {
    const addresses = await Address.find({
      userId,
      'meta.isDeleted': { $ne: true },
    }).sort({ 'defaults.isDefault': -1, 'defaults.isShippingDefault': -1, 'meta.createdAt': -1 });

    return addresses;
  }

    // ------------------------------- get address by id ----------------------------
  async getAddressById(userId, addressId, isAdmin = false) {
    const query = {
      _id: addressId,
      'meta.isDeleted': { $ne: true },
    };
    if (!isAdmin) {
      query.userId = userId;
    }

    const address = await Address.findOne(query);
    if (!address) {
      throw new ApiError(404, 'Address not found');
    }
    return address;
  }

    // ------------------------------- create address ----------------------------
  async createAddress(userId, data) {
    const existingCount = await Address.countDocuments({
      userId,
      'meta.isDeleted': { $ne: true },
    });

    const isFirst = existingCount === 0;
    const isDefault = isFirst || Boolean(data.defaults?.isDefault);
    const isShippingDefault = isFirst || Boolean(data.defaults?.isShippingDefault || data.defaults?.isDefault);
    const isBillingDefault = isFirst || Boolean(data.defaults?.isBillingDefault);

    // If making default, reset existing defaults
    if (isDefault || isShippingDefault) {
      await Address.updateMany(
        { userId, 'meta.isDeleted': { $ne: true } },
        { 'defaults.isDefault': false, 'defaults.isShippingDefault': false }
      );
    }

    if (isBillingDefault) {
      await Address.updateMany(
        { userId, 'meta.isDeleted': { $ne: true } },
        { 'defaults.isBillingDefault': false }
      );
    }

    const address = await Address.create({
      userId,
      address: data.address,
      defaults: {
        isDefault,
        isShippingDefault,
        isBillingDefault,
      },
    });

    return address;
  }

    // ------------------------------- update address ----------------------------
  async updateAddress(userId, addressId, data, isAdmin = false) {
    const query = {
      _id: addressId,
      'meta.isDeleted': { $ne: true },
    };
    if (!isAdmin) {
      query.userId = userId;
    }

    const addressDoc = await Address.findOne(query);
    if (!addressDoc) {
      throw new ApiError(404, 'Address not found');
    }

    if (data.defaults?.isDefault || data.defaults?.isShippingDefault) {
      await Address.updateMany(
        { userId: addressDoc.userId, _id: { $ne: addressId }, 'meta.isDeleted': { $ne: true } },
        { 'defaults.isDefault': false, 'defaults.isShippingDefault': false }
      );
    }

    if (data.defaults?.isBillingDefault) {
      await Address.updateMany(
        { userId: addressDoc.userId, _id: { $ne: addressId }, 'meta.isDeleted': { $ne: true } },
        { 'defaults.isBillingDefault': false }
      );
    }

    if (data.address) {
      addressDoc.address = { ...(addressDoc.address?.toObject?.() || addressDoc.address), ...data.address };
    }
    if (data.defaults) {
      addressDoc.defaults = { ...(addressDoc.defaults?.toObject?.() || addressDoc.defaults), ...data.defaults };
    }

    await addressDoc.save();
    return addressDoc;
  }

    // ------------------------------- delete address ----------------------------
  async deleteAddress(userId, addressId, isAdmin = false) {
    const query = {
      _id: addressId,
      'meta.isDeleted': { $ne: true },
    };
    if (!isAdmin) {
      query.userId = userId;
    }

    const addressDoc = await Address.findOne(query);
    if (!addressDoc) {
      throw new ApiError(404, 'Address not found');
    }

    addressDoc.meta = addressDoc.meta || {};
    addressDoc.meta.isDeleted = true;
    addressDoc.meta.deletedAt = new Date();
    await addressDoc.save();

    // If deleted address was default, promote another address to default
    const wasDefault = addressDoc.defaults?.isDefault || addressDoc.defaults?.isShippingDefault;
    const wasBillingDefault = addressDoc.defaults?.isBillingDefault;

    if (wasDefault || wasBillingDefault) {
      const fallback = await Address.findOne({
        userId: addressDoc.userId,
        _id: { $ne: addressId },
        'meta.isDeleted': { $ne: true },
      }).sort({ 'meta.createdAt': -1 });

      if (fallback) {
        fallback.defaults = fallback.defaults || {};
        if (wasDefault) {
          fallback.defaults.isDefault = true;
          fallback.defaults.isShippingDefault = true;
        }
        if (wasBillingDefault) {
          fallback.defaults.isBillingDefault = true;
        }
        await fallback.save();
      }
    }

    return { success: true, message: 'Address removed successfully' };
  }

    // ------------------------------- set default address ----------------------------
  async setDefault(userId, addressId, type = 'both') {
    const addressDoc = await Address.findOne({
      _id: addressId,
      userId,
      'meta.isDeleted': { $ne: true },
    });

    if (!addressDoc) {
      throw new ApiError(404, 'Address not found');
    }

    addressDoc.defaults = addressDoc.defaults || {};

    if (type === 'shipping' || type === 'both') {
      await Address.updateMany(
        { userId, 'meta.isDeleted': { $ne: true } },
        { 'defaults.isDefault': false, 'defaults.isShippingDefault': false }
      );
      addressDoc.defaults.isDefault = true;
      addressDoc.defaults.isShippingDefault = true;
    }

    if (type === 'billing' || type === 'both') {
      await Address.updateMany(
        { userId, 'meta.isDeleted': { $ne: true } },
        { 'defaults.isBillingDefault': false }
      );
      addressDoc.defaults.isBillingDefault = true;
    }

    await addressDoc.save();
    return addressDoc;
  }
}

module.exports = new AddressService();
