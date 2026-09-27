const jwt = require('jsonwebtoken');
const User = require('../user/user.model');
const ApiError = require('../../utils/ApiError');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/constants');

class AuthService {
  // ------------------------------- generate auth token ----------------------------
  generateToken(user) {
    return jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  // ------------------------------- register user ----------------------------
  async register(data) {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) throw new ApiError(409, 'Email already registered');

    const user = await User.create(data);
    const token = this.generateToken(user);

    const { password, ...userWithoutPassword } = user.toObject();
    return { user: userWithoutPassword, token };
  }

  // ------------------------------- login user ----------------------------
  async login(email, password) {
    const user = await User.findOne({ email }).select('+password');

    if (!user) throw new ApiError(401, 'Invalid email or password');
    if (!user.isActive) throw new ApiError(403, 'Account is deactivated. Contact admin.');

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) throw new ApiError(401, 'Invalid email or password');

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = this.generateToken(user);
    const { password: pwd, ...userWithoutPassword } = user.toObject();

    return { user: userWithoutPassword, token };
  }

  // ------------------------------- change password ----------------------------
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');
    if (!user) throw new ApiError(404, 'User not found');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new ApiError(400, 'Current password is incorrect');

    user.password = newPassword;
    await user.save();

    return { message: 'Password changed successfully' };
  }
}

module.exports = new AuthService();
