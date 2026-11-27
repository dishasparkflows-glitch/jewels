const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../user/user.model');
const Owner = require('../owner/owner.model');
const ApiError = require('../../utils/ApiError');
const { JWT, STORE_NAME, URL, ROLES } = require('../../config/constants');
const smsService = require('../sms/sms.service');
const otpService = require('../otp/otp.service');
const notificationService = require('../notification/notification.service');
const { sendEmail } = require('../../utils/emailService');
const { getPasswordResetHtml } = require('../../template');

class AuthService {
  // ------------------------------- notify admins on customer registration ----------------------------
  async notifyAdminsOnNewUser(user, source = 'email') {
    if (!user || (user.role && user.role !== 'user')) return;
    try {
      const fullName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim();
      const email = user.auth?.email || '';
      const rawPhone = user.profile?.phone ? `${user.profile?.countryCode || '+91'} ${user.profile.phone}`.trim() : '';
      const displayName = fullName || email || 'New Customer';
      const contactParts = [email, rawPhone].filter(Boolean).join(' · ');

      await notificationService.notifyAdmins({
        title: 'New User Registered',
        message: `${displayName} created a new account${contactParts ? ` (${contactParts})` : ''}.`,
        type: 'info',
        metadata: {
          event: 'user_registered',
          source,
          customerId: user._id,
          customerName: displayName,
          email,
          phone: rawPhone,
          link: '/customers',
        },
      });
    } catch (err) {
      console.warn('Admin new-user notification failed:', err.message);
    }
  }
  // ------------------------------- generate auth token ----------------------------
  generateToken(user) {
    const userEmail = user.auth?.email || '';
    return jwt.sign(
      {
        id: user._id,
        email: userEmail,
        role: user.role,
        ownerId: user.ownerId ? String(user.ownerId) : null,
      },
      JWT.SECRET,
      { expiresIn: JWT.EXPIRES_IN }
    );
  }

  async attachOwnerAccess(userObj) {
    if (!userObj?.ownerId) return userObj;
    const owner = await Owner.findOne({ _id: userObj.ownerId, 'meta.deletedAt': null })
      .select('_id name websiteUrl status allowedModules')
      .lean();
    if (owner) {
      userObj.ownerAccess = {
        restricted: true,
        inactive: owner.status !== 'active',
        ownerId: owner._id,
        ownerName: owner.name,
        allowedModules: owner.status === 'active' ? (owner.allowedModules || []) : [],
      };
      userObj.allowedModules = userObj.ownerAccess.allowedModules;
    }
    return userObj;
  }

  // ------------------------------- check email & phone availability ----------------------------
  async checkAvailability({ email, phone }) {
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      const existingEmailUser = await User.findOne({ 'auth.email': normalizedEmail, 'meta.deletedAt': null });
      if (existingEmailUser) {
        throw new ApiError(409, 'An account with this email already exists. Please log in.');
      }
    }

    if (phone) {
      const digits = String(phone).replace(/\D/g, '').trim();
      if (digits) {
        const existingPhoneUser = await User.findOne({
          $or: [{ 'profile.phone': digits }, { 'profile.phone': phone.trim() }],
          'meta.deletedAt': null,
        });
        if (existingPhoneUser) {
          throw new ApiError(409, 'An account with this mobile number already exists. Please log in.');
        }
      }
    }

