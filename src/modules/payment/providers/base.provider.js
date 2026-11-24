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

  isConfigured() {
    return false;
  }

  getPublicConfig() {
    return {
      id: this.name,
      name: this.displayName,
      isConfigured: this.isConfigured(),
    };
  }

  // Initiate payment session with gateway for an order
  async initiatePayment({ order, amount }) {
    throw new ApiError(501, `initiatePayment not implemented for ${this.name}`);
  }

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

    order.payment.status = order.payment?.method === 'cod' ? 'partially_paid' : 'paid';
    order.payment.provider = this.name;
    if (details.transactionId) order.payment.transactionId = details.transactionId;
    if (details.gatewayOrderId) order.payment.gatewayOrderId = details.gatewayOrderId;
    if (details.signature) order.payment.signature = details.signature;
    if (details.paymentMode) order.payment.paymentMode = details.paymentMode;
    if (details.paymentDetails) order.payment.paymentDetails = details.paymentDetails;
    order.payment.paidAt = new Date();
    order.payment.paidAmount = payableAmount;
    if (order.pricing) {
      order.pricing.paidAmount = payableAmount;
    }

    // Advance orderStatus if pending
    if (order.orderStatus === 'pending') {
      order.orderStatus = 'processing';
    }

    if (!order.orderTimeline) {
      order.orderTimeline = {};
    }
    if (!order.orderTimeline.accepted) {
      order.orderTimeline.accepted = {};
    }
    order.orderTimeline.accepted.at = order.orderTimeline.accepted.at || new Date();

    await order.save();

    // Clear cart if this order belongs to a registered user
    const orderUser = order.userId || order.user;
    if (orderUser) {
      try {
        await Cart.updateOne(
          { $or: [{ user: orderUser }, { userId: orderUser }] },
          { $set: { items: [] } }
        );
      } catch (err) {
        console.warn('Failed to clear user cart after payment:', err.message);
      }
    }

    // Automated Dispatch: Generate PDF invoice and deliver to customer email in background
    try {
      const orderService = require('../../order/order.service');
      orderService.dispatchInvoice(order._id, ['email']).catch((err) => {
        console.warn('[AutoInvoice] Background order invoice dispatch failed:', err.message);
      });
    } catch {
      // Ignored if invoice service is not available
    }

    return order;
  }

  // Mark an order as failed with reason and timeline update
  async markOrderAsFailed(order, details = {}) {
    if (!order) return null;

    if (order.payment?.status === 'paid') {
      return order; // Do not overwrite an already paid order
    }

    order.payment.status = 'failed';
    order.payment.provider = this.name;
    order.payment.failureReason = details.reason || 'Payment failed';
    if (details.paymentDetails) order.payment.paymentDetails = details.paymentDetails;

    await order.save();
    return order;
  }
}

module.exports = BasePaymentProvider;
