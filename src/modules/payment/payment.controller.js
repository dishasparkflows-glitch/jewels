const paymentService = require('./payment.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class PaymentController {
  // ------------------------------- Get Payment Config ----------------------------
  getConfig = catchAsync(async (req, res) => {
    const config = await paymentService.getPaymentConfig();
    ApiResponse.success(res, config, 'Payment configuration retrieved successfully');
  });

  // ------------------------------- Initiate Payment ----------------------------
  initiatePayment = catchAsync(async (req, res) => {
    const { orderId, provider } = req.body;
    const paymentData = await paymentService.initiateOrderPayment({
      orderId,
      provider,
    });
    ApiResponse.success(res, paymentData, 'Payment initiated successfully');
  });

  // ------------------------------- Verify Razorpay Payment ----------------------------
  verifyRazorpay = catchAsync(async (req, res) => {
    const { orderId, orderNumber, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const order = await paymentService.verifyRazorpayPayment({
      orderId,
      orderNumber,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (order && order._id) {
      try {
        const orderService = require('../order/order.service');
        orderService.dispatchInvoice(order._id, ['email']).catch((err) => {
          console.warn('[AutoInvoice] Post-payment invoice dispatch failed:', err.message);
        });
      } catch (e) {
        console.warn('[AutoInvoice] Could not trigger invoice dispatch:', e.message);
      }
    }

    ApiResponse.success(res, { order }, 'Payment verified successfully');
  });

  // ------------------------------- CCAvenue Redirect Callback ----------------------------
  handleCCAvenueResponse = catchAsync(async (req, res) => {
    const encResp = req.body?.encResp;
    const result = await paymentService.handleCCAvenueResponse(encResp);
    res.redirect(result.redirectUrl);
  });

  // ------------------------------- Razorpay Webhook ----------------------------
  handleRazorpayWebhook = catchAsync(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    await paymentService.handleRazorpayWebhook({
      rawBody,
      signature,
      eventData: req.body,
    });

    res.status(200).json({ status: 'ok' });
  });

  // ------------------------------- CCAvenue S2S Webhook ----------------------------
  handleCCAvenueWebhook = catchAsync(async (req, res) => {
    const encResp = req.body?.encResp;
    await paymentService.handleCCAvenueWebhook({ encResp });
    res.status(200).send('OK');
  });
}

module.exports = new PaymentController();

