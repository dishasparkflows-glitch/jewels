const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const User = require('../user/user.model');
const ApiError = require('../../utils/ApiError');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/constants');
const smsService = require('../sms/sms.service');

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
    try {
      await smsService.sendSignupConfirmation(user);
    } catch (error) {
      console.error('Signup SMS could not be sent:', error.message);
    }
    const token = this.generateToken(user);

    const userObj = user.toObject();
    if (userObj.auth) delete userObj.auth.password;
    delete userObj.password;
    return { user: userObj, token };
  }

  // ------------------------------- login user ----------------------------
  async login(email, password) {
    const identifier = (email || '').trim();
    const isEmail = identifier.includes('@');
    let user;

    if (isEmail) {
      const normalizedEmail = identifier.toLowerCase();
      const buildEmailFilter = (targetEmail) => ({
        $or: [{ 'auth.email': targetEmail }, { email: targetEmail }],
      });
      user = await User.findOne(buildEmailFilter(normalizedEmail)).select('+auth.password +password');
      if (!user) {
        if (normalizedEmail.includes('krushnkant')) {
          user = await User.findOne(buildEmailFilter(normalizedEmail.replace('krushnkant', 'krushnikant'))).select('+auth.password +password');
        } else if (normalizedEmail.includes('krushnikant')) {
          user = await User.findOne(buildEmailFilter(normalizedEmail.replace('krushnikant', 'krushnkant'))).select('+auth.password +password');
        }
      }
    } else {
      const digits = identifier.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) throw new ApiError(401, 'Invalid mobile number or password');
      const localDigits = digits.length > 10 && digits.startsWith('91') ? digits.slice(2) : digits;
      const phonePattern = localDigits.split('').map((digit) => `${digit}\\D*`).join('');
      const phoneRegex = new RegExp(`(?:^|\\D)(?:91\\D*)?${phonePattern}$`);
      user = await User.findOne({
        $or: [{ 'profile.phone': phoneRegex }, { phone: phoneRegex }],
      }).select('+auth.password +password');
    }

    if (!user) throw new ApiError(401, 'Invalid email/mobile number or password');
    if (!user.isActive) throw new ApiError(403, 'Account is deactivated. Contact admin.');

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) throw new ApiError(401, 'Invalid email/mobile number or password');

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

  // ------------------------------- Google sign-in ----------------------------
  async googleLogin(credential) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new ApiError(503, 'Google sign-in is not configured');

    let payload;
    try {
      const ticket = await new OAuth2Client(clientId).verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new ApiError(401, 'Google sign-in could not be verified');
    }

    if (!payload?.email || payload.email_verified !== true) {
      throw new ApiError(401, 'A verified Google email is required');
    }

    const email = payload.email.trim().toLowerCase();
    let user = await User.findOne({ 'auth.email': email });
    if (user && user.role !== 'user') throw new ApiError(403, 'Google sign-in is for customer accounts only');
    if (user && !user.isActive) throw new ApiError(403, 'Account is deactivated. Contact admin.');

    if (!user) {
      const fullName = (payload.name || '').trim().split(/\s+/);
      user = await User.create({
        profile: {
          firstName: payload.given_name || fullName[0] || email.split('@')[0],
          lastName: payload.family_name || fullName.slice(1).join(' ') || 'Customer',
          avatar: payload.picture || null,
        },
        auth: {
          email,
          password: crypto.randomBytes(32).toString('hex'),
          lastLogin: new Date(),
        },
        role: 'user',
      });
    } else {
      user.auth.lastLogin = new Date();
      await user.save();
    }

    const token = this.generateToken(user);
    const userObj = user.toObject();
    if (userObj.auth) {
      delete userObj.auth.password;
      delete userObj.auth.passwordResetTokenHash;
      delete userObj.auth.passwordResetExpires;
    }
    delete userObj.password;
    return { user: userObj, token };
  }

  // ------------------------------- password reset ----------------------------
  async requestPasswordReset(email) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const genericResponse = {
      message: 'If an account exists for that email, a password reset link has been sent.',
    };
    const user = await User.findOne({ 'auth.email': normalizedEmail });
    if (!user) return genericResponse;

    const token = crypto.randomBytes(32).toString('hex');
    user.auth.passwordResetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.auth.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = new URL('/reset-password', process.env.FRONTEND_URL || 'http://localhost:5174');
    resetUrl.searchParams.set('token', token);
    const port = Number(process.env.SMTP_PORT || 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD },
    });

    try {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_EMAIL,
        to: normalizedEmail,
        subject: 'Reset your Neirah password',
        text: `Use this link to reset your password: ${resetUrl.toString()}
This link expires in one hour.`,
        html: `<p>We received a request to reset your Neirah account password.</p><p><a href="${resetUrl.toString()}">Reset your password</a></p><p>This link expires in one hour. If you did not request this, you can ignore this email.</p>`,
      });
    } catch (error) {
      user.auth.passwordResetTokenHash = undefined;
      user.auth.passwordResetExpires = undefined;
      await user.save();
      console.error('Password reset email could not be sent:', error.message);
    }

    return genericResponse;
  }

  async resetPassword(token, newPassword) {
    if (!token || typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new ApiError(400, 'A valid reset token and password of at least 6 characters are required');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      'auth.passwordResetTokenHash': tokenHash,
      'auth.passwordResetExpires': { $gt: new Date() },
    }).select('+auth.passwordResetTokenHash +auth.passwordResetExpires');

    if (!user) throw new ApiError(400, 'This password reset link is invalid or has expired');

    user.auth.password = newPassword;
    user.auth.passwordResetTokenHash = undefined;
    user.auth.passwordResetExpires = undefined;
    await user.save();
    return { message: 'Password reset successfully' };
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
