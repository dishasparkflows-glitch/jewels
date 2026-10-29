const Cart = require('../../cart/cart.model');
const ApiError = require('../../../utils/ApiError');

class BasePaymentProvider {
  constructor(name, displayName) {
    if (!name) {
      throw new Error('Payment provider must have a unique name identifier');
    }
    this.name = name;
    this.displayName = displayName || name;
  }

  /**
   * Check whether this provider has its required environment credentials configured
   * @returns {boolean}
   */
  isConfigured() {
    return false;
  }

  /**
   * Return client-safe configuration for frontend checkout
   * @returns {Object}
   */
  getPublicConfig() {
    return {
      id: this.name,
      name: this.displayName,
      isConfigured: this.isConfigured(),
    };
  }

  /**
   * Initiate payment session with gateway for an order
   * @param {Object} params
   * @param {Object} params.order - The Mongoose Order document
   * @param {number} params.amount - The payable amount in INR
   */
  async initiatePayment({ order, amount }) {
    throw new ApiError(501, `initiatePayment not implemented for ${this.name}`);
  }

  /**
   * Mark an order as paid, append timeline, and clear user's cart
   */
  async markOrderAsPaid(order, details = {}) {
    if (!order) return null;

    if (order.payment?.status === 'paid') {
      return order;
    }

    const payableAmount = details.paidAmount !== undefined
      ? details.paidAmount
      : (order.payment?.method === 'cod' && (order.pricing?.codDueNow || 0) > 0
          ? order.pricing.codDueNow
          : order.pricing?.total || 0);

    order.payment.status = 'paid';
    order.payment.provider = this.name;
    if (details.transactionId) order.payment.transactionId = details.transactionId;
    if (details.gatewayOrderId) order.payment.gatewayOrderId = details.gatewayOrderId;
    if (details.signature) order.payment.signature = details.signature;
    if (details.paymentMode) order.payment.paymentMode = details.paymentMode;
    if (details.paymentDetails) order.payment.paymentDetails = details.paymentDetails;
    order.payment.paidAt = new Date();
    order.payment.paidAmount = payableAmount;

    order.orderStatus = 'confirmed';

    order.timeline.push({
      status: 'paid',
      message: details.timelineMessage || `Payment of ₹${payableAmount} completed successfully via ${this.displayName}`,
      timestamp: new Date(),
    });

    await order.save();

    // Clear cart if this order belongs to a registered user
    if (order.user) {
      try {
        await Cart.updateOne(
          { $or: [{ user: order.user }, { userId: order.user }] },
          { $set: { items: [] } }
        );
      } catch (err) {
        console.warn('Failed to clear user cart after payment:', err.message);
      }
    }

    return order;
  }

  /**
   * Mark an order as failed with reason and timeline update
   */
  async markOrderAsFailed(order, details = {}) {
    if (!order) return null;

    if (order.payment?.status === 'paid') {
      return order; // Do not overwrite an already paid order
    }

    order.payment.status = 'failed';
    order.payment.provider = this.name;
    order.payment.failureReason = details.reason || 'Payment failed';
    if (details.paymentDetails) order.payment.paymentDetails = details.paymentDetails;

    order.timeline.push({
      status: 'payment_failed',
      message: details.timelineMessage || `Payment failed via ${this.displayName}: ${order.payment.failureReason}`,
      timestamp: new Date(),
    });

    await order.save();
    return order;
  }
}

module.exports = BasePaymentProvider;
