const crypto = require('crypto');
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

  isConfigured() {
    return Boolean(this.keyId && this.keySecret);
  }

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

  /**
   * Internal SDK order creation
   */
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

  /**
   * Signature verification helper
   */
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

  /**
   * Webhook signature verification helper
   */
  verifyWebhookSignature(rawBody, signature, webhookSecret = this.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET) {
    if (!webhookSecret) {
      throw new ApiError(500, 'Razorpay webhook secret is not configured');
    }
    if (!signature) {
      throw new ApiError(400, 'Missing x-razorpay-signature header');
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  }

  async fetchPayment(paymentId) {
    const client = this.getClient();
    return await client.payments.fetch(paymentId);
  }

  /**
   * Standard Initiate Payment method
   */
  async initiatePayment({ order, amount }) {
    const razorpayData = await this.createGatewayOrder({
      amount,
      receipt: order.orderNumber,
      currency: 'INR',
      notes: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: order.user ? order.user.toString() : '',
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

  /**
   * Standard Verify Payment method (called after client checkout modal completes)
   */
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

  /**
   * Standard Webhook Handler method
   */
  async handleWebhook({ rawBody, signature, eventData }) {
    this.verifyWebhookSignature(rawBody, signature);

    const event = eventData.event;
    const payload = eventData.payload;

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payment?.entity;
      const orderEntity = payload.order?.entity;

      const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;
      const paymentId = paymentEntity?.id;
      const receipt = orderEntity?.receipt || paymentEntity?.notes?.orderNumber;
      const orderId = paymentEntity?.notes?.orderId || orderEntity?.notes?.orderId;

      const query = [];
      if (orderId) query.push({ _id: orderId });
      if (razorpayOrderId) query.push({ 'payment.gatewayOrderId': razorpayOrderId });
      if (receipt) query.push({ orderNumber: receipt });

      if (query.length > 0) {
        const order = await Order.findOne({ $or: query });
        if (order && order.payment.status !== 'paid') {
          await this.markOrderAsPaid(order, {
            transactionId: paymentId,
            gatewayOrderId: razorpayOrderId,
            paymentMode: paymentEntity?.method,
            paymentDetails: paymentEntity,
            timelineMessage: `Payment confirmed via Razorpay webhook (${paymentId})`,
          });
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id;
      const orderId = paymentEntity?.notes?.orderId;

      const query = [];
      if (orderId) query.push({ _id: orderId });
      if (razorpayOrderId) query.push({ 'payment.gatewayOrderId': razorpayOrderId });

      if (query.length > 0) {
        const order = await Order.findOne({ $or: query });
        if (order && order.payment.status !== 'paid') {
          await this.markOrderAsFailed(order, {
            reason: paymentEntity?.error_description || 'Payment failed',
            paymentDetails: paymentEntity,
            timelineMessage: `Payment failure reported via Razorpay webhook: ${paymentEntity?.error_description || 'Unknown'}`,
          });
        }
      }
    }

    return { status: 'ok' };
  }
}

module.exports = new RazorpayService();
