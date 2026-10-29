const orderService = require('./order.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class OrderController {
  // ------------------------------- Create Order ----------------------------
  createOrder = catchAsync(async (req, res) => {
    const result = await orderService.createOrder(req.body, req.user);
    ApiResponse.created(res, result, 'Order created successfully');
  });

  // ------------------------------- Get User Orders ----------------------------
  getMyOrders = catchAsync(async (req, res) => {
    const result = await orderService.getMyOrders(req.user._id, req.query);
    ApiResponse.success(res, result, 'Orders retrieved successfully');
  });

  // ------------------------------- Get Order By ID ----------------------------
  getOrderById = catchAsync(async (req, res) => {
    const order = await orderService.getOrderById(req.params.id, req.user);
    ApiResponse.success(res, order, 'Order retrieved successfully');
  });

  // ------------------------------- Get Order By Order Number ----------------------------
  getOrderByNumber = catchAsync(async (req, res) => {
    const order = await orderService.getOrderByNumber(req.params.orderNumber, req.user);
    ApiResponse.success(res, order, 'Order retrieved successfully');
  });

  // ------------------------------- Cancel Order ----------------------------
  cancelOrder = catchAsync(async (req, res) => {
    const order = await orderService.cancelOrder(req.params.id, req.user, req.body?.reason);
    ApiResponse.success(res, order, 'Order cancelled successfully');
  });

  // ------------------------------- Admin: Get All Orders ----------------------------
  getAllOrders = catchAsync(async (req, res) => {
    const result = await orderService.getAllOrders(req.query);
    ApiResponse.success(res, result, 'Orders retrieved successfully');
  });

  // ------------------------------- Admin: Update Order Status ----------------------------
  updateOrderStatus = catchAsync(async (req, res) => {
    const order = await orderService.updateOrderStatus(req.params.id, req.body);
    ApiResponse.success(res, order, 'Order status updated successfully');
  });
}

module.exports = new OrderController();

