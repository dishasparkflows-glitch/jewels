const User = require('./user.model');
const addressService = require('../address/address.service');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class UserService {
  // ------------------------------- get all users ----------------------------
  async getAll(query) {
    const { page, limit, skip } = getPagination(query);
    const filter = { 'meta.deletedAt': null };

    // Search by name or email
    if (query.search) {
      filter.$or = [
        { 'profile.firstName': { $regex: query.search, $options: 'i' } },
        { 'profile.lastName': { $regex: query.search, $options: 'i' } },
        { 'auth.email': { $regex: query.search, $options: 'i' } },
        { firstName: { $regex: query.search, $options: 'i' } },
        { lastName: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
      ];
    }

    // Filter by role
    if (query.role) {
      filter.role = query.role;
    }

    // Filter by status
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === 'true';
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-auth.password -password')
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return { users, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get one user ----------------------------
  async getById(id) {
    const user = await User.findById(id).select('-auth.password -password').lean();
    if (!user) throw new ApiError(404, 'User not found');

    // Attach addresses from dedicated Address collection
    try {
      const userAddresses = await addressService.getUserAddresses(id);
      user.addressesList = userAddresses;
      if (userAddresses && userAddresses.length > 0) {
        const shippingDefault =
          userAddresses.find((a) => a.isShippingDefault || a.isDefault) || userAddresses[0];
        const billingDefault =
          userAddresses.find((a) => a.isBillingDefault) || shippingDefault;

        if (!user.addresses) user.addresses = {};
        user.addresses.billing = billingDefault;
        user.addresses.shipping = shippingDefault;
        user.addresses.saved = userAddresses;
        user.billingAddress = billingDefault;
        user.shippingAddress = shippingDefault;
      }
    } catch (e) {
      // Gracefully continue if address lookup fails
    }

    return user;
  }

  // ------------------------------- create user ----------------------------
  async create(data) {
    const email = (data.email || data.auth?.email || '').trim().toLowerCase();
    const existingUser = await User.findOne({
      $or: [{ 'auth.email': email }, { email }],
    });
    if (existingUser) throw new ApiError(409, 'Email already registered');

    const user = await User.create(data);
    const userObj = user.toObject();
    if (userObj.auth) delete userObj.auth.password;
    delete userObj.password;
    return userObj;
  }

  // ------------------------------- update user ----------------------------
  async update(id, data) {
    // Don't allow password update through this method
    delete data.password;
    if (data.auth) delete data.auth.password;

    const user = await User.findByIdAndUpdate(id, data, {
      returnDocument: 'after',
      runValidators: true,
    }).select('-auth.password -password');

    if (!user) throw new ApiError(404, 'User not found');
    return user;
  }

  // ------------------------------- delete user ----------------------------
  async delete(id) {
    const user = await User.findByIdAndDelete(id);
    if (!user) throw new ApiError(404, 'User not found');
    return user;
  }

  // ------------------------------- toggle user status ----------------------------
  async toggleStatus(id) {
    const user = await User.findById(id);
    if (!user) throw new ApiError(404, 'User not found');

    user.isActive = !user.isActive;
    await user.save();

    return user;
  }
}

module.exports = new UserService();
