const User = require('./user.model');
const addressService = require('../address/address.service');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class UserService {
  formatUser(user) {
    if (!user) return null;
    const doc = user.toObject ? user.toObject({ virtuals: true }) : { ...user };
    return {
      ...doc,
      firstName: doc.profile?.firstName || '',
      lastName: doc.profile?.lastName || '',
      fullName: `${doc.profile?.firstName || ''} ${doc.profile?.lastName || ''}`.trim(),
      email: doc.auth?.email || '',
      phone: doc.profile?.phone || '',
      location: doc.profile?.location || '',
      bio: doc.profile?.bio || '',
      avatar: doc.profile?.avatar || null,
      themeColor: doc.profile?.themeColor || 'default',
    };
  }

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

    const [rawUsers, total] = await Promise.all([
      User.find(filter)
        .select('-auth.password -password')
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    const users = rawUsers.map((u) => this.formatUser(u));
    return { users, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get one user ----------------------------
  async getById(id) {
    const user = await User.findById(id).select('-auth.password -password');
    if (!user) throw new ApiError(404, 'User not found');

    const formattedUser = this.formatUser(user);

    // Attach addresses from dedicated Address collection if needed
    try {
      const userAddresses = await addressService.getUserAddresses(id);
      formattedUser.addressesList = userAddresses || [];
    } catch (e) {
      // Gracefully continue if address lookup fails
    }

    return formattedUser;
  }

  // ------------------------------- create user ----------------------------
  async create(data) {
    const email = (data.auth?.email || '').trim().toLowerCase();
    const existingUser = await User.findOne({ 'auth.email': email });
    if (existingUser) throw new ApiError(409, 'Email already registered');

    const user = await User.create(data);
    const userObj = user.toObject();
    if (userObj.auth) delete userObj.auth.password;
    return this.formatUser(userObj);
  }

  // ------------------------------- update user ----------------------------
  async update(id, data) {
    // Don't allow password update through this method
    delete data.password;
    if (data.auth) delete data.auth.password;

    const updateFields = {};

    // Map top-level profile fields into profile.<key> so MongoDB saves them into document
    const profileKeys = ['firstName', 'lastName', 'phone', 'location', 'bio', 'avatar', 'themeColor'];
    for (const key of profileKeys) {
      if (data[key] !== undefined) {
        updateFields[`profile.${key}`] = data[key];
      }
    }

    // If nested profile object was passed
    if (data.profile && typeof data.profile === 'object') {
      for (const [k, v] of Object.entries(data.profile)) {
        updateFields[`profile.${k}`] = v;
      }
    }

    // Map auth fields into auth.<key>
    if (data.email !== undefined) {
      updateFields['auth.email'] = (data.email || '').trim().toLowerCase();
    }
    if (data.auth && typeof data.auth === 'object') {
      for (const [k, v] of Object.entries(data.auth)) {
        if (k !== 'password') {
          updateFields[`auth.${k}`] = v;
        }
      }
    }

    // Pass through any other root-level schema fields (e.g. role, isActive, etc.)
    for (const [key, value] of Object.entries(data)) {
      if (!profileKeys.includes(key) && key !== 'profile' && key !== 'auth' && key !== 'email') {
        updateFields[key] = value;
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateFields },
      {
        returnDocument: 'after',
        runValidators: true,
      }
    ).select('-auth.password');

    if (!user) throw new ApiError(404, 'User not found');
    return this.formatUser(user);
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
