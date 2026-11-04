const Order = require('../order/order.model');
const providersRegistry = require('./providers');
const ApiError = require('../../utils/ApiError');

class PaymentService {
    // ------------------------------- get payment config ----------------------------
  async getPaymentConfig() {
    let defaultGateway = 'razorpay';
    try {
      const Setting = require('../setting/setting.model');
      const setting = await Setting.findOne({ 'meta.deletedAt': null }).select('paymentProvider').lean();
      if (setting?.paymentProvider) {
        defaultGateway = setting.paymentProvider.toLowerCase();
      } else if (process.env.DEFAULT_PAYMENT_GATEWAY) {
        defaultGateway = process.env.DEFAULT_PAYMENT_GATEWAY.toLowerCase();
      }
    } catch {
      defaultGateway = (process.env.DEFAULT_PAYMENT_GATEWAY || 'razorpay').toLowerCase();
    }

    const activeProviders = providersRegistry.getActiveProviders().map((p) => p.getPublicConfig());

    return {
      defaultProvider: defaultGateway,
      availableProviders: activeProviders,
    };
  }

    // ------------------------------- initiate order payment ----------------------------
  async initiateOrderPayment({ order, orderId, provider }) {
    const orderDoc = typeof order === 'object' && order?._id
      ? order
      : await Order.findById(order || orderId);

    if (!orderDoc) {
      throw new ApiError(404, 'Order not found');
    }

    if (orderDoc.payment?.status === 'paid') {
      throw new ApiError(400, 'This order has already been paid');
    }

    // Determine payable amount (full total or COD advance charge)
    let payableAmount = orderDoc.pricing?.total || 0;
    if (orderDoc.payment?.method === 'cod' && (orderDoc.pricing?.codDueNow || 0) > 0) {
      payableAmount = orderDoc.pricing.codDueNow;
    }

    if (payableAmount <= 0) {
      orderDoc.payment.status = 'paid';
      orderDoc.payment.paidAt = new Date();
      orderDoc.orderStatus = 'confirmed';
      await orderDoc.save();
      return { provider: 'none', status: 'paid', order: orderDoc };
    }

    // Resolve provider instance from registry
    const chosenProviderName = provider || orderDoc.payment?.provider || process.env.DEFAULT_PAYMENT_GATEWAY || 'razorpay';
    const providerInstance = providersRegistry.getProvider(chosenProviderName);

    // Delegate payment initiation to the provider service
    return await providerInstance.initiatePayment({
      order: orderDoc,
      amount: payableAmount,
    });
  }

    // ------------------------------- verify razorpay payment ----------------------------
  async verifyRazorpayPayment(params) {
    const razorpay = providersRegistry.getProvider('razorpay');
    return await razorpay.verifyPayment(params);
  }

    // ------------------------------- handle ccavenue response ----------------------------
  async handleCCAvenueResponse(encResp) {
    const ccavenue = providersRegistry.getProvider('ccavenue');
    return await ccavenue.handleResponse(encResp);
  }

    // ------------------------------- handle razorpay webhook ----------------------------
  async handleRazorpayWebhook(params) {
    const razorpay = providersRegistry.getProvider('razorpay');
    return await razorpay.handleWebhook(params);
  }

    // ------------------------------- handle ccavenue webhook ----------------------------
  async handleCCAvenueWebhook(params) {
    const ccavenue = providersRegistry.getProvider('ccavenue');
    return await ccavenue.handleWebhook(params);
  }
}

module.exports = new PaymentService();
