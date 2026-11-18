const crypto = require('crypto');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const BasePaymentProvider = require('./base.provider');
const Order = require('../../order/order.model');
const ApiError = require('../../../utils/ApiError');

class RazorpayService extends BasePaymentProvider {
  constructor() {
    super('razorpay', 'Razorpay');
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    this.client = null;

    if (this.keyId && this.keySecret) {
      this.client = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret,
      });
    }
  }

  // ------------------------------- check if razorpay configured ----------------------------
  isConfigured() {
    return Boolean(this.keyId && this.keySecret);
  }

  // ------------------------------- get razorpay client ----------------------------
  getClient() {
    if (!this.client) {
      this.keyId = process.env.RAZORPAY_KEY_ID || '';
      this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

      if (this.keyId && this.keySecret) {
        this.client = new Razorpay({
          key_id: this.keyId,
          key_secret: this.keySecret,
        });
      }
    }

    if (!this.client) {
      throw new ApiError(500, 'Razorpay credentials (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) are not configured.');
    }
    return this.client;
  }

  // ------------------------------- get razorpay public config ----------------------------
  getPublicConfig() {
    return {
      id: this.name,
      name: this.displayName,
      supportsCards: true,
      supportsUPI: true,
      supportsNetBanking: true,
      keyId: this.keyId,
    };
  }

  // ------------------------------- create razorpay gateway order ----------------------------
  async createGatewayOrder({ amount, receipt, currency = 'INR', notes = {} }) {
    const client = this.getClient();
    const amountInPaise = Math.round(Number(amount) * 100);

    if (isNaN(amountInPaise) || amountInPaise <= 0) {
      throw new ApiError(400, 'Invalid payment amount');
    }

    const options = {
      amount: amountInPaise,
      currency,
      receipt: String(receipt || Date.now()).substring(0, 40),
      notes: {
        ...notes,
      },
    };

    const razorpayOrder = await client.orders.create(options);
    return {
      gatewayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount, // in paise
      amountFormatted: Number(amount), // in INR
      currency: razorpayOrder.currency,
      receipt: razorpayOrder.receipt,
      status: razorpayOrder.status,
    };
  }

  // ------------------------------- verify payment signature ----------------------------
  verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new ApiError(400, 'Missing required Razorpay signature parameters');
    }

    const secret = this.keySecret || process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      throw new ApiError(500, 'Razorpay secret key is not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(razorpaySignature, 'utf8')
    );

    if (!isValid) {
      throw new ApiError(400, 'Invalid Razorpay payment signature');
    }

    return true;
  }

  // ------------------------------- get webhook secret ----------------------------
  getWebhookSecret() {
    return process.env.RAZORPAY_WEBHOOK_SECRET || this.webhookSecret || '';
  }

  // ------------------------------- verify webhook signature ----------------------------
  verifyWebhookSignature(rawBody, signature, webhookSecret = this.getWebhookSecret()) {
    if (!webhookSecret) {
      throw new ApiError(500, 'Razorpay webhook secret (RAZORPAY_WEBHOOK_SECRET) is not configured in .env');
    }
    if (!signature) {
      throw new ApiError(400, 'Missing x-razorpay-signature header');
    }

    const bodyBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody), 'utf8');

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyBuffer)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  }

  // ------------------------------- fetch payment details ----------------------------
  async fetchPayment(paymentId) {
    const client = this.getClient();
    return await client.payments.fetch(paymentId);
  }

  // ------------------------------- initiate payment ----------------------------
  async initiatePayment({ order, amount }) {
    const razorpayData = await this.createGatewayOrder({
      amount,
      receipt: order.orderNumber,
      currency: 'INR',
      notes: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: (order.userId || order.user) ? (order.userId || order.user).toString() : '',
      },
    });

    order.payment.provider = this.name;
    order.payment.gatewayOrderId = razorpayData.gatewayOrderId;
    order.payment.status = 'processing';
    await order.save();

    return {
      provider: this.name,
      orderId: order._id,
      orderNumber: order.orderNumber,
      amount,
      keyId: this.keyId,
      gatewayOrderId: razorpayData.gatewayOrderId,
      currency: razorpayData.currency,
      receipt: razorpayData.receipt,
    };
  }

  // ------------------------------- verify payment ----------------------------
  async verifyPayment({ orderId, orderNumber, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    this.verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    const query = [];
    if (orderId) query.push({ _id: orderId });
    if (orderNumber) query.push({ orderNumber });
    if (razorpayOrderId) query.push({ 'payment.gatewayOrderId': razorpayOrderId });

    const order = await Order.findOne({ $or: query });
    if (!order) {
      throw new ApiError(404, 'Associated order not found for payment verification');
    }

    if (order.payment.status === 'paid') {
      return order;
    }

    let paymentDetails = null;
    let paymentMode = null;
    try {
      paymentDetails = await this.fetchPayment(razorpayPaymentId);
      paymentMode = paymentDetails?.method || null;
    } catch {
      // Continue even if fetching payment details fails
    }

    return await this.markOrderAsPaid(order, {
      transactionId: razorpayPaymentId,
      gatewayOrderId: razorpayOrderId,
      signature: razorpaySignature,
      paymentMode,
      paymentDetails,
      timelineMessage: `Payment of ₹${order.payment.paidAmount || order.pricing.total} verified successfully via Razorpay (${razorpayPaymentId})`,
    });
  }

  // ------------------------------- handle razorpay webhook ----------------------------
  async handleWebhook({ rawBody, signature, eventData }) {
    if (!eventData || typeof eventData !== 'object') {
      throw new ApiError(400, 'Invalid webhook payload');
    }

    // 1. Validate signature
    const isValid = this.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new ApiError(400, 'Invalid Razorpay webhook signature');
    }

    const event = eventData.event;
    const payload = eventData.payload || {};

    // 2. Handle Payment Captured & Order Paid
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payment?.entity;
      const orderEntity = payload.order?.entity;

      const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;
      const paymentId = paymentEntity?.id;
      const receipt = orderEntity?.receipt || paymentEntity?.notes?.orderNumber;
      const orderId = paymentEntity?.notes?.orderId || orderEntity?.notes?.orderId;

      const query = [];
      if (orderId && mongoose.isValidObjectId(orderId)) {
        query.push({ _id: orderId });
      }
      if (razorpayOrderId) {
        query.push({ 'payment.gatewayOrderId': razorpayOrderId });
      }
      if (receipt) {
        query.push({ orderNumber: receipt });
      }

      if (query.length > 0) {
        const order = await Order.findOne({ $or: query });
        if (order) {
          if (order.payment.status !== 'paid') {
            const amountInPaise = paymentEntity?.amount || orderEntity?.amount_paid;
            const paidAmount = amountInPaise ? amountInPaise / 100 : undefined;

            await this.markOrderAsPaid(order, {
              transactionId: paymentId,
              gatewayOrderId: razorpayOrderId,
              paidAmount,
              paymentMode: paymentEntity?.method,
              paymentDetails: paymentEntity || orderEntity,
              timelineMessage: `Payment confirmed via Razorpay webhook (${event}: ${paymentId})`,
            });
          }
          return { status: 'processed', event, orderId: order._id, orderNumber: order.orderNumber };
        }
      }
      return { status: 'ignored', reason: 'order_not_found', event };
    }

    // 3. Handle Payment Authorized (auto-capture if needed)
    if (event === 'payment.authorized') {
      const paymentEntity = payload.payment?.entity;
      const paymentId = paymentEntity?.id;
      const amount = paymentEntity?.amount;

      // If merchant account doesn't have auto-capture, capture authorized payment
      if (paymentId && amount) {
        try {
          const client = this.getClient();
          await client.payments.capture(paymentId, amount);
        } catch (captureErr) {
          console.warn('[RazorpayWebhook] Auto-capture of authorized payment notice:', captureErr.message);
        }
      }
      return { status: 'authorized', event, paymentId };
    }

    // 4. Handle Payment Failed
    if (event === 'payment.failed') {
      const paymentEntity = payload.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id;
      const orderId = paymentEntity?.notes?.orderId;
      const receipt = paymentEntity?.notes?.orderNumber;

      const query = [];
      if (orderId && mongoose.isValidObjectId(orderId)) {
        query.push({ _id: orderId });
      }
      if (razorpayOrderId) {
        query.push({ 'payment.gatewayOrderId': razorpayOrderId });
      }
      if (receipt) {
        query.push({ orderNumber: receipt });
      }

      if (query.length > 0) {
        const order = await Order.findOne({ $or: query });
        if (order && order.payment.status !== 'paid') {
          const reason = paymentEntity?.error_description || paymentEntity?.error_reason || 'Payment failed';
          await this.markOrderAsFailed(order, {
            reason,
            paymentDetails: paymentEntity,
            timelineMessage: `Payment failure reported via Razorpay webhook: ${reason}`,
          });
          return { status: 'failed', event, orderId: order._id, reason };
        }
      }
      return { status: 'ignored', reason: 'order_not_found_or_already_paid', event };
    }

    // 5. Handle Refunds (refund.created, refund.processed)
    if (event === 'refund.created' || event === 'refund.processed') {
      const refundEntity = payload.refund?.entity;
      const paymentId = refundEntity?.payment_id;

      if (paymentId) {
        const order = await Order.findOne({ 'payment.transactionId': paymentId });
        if (order) {
          order.payment.refundStatus = refundEntity.status || 'processed';
          order.payment.refundId = refundEntity.id;
          order.payment.refundedAmount = (refundEntity.amount || 0) / 100;
          await order.save();
          return { status: 'refund_recorded', event, orderId: order._id };
        }
      }
      return { status: 'ignored', reason: 'refund_order_not_found', event };
    }

    // 6. Default acknowledgement for any other Razorpay events
    return { status: 'acknowledged', event };
  }
}

module.exports = new RazorpayService();
