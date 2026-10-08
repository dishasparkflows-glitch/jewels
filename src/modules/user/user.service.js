const User = require('./user.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class UserService {
  // ------------------------------- get all users ----------------------------
  async getAll(query) {
    const { page, limit, skip } = getPagination(query);
    const filter = { };

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
        .sort({ createdAt: -1 })
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

    // Handle flat updates for profile if passed
    const updateData = { ...data };
    if (data.firstName || data.lastName || data.phone || data.bio || data.location || data.avatar) {
      if (!updateData.profile) updateData.profile = {};
      if (data.firstName) updateData.profile.firstName = data.firstName;
      if (data.lastName) updateData.profile.lastName = data.lastName;
      if (data.phone) updateData.profile.phone = data.phone;
      if (data.bio !== undefined) updateData.profile.bio = data.bio;
      if (data.location !== undefined) updateData.profile.location = data.location;
      if (data.avatar !== undefined) updateData.profile.avatar = data.avatar;
    }

    // Handle flat address updates if passed
    if (data.billingAddress) {
      if (!updateData.addresses) updateData.addresses = {};
      updateData.addresses.billing = data.billingAddress;
    }
    if (data.shippingAddress) {
      if (!updateData.addresses) updateData.addresses = {};
      updateData.addresses.shipping = data.shippingAddress;
    }

    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
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
