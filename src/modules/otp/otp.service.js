const crypto = require('crypto');
const smsService = require('../sms/sms.service');
const ApiError = require('../../utils/ApiError');
const { NODE_ENV } = require('../../config/constants');

// In-memory stores (no Redis)
const otpStore = new Map();
const verifiedStore = new Map();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const VERIFIED_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// ------------------------------- normalize phone ----------------------------
const normalizePhone = (rawPhone) => {
  return String(rawPhone || '').replace(/\D/g, '').trim();
};

// ------------------------------- normalize country code ----------------------------
const normalizeCountryCode = (code) => {
  if (!code) return '+91';
  const cleaned = String(code).trim();
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
};

class OtpService {
  // ------------------------------- send otp ----------------------------
  /**
   * Generates and sends a 4-digit OTP to the recipient's phone number
   */
  async sendOtp(rawPhone, purpose = 'order_verification', rawCountryCode = '+91') {
    const phone = normalizePhone(rawPhone);
    const countryCode = normalizeCountryCode(rawCountryCode);
    if (!phone) {
      throw new ApiError(400, 'Mobile number is required to send OTP');
    }

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const primaryKey = `${purpose}:${countryCode}:${phone}`;
    const fallbackKey = `${purpose}:${phone}`;

    // Store in memory with expiration
    const record = {
      otp,
      countryCode,
      phone,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
    };
    otpStore.set(primaryKey, record);
    otpStore.set(fallbackKey, record);

    // Format destination number: for international, include country code digits
    const cleanDigits = countryCode.replace(/\D/g, '');
    const fullMobile = cleanDigits && cleanDigits !== '91'
      ? `${cleanDigits}${phone}`
      : phone;

    // Send SMS via provider
    const smsResult = await smsService.sendOtp({ to: fullMobile, otp, countryCode });

    const isDev = NODE_ENV !== 'production';
    const maskedPhone =
      phone.length > 4
        ? `${phone.slice(0, 2)}****${phone.slice(-2)}`
        : phone;

    return {
      success: true,
      message: `OTP sent successfully to ${countryCode} ${maskedPhone}`,
      phone,
      countryCode,
      expiresIn: Math.floor(OTP_EXPIRY_MS / 1000),
      ...(isDev ? { devOtp: otp } : {}),
      smsResult,
    };
  }

  // ------------------------------- verify otp ----------------------------
  /**
   * Verifies the 4-digit OTP for the given phone number
   */
  async verifyOtp(rawPhone, inputOtp, purpose = 'order_verification', rawCountryCode = '+91') {
    const phone = normalizePhone(rawPhone);
    const countryCode = normalizeCountryCode(rawCountryCode);
    const otp = String(inputOtp || '').trim();

    if (!phone) {
      throw new ApiError(400, 'Mobile number is required');
    }

    if (!otp || otp.length !== 4) {
      throw new ApiError(400, 'Please enter a valid 4-digit OTP');
    }

    const primaryKey = `${purpose}:${countryCode}:${phone}`;
    const fallbackKey = `${purpose}:${phone}`;
    const record = otpStore.get(primaryKey) || otpStore.get(fallbackKey);

    if (!record || Date.now() > record.expiresAt) {
      otpStore.delete(primaryKey);
      otpStore.delete(fallbackKey);
      throw new ApiError(400, 'OTP expired or not found. Please click Resend OTP.');
    }

    if (String(record.otp).trim() !== otp) {
      throw new ApiError(400, 'Invalid OTP. Please check and try again.');
    }

    // Clear OTP after successful use
    otpStore.delete(primaryKey);
    otpStore.delete(fallbackKey);

    // Generate short-lived verification token
    const verificationToken = crypto.randomBytes(16).toString('hex');
    verifiedStore.set(verificationToken, {
      phone,
      countryCode,
      expiresAt: Date.now() + VERIFIED_TOKEN_EXPIRY_MS,
    });

    return {
      success: true,
      verified: true,
      verificationToken,
      phone,
      countryCode,
      message: 'Mobile number verified successfully',
    };
  }

  // ------------------------------- check if phone is verified ----------------------------
  /**
   * Helper to check if a verification token is valid for a given phone number
   */
  async isPhoneVerified(rawPhone, verificationToken) {
    if (!verificationToken) return false;
    const phone = normalizePhone(rawPhone);

    const record = verifiedStore.get(verificationToken);
    if (!record) return false;

    if (Date.now() > record.expiresAt) {
      verifiedStore.delete(verificationToken);
      return false;
    }

    return record.phone === phone;
  }
}

module.exports = new OtpService();
