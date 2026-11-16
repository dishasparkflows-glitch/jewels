const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const otpService = require('./otp.service');

const sendOtp = catchAsync(async (req, res) => {
  const { phone, purpose } = req.body;
  const result = await otpService.sendOtp(phone, purpose);
  return ApiResponse.success(res, result, result.message);
});

const verifyOtp = catchAsync(async (req, res) => {
  const { phone, otp, purpose } = req.body;
  const result = await otpService.verifyOtp(phone, otp, purpose);
  return ApiResponse.success(res, result, result.message);
});

module.exports = {
  sendOtp,
  verifyOtp,
};
