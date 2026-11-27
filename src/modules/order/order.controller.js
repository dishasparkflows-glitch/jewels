const orderService = require('./order.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');

const getOrderAccessToken = (req) =>
  req.headers['x-order-token'] || req.query?.token || req.body?.orderToken || null;

class OrderController {
  // ------------------------------- Create Order ----------------------------
  createOrder = catchAsync(async (req, res) => {
    const result = await orderService.createOrder(req.body, req.user);
    ApiResponse.created(res, result, 'Order created successfully');
  });

  // ------------------------------- Get User Orders ----------------------------
  getMyOrders = catchAsync(async (req, res) => {
    const userEmail = req.user.auth?.email || req.user.email;
    const result = await orderService.getMyOrders(req.user._id, req.query, userEmail);
    ApiResponse.success(res, result, 'Orders retrieved successfully');
  });

  // ------------------------------- Get Order By ID ----------------------------
  getOrderById = catchAsync(async (req, res) => {
    const order = await orderService.getOrderById(req.params.id, req.user, getOrderAccessToken(req));
    ApiResponse.success(res, order, 'Order retrieved successfully');
  });

  // ------------------------------- Get Order By Order Number ----------------------------
  getOrderByNumber = catchAsync(async (req, res) => {
    const order = await orderService.getOrderByNumber(req.params.orderNumber, req.user, getOrderAccessToken(req));
    ApiResponse.success(res, order, 'Order retrieved successfully');
  });

  // ------------------------------- Cancel Order ----------------------------
  cancelOrder = catchAsync(async (req, res) => {
    const updated = await orderService.cancelOrder(req.params.id, req.user, req.body?.reason, getOrderAccessToken(req));
    ApiResponse.success(res, updated, 'Order cancelled successfully');
  });

  // ------------------------------- Admin: Get All Orders ----------------------------
  getAllOrders = catchAsync(async (req, res) => {
    const result = await orderService.getAllOrders(req.query);
    ApiResponse.success(res, result, 'Orders retrieved successfully');
  });

  // ------------------------------- Admin: Update Order Status ----------------------------
  updateOrderStatus = catchAsync(async (req, res) => {
    const updated = await orderService.updateOrderStatus(req.params.id, req.body, req.user);
    ApiResponse.success(res, updated, 'Order status updated successfully');
  });

  // ------------------------------- Download Invoice PDF ----------------------------
  downloadInvoice = catchAsync(async (req, res) => {
    const orderId = req.params.id;
    const { order, pdfBuffer } = await orderService.generateOrderInvoice(orderId, req.user, getOrderAccessToken(req));
    const safeOrderNum = (order.orderNumber || 'ORD').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `NEIRAH_INVOICE_${safeOrderNum}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  });

  // ------------------------------- Send Invoice (Email & WhatsApp) ----------------------------
  sendInvoice = catchAsync(async (req, res) => {
    const orderId = req.params.id || req.body.id || req.body.orderId;
    if (!orderId) {
      throw new ApiError(400, 'Order ID is required');
    }
    const methods = Array.isArray(req.body.methods) && req.body.methods.length > 0
      ? req.body.methods
      : ['email', 'whatsapp'];

    // Support direct PDF download via sendInvoice if methods includes 'download'
    if (methods.includes('download') && methods.length === 1) {
      const { order, pdfBuffer } = await orderService.generateOrderInvoice(orderId, req.user);
      const safeOrderNum = (order.orderNumber || 'ORD').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `NEIRAH_INVOICE_${safeOrderNum}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    }

    const result = await orderService.dispatchInvoice(orderId, methods);
    ApiResponse.success(
      res,
      result,
      result.dispatched.length > 0
        ? `Invoice dispatched successfully via ${result.dispatched.join(' & ')}`
        : 'Invoice dispatch processed'
    );
  });

  // ------------------------------- Admin: Delete Order ----------------------------
  deleteOrder = catchAsync(async (req, res) => {
    const result = await orderService.deleteOrder(req.params.id, req.user);
    ApiResponse.success(res, null, result.message);
  });

  // ------------------------------- Admin: Bulk Delete Orders ----------------------------
  bulkDeleteOrders = catchAsync(async (req, res) => {
    const ids = req.body.ids || req.body.orderIds;
    const result = await orderService.bulkDeleteOrders(ids, req.user);
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new OrderController();