    return { available: true };
  }

  // ------------------------------- register user ----------------------------
  async register(data = {}) {
    const email = (data.auth?.email || data.email || '').trim().toLowerCase();
    if (!email) throw new ApiError(400, 'Email is required');

    const existingUser = await User.findOne({ 'auth.email': email, 'meta.deletedAt': null });
    if (existingUser) throw new ApiError(409, 'Email already registered');

    const password = (data.auth?.password || data.password || '').trim();
    if (!password) {
      throw new ApiError(400, 'Password is required');
    }
    if (password.length < 6) {
      throw new ApiError(400, 'Password must be at least 6 characters');
    }

    const rawProfile = data.profile && typeof data.profile === 'object' ? data.profile : {};
    const firstName = String(rawProfile.firstName || data.firstName || '').trim();
    const lastName = String(rawProfile.lastName || data.lastName || 'Customer').trim();
    if (!firstName) {
      throw new ApiError(400, 'First name is required');
    }

    let rawPhone = String(rawProfile.phone || data.phone || '').trim();
    let countryCode = String(rawProfile.countryCode || data.countryCode || '').trim();

    if (rawPhone) {
      const plusMatch = rawPhone.match(/^(\+\d{1,4})[\s.-]?(\d+)$/);
      if (plusMatch) {
        if (!countryCode) countryCode = plusMatch[1];
        rawPhone = plusMatch[2];
      } else {
        rawPhone = rawPhone.replace(/^\+\d{1,4}\s*/, '').replace(/\s+/g, '');
      }
    }

    if (countryCode && !countryCode.startsWith('+')) {
      countryCode = `+${countryCode}`;
    }
    countryCode = countryCode || '+91';

    if (rawPhone) {
      const cleanPhone = rawPhone.replace(/\D/g, '').trim();
      if (cleanPhone) {
        const existingPhone = await User.findOne({
          $or: [{ 'profile.phone': cleanPhone }, { 'profile.phone': rawPhone }],
          'meta.deletedAt': null,
        });
        if (existingPhone) {
          throw new ApiError(409, 'Mobile number already registered. Please sign in instead.');
        }
      }
    }

    // Never trust client-supplied isPhoneVerified; require a valid one-time OTP verificationToken
    let isPhoneVerified = false;
    if (data.verificationToken && rawPhone) {
      isPhoneVerified = await otpService.isPhoneVerified(rawPhone, data.verificationToken, {
        consume: true,
        countryCode,
      });
    }

    // Construct an explicitly whitelisted user payload (prevents role / ownerId / status mass assignment)
    const userPayload = {
      profile: {
        firstName,
        lastName,
        phone: rawPhone,
        countryCode,
        isPhoneVerified,
        ...(typeof rawProfile.location === 'string' ? { location: rawProfile.location.trim() } : {}),
        ...(typeof rawProfile.bio === 'string' ? { bio: rawProfile.bio.trim() } : {}),
      },
      auth: {
        email,
        password,
      },
      role: ROLES.USER,
    };

    const user = await User.create(userPayload);
    await this.notifyAdminsOnNewUser(user, 'email');
    try {
      await smsService.sendSignupConfirmation(user);
    } catch (error) {
      console.error('Signup SMS could not be sent:', error.message);
    }
    const token = this.generateToken(user);

    const userObj = user.toObject();
    if (userObj.auth) delete userObj.auth.password;
    return { user: userObj, token };
  }

  // ------------------------------- login user ----------------------------
  async login(email, password, countryCode = null) {
    const identifier = (email || '').trim();
    const isEmail = identifier.includes('@');
    let user;

    if (isEmail) {
      const normalizedEmail = identifier.toLowerCase();
      user = await User.findOne({ 'auth.email': normalizedEmail, 'meta.deletedAt': null }).select('+auth.password');
    } else {
      const digits = identifier.replace(/\D/g, '');
      if (!digits) throw new ApiError(401, 'Invalid email/mobile number or password');

      const queries = [
        { 'profile.phone': identifier },
        { 'profile.phone': digits },
      ];

      // If countryCode was provided explicitly
      if (countryCode) {
        const formattedCode = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
        queries.unshift({
          'profile.phone': digits,
          'profile.countryCode': formattedCode,
        });
      }

      // If user typed with country code prefix (e.g. +91 9825032534, +919825032534, +1...)
      const plusMatch = identifier.match(/^\+(\d{1,4})[\s.-]?(\d+)$/);
      if (plusMatch) {
        const code = `+${plusMatch[1]}`;
        const phone = plusMatch[2];
        queries.push({
          'profile.phone': phone,
          'profile.countryCode': code,
        });
        queries.push({ 'profile.phone': phone });
      } else if (digits.length > 10) {
        // e.g. 919825032534 -> countryCode: +91, phone: 9825032534
        const phone = digits.slice(-10);
        const code = `+${digits.slice(0, digits.length - 10)}`;
        queries.push({
          'profile.phone': phone,
          'profile.countryCode': code,
        });
        queries.push({ 'profile.phone': phone });
      }

      user = await User.findOne({ $or: queries, 'meta.deletedAt': null }).select('+auth.password');
    }

    if (!user) throw new ApiError(401, 'Invalid email/mobile number or password');
    if (!user.isActive) throw new ApiError(403, 'Account is deactivated. Contact admin.');

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) throw new ApiError(401, 'Invalid email/mobile number or password');

    // Update last login
    const now = new Date();
    if (!user.auth) user.auth = {};
    user.auth.lastLogin = now;
    await user.save();

    const token = this.generateToken(user);
    const userObj = user.toObject();
    if (userObj.auth) delete userObj.auth.password;
    await this.attachOwnerAccess(userObj);

    return { user: userObj, token };
  }

  // ------------------------------- Google sign-in ----------------------------
  async googleLogin(credential) {
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
    let user = await User.findOne({ 'auth.email': email, 'meta.deletedAt': null });
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
        role: ROLES.USER,
      });
      await this.notifyAdminsOnNewUser(user, 'google');
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
    await this.attachOwnerAccess(userObj);
    return { user: userObj, token };
  }

  // ------------------------------- password reset ----------------------------
  async requestPasswordReset(email, options = {}) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const genericResponse = {
      message: 'If an account exists for that email, a password reset link has been sent.',
    };
    const user = await User.findOne({ 'auth.email': normalizedEmail });
    if (!user) {
      console.warn(`[PasswordReset] Request for non-existent email: "${normalizedEmail}"`);
      return genericResponse;
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.auth.passwordResetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.auth.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const origin = options.origin || '';
    const isAdminRequest =
      options.portal === 'admin' ||
      origin.includes(':5175') ||
      (options.portal !== 'storefront' && (user.role === 'admin' || user.role === 'super_admin'));

    const baseUrl = isAdminRequest
      ? (URL.ADMIN_URL)
      : (URL.FRONTEND_URL);

    const clientUrl = baseUrl.replace(/\/+$/, '');
    const resetUrl = new URL(`${clientUrl}/reset-password`);
    resetUrl.searchParams.set('token', token);

    try {
      const resetUrlStr = resetUrl.toString();
      const Setting = require('../setting/setting.model');
      const setting =
        (await Setting.findOne({ 'meta.deletedAt': null }).lean()) ||
        (await Setting.findOne().lean()) ||
        {};
      const storeName = setting?.businessDetails?.companyName || STORE_NAME;

      await sendEmail({
        to: normalizedEmail,
        subject: `Reset your password - ${storeName}`,
        text: `Use this link to reset your password: ${resetUrlStr}\nThis link expires in one hour.`,
        html: getPasswordResetHtml({
          resetUrl: resetUrlStr,
          setting,
          storeName,
          expiresIn: '1 hour',
        }),
      });
      console.log(`[PasswordReset] Reset email successfully sent to ${normalizedEmail}`);
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
    const user = await User.findById(userId).select('+auth.password');
    if (!user) throw new ApiError(404, 'User not found');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new ApiError(400, 'Current password is incorrect');

    if (!user.auth) user.auth = {};
    user.auth.password = newPassword;
    await user.save();

    return { message: 'Password changed successfully' };
  }
}

module.exports = new AuthService();
