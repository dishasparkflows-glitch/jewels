const User = require('./user.model');
const addressService = require('../address/address.service');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class UserService {
  formatUser(user) {
    if (!user) return null;
    const doc = user.toObject ? user.toObject() : { ...user };
    if (doc.auth?.password) {
      delete doc.auth.password;
    }
    delete doc.password;
    return doc;
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
      console.error('Error fetching user addresses:', e);
    }

    return formattedUser;
  }

  // ------------------------------- create user ----------------------------
  async create(data) {
    if (data.auth?.email) {
      data.auth.email = data.auth.email.trim().toLowerCase();
      const existingUser = await User.findOne({ 'auth.email': data.auth.email });
      if (existingUser) throw new ApiError(409, 'Email already registered');
    }

    if (data.profile) {
      if (data.profile.phone) {
        const phoneStr = String(data.profile.phone).trim();
        const match = phoneStr.match(/^(\+\d{1,4})[\s.-]?(\d+)$/);
        if (match) {
          if (!data.profile.countryCode) {
            data.profile.countryCode = match[1];
          }
          data.profile.phone = match[2];
        } else {
          data.profile.phone = phoneStr.replace(/^\+\d{1,4}\s*/, '').replace(/\s+/g, '');
        }
      }
      if (data.profile.countryCode) {
        const codeStr = String(data.profile.countryCode).trim();
        data.profile.countryCode = codeStr.startsWith('+') ? codeStr : `+${codeStr}`;
      }
    }

    const user = await User.create(data);
    return this.formatUser(user);
  }

  toDotNotation(obj, prefix = '') {
    return Object.keys(obj).reduce((acc, key) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (
        obj[key] !== null &&
        typeof obj[key] === 'object' &&
        !Array.isArray(obj[key]) &&
        !(obj[key] instanceof Date)
      ) {
        Object.assign(acc, this.toDotNotation(obj[key], path));
      } else if (obj[key] !== undefined) {
        acc[path] = obj[key];
      }
      return acc;
    }, {});
  }

  // ------------------------------- update user ----------------------------
  async update(id, data) {
    // Prevent updating password through generic update method
    delete data.password;
    if (data.auth) delete data.auth.password;

    if (data.profile) {
      if (data.profile.phone) {
        const phoneStr = String(data.profile.phone).trim();
        const match = phoneStr.match(/^(\+\d{1,4})[\s.-]?(\d+)$/);
        if (match) {
          if (!data.profile.countryCode) {
            data.profile.countryCode = match[1];
          }
          data.profile.phone = match[2];
        } else {
          data.profile.phone = phoneStr.replace(/^\+\d{1,4}\s*/, '').replace(/\s+/g, '');
        }
      }
      if (data.profile.countryCode) {
        const codeStr = String(data.profile.countryCode).trim();
        data.profile.countryCode = codeStr.startsWith('+') ? codeStr : `+${codeStr}`;
      }
    }

    // Validate email uniqueness if email is being updated
    if (data.auth?.email) {
      data.auth.email = data.auth.email.trim().toLowerCase();
      const duplicate = await User.findOne({
        _id: { $ne: id },
        'auth.email': data.auth.email,
      });
      if (duplicate) throw new ApiError(409, 'Email is already in use');
    }

    // Flatten nested objects into dot-notation for atomic MongoDB $set
    const updateFields = this.toDotNotation(data);

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true }
    ).select('-auth.password');

    if (!user) throw new ApiError(404, 'User not found');
    return this.formatUser(user);
  }

  // ------------------------------- bulk delete users ----------------------------
  async bulkDelete(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'ids array is required for bulk delete');
    }
    const result = await User.updateMany(
      { _id: { $in: ids } },
      { $set: { isActive: false, 'meta.deletedAt': new Date() } }
    );
    return {
      message: `${result.modifiedCount || 0} user(s) deleted successfully`,
      deletedCount: result.modifiedCount || 0,
      ids,
    };
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
