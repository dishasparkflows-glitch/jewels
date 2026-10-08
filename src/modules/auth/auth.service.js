const jwt = require('jsonwebtoken');
const User = require('../user/user.model');
const ApiError = require('../../utils/ApiError');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/constants');

class AuthService {
  // ------------------------------- generate auth token ----------------------------
  generateToken(user) {
    const userEmail = user.auth?.email || user.email;
    return jwt.sign(
      { id: user._id, email: userEmail, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  // ------------------------------- register user ----------------------------
  async register(data) {
    const email = (data.email || data.auth?.email || '').trim().toLowerCase();
    const existingUser = await User.findOne({
      $or: [{ 'auth.email': email }, { email }],
    });
    if (existingUser) throw new ApiError(409, 'Email already registered');

    const user = await User.create({ ...data, email });
    const token = this.generateToken(user);

    const userObj = user.toObject();
    if (userObj.auth) delete userObj.auth.password;
    delete userObj.password;
    return { user: userObj, token };
  }

  // ------------------------------- login user ----------------------------
  async login(email, password) {
    const normalizedEmail = (email || '').trim().toLowerCase();

    const buildEmailFilter = (targetEmail) => ({
      $or: [{ 'auth.email': targetEmail }, { email: targetEmail }],
    });

    let user = await User.findOne(buildEmailFilter(normalizedEmail)).select('+auth.password +password');
    if (!user) {
      if (normalizedEmail.includes('krushnkant')) {
        user = await User.findOne(buildEmailFilter(normalizedEmail.replace('krushnkant', 'krushnikant'))).select('+auth.password +password');
      } else if (normalizedEmail.includes('krushnikant')) {
        user = await User.findOne(buildEmailFilter(normalizedEmail.replace('krushnikant', 'krushnkant'))).select('+auth.password +password');
      }
    }

    if (!user) throw new ApiError(401, 'Invalid email or password');
    if (!user.isActive) throw new ApiError(403, 'Account is deactivated. Contact admin.');

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) throw new ApiError(401, 'Invalid email or password');

    // Update last login
    const now = new Date();
    if (!user.auth) user.auth = {};
    user.auth.lastLogin = now;
    user.lastLogin = now;
    await user.save();

    const token = this.generateToken(user);
    const userObj = user.toObject();
    if (userObj.auth) delete userObj.auth.password;
    delete userObj.password;

    return { user: userObj, token };
  }

  // ------------------------------- change password ----------------------------
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+auth.password +password');
    if (!user) throw new ApiError(404, 'User not found');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new ApiError(400, 'Current password is incorrect');

    if (!user.auth) user.auth = {};
    user.auth.password = newPassword;
    user.password = newPassword;
    await user.save();

    return { message: 'Password changed successfully' };
  }
}

module.exports = new AuthService();
