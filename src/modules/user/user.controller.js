const userService = require('./user.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

// ------------------------------- get all users ----------------------------
const getAll = catchAsync(async (req, res) => {
  const { users, pagination } = await userService.getAll(req.query);
  return ApiResponse.paginated(res, users, pagination, 'Users fetched successfully');
});

// ------------------------------- get one user ----------------------------
const getById = catchAsync(async (req, res) => {
  const user = await userService.getById(req.params.id);
  return ApiResponse.success(res, user, 'User fetched successfully');
});

// ------------------------------- create user ----------------------------
const create = catchAsync(async (req, res) => {
  const user = await userService.create({ ...req.body, createdBy: req.user._id });
  return ApiResponse.created(res, user, 'User created successfully');
});

// ------------------------------- update user ----------------------------
const update = catchAsync(async (req, res) => {
  const user = await userService.update(req.params.id, req.body);
  return ApiResponse.success(res, user, 'User updated successfully');
});

// ------------------------------- delete user ----------------------------
const remove = catchAsync(async (req, res) => {
  await userService.delete(req.params.id);
  return ApiResponse.success(res, null, 'User deleted successfully');
});

// ------------------------------- toggle user status ----------------------------
const toggleStatus = catchAsync(async (req, res) => {
  const user = await userService.toggleStatus(req.params.id);
  return ApiResponse.success(res, user, `User ${user.isActive ? 'activated' : 'deactivated'} successfully`);
});

// ------------------------------- get current user ----------------------------
const getMe = catchAsync(async (req, res) => {
  const user = await userService.getById(req.user._id);
  return ApiResponse.success(res, user, 'Profile fetched successfully');
});

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  toggleStatus,
  getMe,
};
