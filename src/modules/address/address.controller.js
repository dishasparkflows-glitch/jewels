const addressService = require('./address.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

// ------------------------------- get all my addresses ----------------------------
const getMyAddresses = catchAsync(async (req, res) => {
  const addresses = await addressService.getUserAddresses(req.user._id);
  return ApiResponse.success(res, addresses, 'Addresses fetched successfully');
});

// ------------------------------- get single address ----------------------------
const getAddressById = catchAsync(async (req, res) => {
  const address = await addressService.getAddressById(req.user._id, req.params.id);
  return ApiResponse.success(res, address, 'Address fetched successfully');
});

// ------------------------------- create address ----------------------------
const createAddress = catchAsync(async (req, res) => {
  const address = await addressService.createAddress(req.user._id, req.body);
  return ApiResponse.created(res, address, 'Address created successfully');
});

// ------------------------------- update address ----------------------------
const updateAddress = catchAsync(async (req, res) => {
  const address = await addressService.updateAddress(req.user._id, req.params.id, req.body);
  return ApiResponse.success(res, address, 'Address updated successfully');
});

// ------------------------------- delete address ----------------------------
const deleteAddress = catchAsync(async (req, res) => {
  const result = await addressService.deleteAddress(req.user._id, req.params.id);
  return ApiResponse.success(res, result, 'Address deleted successfully');
});

// ------------------------------- set default address ----------------------------
const setDefaultAddress = catchAsync(async (req, res) => {
  const { type = 'both' } = req.body;
  const address = await addressService.setDefault(req.user._id, req.params.id, type);
  return ApiResponse.success(res, address, 'Default address updated successfully');
});

// ------------------------------- admin: get user addresses ----------------------------
const getUserAddressesAdmin = catchAsync(async (req, res) => {
  const addresses = await addressService.getUserAddresses(req.params.userId);
  return ApiResponse.success(res, addresses, 'User addresses fetched successfully');
});

module.exports = {
  getMyAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getUserAddressesAdmin,
};
