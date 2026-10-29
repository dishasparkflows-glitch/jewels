const Order = require('../order/order.model');
const providersRegistry = require('./providers');
const ApiError = require('../../utils/ApiError');

/**
 * Payment Orchestrator Service
 * Delegates provider-specific logic to isolated provider services in `./providers/`
 */
class PaymentService {
  /**
   * Return gateway configuration and active providers for client checkout
   */
  getPaymentConfig() {
    const defaultGateway = (process.env.DEFAULT_PAYMENT_GATEWAY || 'razorpay').toLowerCase();
    const activeProviders = providersRegistry.getActiveProviders().map((p) => p.getPublicConfig());

    return {
      defaultProvider: activeProviders.some((p) => p.id === defaultGateway)
        ? defaultGateway
        : activeProviders[0]?.id || 'razorpay',
      availableProviders: activeProviders,
    };
  }

  /**
   * Initiate payment for an existing order with the selected provider
   * @param {Object} options
   * @param {string|Order} options.order - Order document or Order ID
   * @param {string} [options.provider] - 'razorpay' | 'ccavenue' | etc.
   */
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

  /**
   * Razorpay payment signature verification
   */
  async verifyRazorpayPayment(params) {
    const razorpay = providersRegistry.getProvider('razorpay');
    return await razorpay.verifyPayment(params);
  }

  /**
   * CCAvenue POST redirect callback handling
   */
  async handleCCAvenueResponse(encResp) {
    const ccavenue = providersRegistry.getProvider('ccavenue');
    return await ccavenue.handleResponse(encResp);
  }

  /**
   * Razorpay Webhook notification handling
   */
  async handleRazorpayWebhook(params) {
    const razorpay = providersRegistry.getProvider('razorpay');
    return await razorpay.handleWebhook(params);
  }

  /**
   * CCAvenue S2S Webhook notification handling
   */
  async handleCCAvenueWebhook(params) {
    const ccavenue = providersRegistry.getProvider('ccavenue');
    return await ccavenue.handleWebhook(params);
  }
}

module.exports = new PaymentService();
