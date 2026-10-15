const authService = require('./auth.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

// ------------------------------- register user ----------------------------
const register = catchAsync(async (req, res) => {
  const { user, token } = await authService.register(req.body);
  return ApiResponse.created(res, { user, token }, 'Registration successful');
});

// ------------------------------- login user ----------------------------
const login = catchAsync(async (req, res) => {
  const { email, identifier, password } = req.body;
  const { user, token } = await authService.login(identifier || email, password);
  return ApiResponse.success(res, { user, token }, 'Login successful');
});

// ------------------------------- Google sign-in ----------------------------
const googleLogin = catchAsync(async (req, res) => {
  const { credential } = req.body;
  const result = await authService.googleLogin(credential);
  return ApiResponse.success(res, result, 'Google sign-in successful');
});

// ------------------------------- password reset ----------------------------
const requestPasswordReset = catchAsync(async (req, res) => {
  const result = await authService.requestPasswordReset(req.body.email);
  return ApiResponse.success(res, result, result.message);
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.newPassword);
  return ApiResponse.success(res, null, 'Password reset successfully');
});

// ------------------------------- change password ----------------------------
const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user._id, currentPassword, newPassword);
  return ApiResponse.success(res, null, 'Password changed successfully');
});

// ------------------------------- get current auth user ----------------------------
const getMe = catchAsync(async (req, res) => {
  return ApiResponse.success(res, req.user, 'User fetched successfully');
});

module.exports = {
  register,
  login,
  googleLogin,
  requestPasswordReset,
  resetPassword,
  changePassword,
  getMe,
};
