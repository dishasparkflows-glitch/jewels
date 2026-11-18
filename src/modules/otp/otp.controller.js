const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const otpService = require('./otp.service');

const sendOtp = catchAsync(async (req, res) => {
  const { phone, purpose, countryCode } = req.body;
  const result = await otpService.sendOtp(phone, purpose, countryCode);
  return ApiResponse.success(res, result, result.message);
});

const verifyOtp = catchAsync(async (req, res) => {
  const { phone, otp, purpose, countryCode } = req.body;
  const result = await otpService.verifyOtp(phone, otp, purpose, countryCode);
  return ApiResponse.success(res, result, result.message);
});

module.exports = {
  sendOtp,
  verifyOtp,
};
