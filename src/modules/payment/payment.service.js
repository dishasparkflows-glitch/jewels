const Order = require('../order/order.model');
const providersRegistry = require('./providers');
const ApiError = require('../../utils/ApiError');
const { getTestPaymentPhoneNumbers, isTestPaymentUser } = require('../../utils/testPaymentUtils');

class PaymentService {
  // ------------------------------- get payment config ----------------------------
  async getPaymentConfig() {
    let defaultGateway = 'razorpay';
    try {
      const Setting = require('../setting/setting.model');
      const setting = await Setting.findOne({ 'meta.deletedAt': null })
        .select('paymentProvider')
        .lean();
      if (setting?.paymentProvider) {
        defaultGateway = setting.paymentProvider.toLowerCase();
      } else if (process.env.PAYMENT_PROVIDER) {
        defaultGateway = process.env.PAYMENT_PROVIDER.toLowerCase();
      }
    } catch {
      defaultGateway = (
        process.env.PAYMENT_PROVIDER || 'razorpay'
      ).toLowerCase();
    }

    const activeProviders = providersRegistry
      .getActiveProviders()
      .map((p) => p.getPublicConfig());

    return {
      defaultProvider: defaultGateway,
      availableProviders: activeProviders,
      testPhoneNumbers: getTestPaymentPhoneNumbers(),
    };
  }

  // ------------------------------- initiate order payment ----------------------------
  async initiateOrderPayment({ order, orderId, provider }) {
    const orderDoc =
      typeof order === 'object' && order?._id
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
    if (
      orderDoc.payment?.method === 'cod' &&
      (orderDoc.pricing?.codDueNow || 0) > 0
    ) {
      payableAmount = orderDoc.pricing.codDueNow;
    }

    // Override payable amount to ₹1 if user's phone matches TEST_PAYMENT_PHONE_NUMBERS in .env
    if (
      isTestPaymentUser({
        user: orderDoc.userId,
        customer: orderDoc.customer,
        shippingAddress: orderDoc.shippingAddress,
      })
    ) {
      payableAmount = 1;
    }

    if (payableAmount <= 0) {
      orderDoc.payment.status = 'paid';
      orderDoc.payment.paidAt = new Date();
      await orderDoc.save();
      return { provider: 'none', status: 'paid', order: orderDoc };
    }

    // Resolve provider instance from registry
    const chosenProviderName =
      provider ||
      orderDoc.payment?.provider ||
      process.env.PAYMENT_PROVIDER ||
      'razorpay';
    const providerInstance = providersRegistry.getProvider(chosenProviderName);

    // Delegate payment initiation to the provider service
    return await providerInstance.initiatePayment({
      order: orderDoc,
      amount: payableAmount
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
