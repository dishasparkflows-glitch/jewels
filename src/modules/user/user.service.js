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
        .select('-password')
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
    const user = await User.findById(id).select('-password').lean();
    if (!user) throw new ApiError(404, 'User not found');
    return user;
  }

  // ------------------------------- create user ----------------------------
  async create(data) {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) throw new ApiError(409, 'Email already registered');

    const user = await User.create(data);
    const { password, ...userWithoutPassword } = user.toObject();
    return userWithoutPassword;
  }

  // ------------------------------- update user ----------------------------
  async update(id, data) {
    // Don't allow password update through this method
    delete data.password;

    const user = await User.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).select('-password');

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
