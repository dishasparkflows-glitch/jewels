const Address = require('./address.model');
const User = require('../user/user.model');
const ApiError = require('../../utils/ApiError');

class AddressService {
  /**
   * Sync User document addresses embedded fields from Address collection
   * to maintain full backward compatibility across the codebase.
   */
  async syncUserDoc(userId) {
    try {
      const addresses = await Address.find({
        user: userId,
        'meta.isDeleted': { $ne: true },
      }).sort({ isDefault: -1, isShippingDefault: -1, 'meta.createdAt': -1 });

      if (!addresses || addresses.length === 0) {
        await User.findByIdAndUpdate(userId, {
          'addresses.billing': {},
          'addresses.shipping': {},
          'addresses.saved': [],
        });
        return;
      }

      const shippingDefault =
        addresses.find((a) => a.isShippingDefault || a.isDefault) || addresses[0];
      const billingDefault =
        addresses.find((a) => a.isBillingDefault) || shippingDefault;

      const user = await User.findById(userId).select('profile');
      const userFullName = user
        ? `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim()
        : '';

      const toPlainAddress = (a) => ({
        _id: a._id,
        addressType: a.addressType || 'home',
        title: a.addressType === 'office' ? 'Office' : 'Home',
        fullName: userFullName,
        addressLine: a.addressLine || a.street || '',
        city: a.city || '',
        state: a.state || '',
        pincode: a.pincode || '',
        phone: a.phone || '',
      });

      await User.findByIdAndUpdate(userId, {
        'addresses.billing': toPlainAddress(billingDefault),
        'addresses.shipping': toPlainAddress(shippingDefault),
        'addresses.saved': addresses.map(toPlainAddress),
      });
    } catch (err) {
      console.warn(`[AddressService] Warning syncing user document: ${err.message}`);
    }
  }

  /**
   * Auto-migrate legacy embedded addresses in User doc to Address collection if none exist
   */
  async migrateFromUserDocIfNeeded(userId) {
    try {
      const count = await Address.countDocuments({
        user: userId,
        'meta.isDeleted': { $ne: true },
      });
      if (count > 0) return;

      const user = await User.findById(userId);
      if (!user || !user.addresses) return;

      const toCreate = [];

      // Check shipping
      if (user.addresses.shipping?.fullName && user.addresses.shipping?.addressLine) {
        toCreate.push({
          user: userId,
          title: 'Default Shipping',
          fullName: user.addresses.shipping.fullName,
          phone: user.addresses.shipping.phone || user.profile?.phone || '9999999999',
          addressLine: user.addresses.shipping.addressLine,
          city: user.addresses.shipping.city || 'Gandhinagar',
          state: user.addresses.shipping.state || 'Gujarat',
          pincode: user.addresses.shipping.pincode || '382006',
          addressType: 'shipping',
          isDefault: true,
          isShippingDefault: true,
          isBillingDefault: !user.addresses.billing?.fullName,
        });
      }

      // Check billing
      if (
        user.addresses.billing?.fullName &&
        user.addresses.billing?.addressLine &&
        user.addresses.billing.addressLine !== user.addresses.shipping?.addressLine
      ) {
        toCreate.push({
          user: userId,
          title: 'Default Billing',
          fullName: user.addresses.billing.fullName,
          phone: user.addresses.billing.phone || user.profile?.phone || '9999999999',
          addressLine: user.addresses.billing.addressLine,
          city: user.addresses.billing.city || 'Gandhinagar',
          state: user.addresses.billing.state || 'Gujarat',
          pincode: user.addresses.billing.pincode || '382006',
          addressType: 'billing',
          isDefault: toCreate.length === 0,
          isShippingDefault: false,
          isBillingDefault: true,
        });
      }

      // Check saved
      if (Array.isArray(user.addresses.saved)) {
        for (const s of user.addresses.saved) {
          if (s?.fullName && s?.addressLine) {
            toCreate.push({
              user: userId,
              title: s.title || `Address ${toCreate.length + 1}`,
              fullName: s.fullName,
              phone: s.phone || user.profile?.phone || '9999999999',
              addressLine: s.addressLine,
              city: s.city || 'Gandhinagar',
              state: s.state || 'Gujarat',
              pincode: s.pincode || '382006',
              addressType: 'other',
              isDefault: toCreate.length === 0,
              isShippingDefault: toCreate.length === 0,
              isBillingDefault: toCreate.length === 0,
            });
          }
        }
      }

      if (toCreate.length > 0) {
        await Address.insertMany(toCreate);
      }
    } catch (err) {
      console.warn(`[AddressService] Warning during auto-migration: ${err.message}`);
    }
  }

  /**
   * Get all addresses for a user
   */
  async getUserAddresses(userId) {
    await this.migrateFromUserDocIfNeeded(userId);

    const addresses = await Address.find({
      user: userId,
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
      query.user = userId;
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
      user: userId,
      'meta.isDeleted': { $ne: true },
    });

    const isFirst = existingCount === 0;
    const shouldBeDefault = isFirst || Boolean(data.isDefault || data.isShippingDefault);
    const shouldBeBillingDefault = isFirst || Boolean(data.isBillingDefault);

    // If making default, reset existing defaults
    if (shouldBeDefault) {
      await Address.updateMany(
        { user: userId, 'meta.isDeleted': { $ne: true } },
        { isDefault: false, isShippingDefault: false }
      );
    }

    if (shouldBeBillingDefault) {
      await Address.updateMany(
        { user: userId, 'meta.isDeleted': { $ne: true } },
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
      user: userId,
      isDefault: shouldBeDefault,
      isShippingDefault: shouldBeDefault,
      isBillingDefault: shouldBeBillingDefault,
    });

    await this.syncUserDoc(userId);
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
      query.user = userId;
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
        { user: address.user, _id: { $ne: addressId }, 'meta.isDeleted': { $ne: true } },
        { isDefault: false, isShippingDefault: false }
      );
      data.isDefault = true;
      data.isShippingDefault = true;
    }

    if (data.isBillingDefault) {
      await Address.updateMany(
        { user: address.user, _id: { $ne: addressId }, 'meta.isDeleted': { $ne: true } },
        { isBillingDefault: false }
      );
    }

    Object.assign(address, data);
    await address.save();

    await this.syncUserDoc(address.user);
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
      query.user = userId;
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
        user: address.user,
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

    await this.syncUserDoc(address.user);
    return { success: true, message: 'Address removed successfully' };
  }

  /**
   * Set address as default
   */
  async setDefault(userId, addressId, type = 'both') {
    const address = await Address.findOne({
      _id: addressId,
      user: userId,
      'meta.isDeleted': { $ne: true },
    });

    if (!address) {
      throw new ApiError(404, 'Address not found');
    }

    if (type === 'shipping' || type === 'both') {
      await Address.updateMany(
        { user: userId, 'meta.isDeleted': { $ne: true } },
        { isDefault: false, isShippingDefault: false }
      );
      address.isDefault = true;
      address.isShippingDefault = true;
    }

    if (type === 'billing' || type === 'both') {
      await Address.updateMany(
        { user: userId, 'meta.isDeleted': { $ne: true } },
        { isBillingDefault: false }
      );
      address.isBillingDefault = true;
    }

    await address.save();
    await this.syncUserDoc(userId);
    return address;
  }
}

module.exports = new AddressService();
