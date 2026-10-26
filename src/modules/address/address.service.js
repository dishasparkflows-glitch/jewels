const Address = require('./address.model');
const ApiError = require('../../utils/ApiError');

class AddressService {
  /**
   * Get all addresses for a user
   */
  async getUserAddresses(userId) {
    const addresses = await Address.find({
      userId,
      'meta.isDeleted': { $ne: true },
    }).sort({ isDefault: -1, isShippingDefault: -1, 'meta.createdAt': -1 });

    return addresses;
  }

  /**
   * Get a single address by ID
   */
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

  /**
   * Create a new address for user
   */
  async createAddress(userId, data) {
    const existingCount = await Address.countDocuments({
      userId,
      'meta.isDeleted': { $ne: true },
    });

    const isFirst = existingCount === 0;
    const shouldBeDefault = isFirst || Boolean(data.isDefault || data.isShippingDefault);
    const shouldBeBillingDefault = isFirst || Boolean(data.isBillingDefault);

    // If making default, reset existing defaults
    if (shouldBeDefault) {
      await Address.updateMany(
        { userId, 'meta.isDeleted': { $ne: true } },
        { isDefault: false, isShippingDefault: false }
      );
    }

    if (shouldBeBillingDefault) {
      await Address.updateMany(
        { userId, 'meta.isDeleted': { $ne: true } },
        { isBillingDefault: false }
      );
    }

    // Determine normalized addressType ('home' or 'office')
    let resolvedType = 'home';
    if (data.addressType) {
      resolvedType = data.addressType.toLowerCase().trim() === 'office' ? 'office' : 'home';
    } else if (data.title) {
      resolvedType = data.title.toLowerCase().includes('office') ? 'office' : 'home';
    }

    const { fullName, title, ...cleanData } = data; // Never store fullName on address table

    const address = await Address.create({
      ...cleanData,
      addressType: resolvedType,
      userId,
      isDefault: shouldBeDefault,
      isShippingDefault: shouldBeDefault,
      isBillingDefault: shouldBeBillingDefault,
    });

    return address;
  }

  /**
   * Update address
   */
  async updateAddress(userId, addressId, data, isAdmin = false) {
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

    // Determine normalized addressType ('home' or 'office')
    if (data.addressType) {
      data.addressType = data.addressType.toLowerCase().trim() === 'office' ? 'office' : 'home';
    } else if (data.title) {
      data.addressType = data.title.toLowerCase().includes('office') ? 'office' : 'home';
    }

    delete data.fullName; // Never store fullName on address table
    delete data.title;

    // Reset other defaults if this address is being set as default
    if (data.isDefault || data.isShippingDefault) {
      await Address.updateMany(
        { userId: address.userId, _id: { $ne: addressId }, 'meta.isDeleted': { $ne: true } },
        { isDefault: false, isShippingDefault: false }
      );
      data.isDefault = true;
      data.isShippingDefault = true;
    }

    if (data.isBillingDefault) {
      await Address.updateMany(
        { userId: address.userId, _id: { $ne: addressId }, 'meta.isDeleted': { $ne: true } },
        { isBillingDefault: false }
      );
    }

    Object.assign(address, data);
    await address.save();

    return address;
  }

  /**
   * Delete address (soft-delete)
   */
  async deleteAddress(userId, addressId, isAdmin = false) {
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

    address.meta = address.meta || {};
    address.meta.isDeleted = true;
    address.meta.deletedAt = new Date();
    await address.save();

    // If deleted address was default, promote another address to default
    if (address.isDefault || address.isShippingDefault || address.isBillingDefault) {
      const fallback = await Address.findOne({
        userId: address.userId,
        _id: { $ne: addressId },
        'meta.isDeleted': { $ne: true },
      }).sort({ 'meta.createdAt': -1 });

      if (fallback) {
        if (address.isDefault || address.isShippingDefault) {
          fallback.isDefault = true;
          fallback.isShippingDefault = true;
        }
        if (address.isBillingDefault) {
          fallback.isBillingDefault = true;
        }
        await fallback.save();
      }
    }

    return { success: true, message: 'Address removed successfully' };
  }

  /**
   * Set address as default
   */
  async setDefault(userId, addressId, type = 'both') {
    const address = await Address.findOne({
      _id: addressId,
      userId,
      'meta.isDeleted': { $ne: true },
    });

    if (!address) {
      throw new ApiError(404, 'Address not found');
    }

    if (type === 'shipping' || type === 'both') {
      await Address.updateMany(
        { userId, 'meta.isDeleted': { $ne: true } },
        { isDefault: false, isShippingDefault: false }
      );
      address.isDefault = true;
      address.isShippingDefault = true;
    }

    if (type === 'billing' || type === 'both') {
      await Address.updateMany(
        { userId, 'meta.isDeleted': { $ne: true } },
        { isBillingDefault: false }
      );
      address.isBillingDefault = true;
    }

    await address.save();
    return address;
  }
}

module.exports = new AddressService();
