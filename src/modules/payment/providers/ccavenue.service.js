const crypto = require('crypto');
const BasePaymentProvider = require('./base.provider');
const Order = require('../../order/order.model');
const ApiError = require('../../../utils/ApiError');

class CCAvenueService extends BasePaymentProvider {
  constructor() {
    super('ccavenue', 'CCAvenue');
    this.merchantId = process.env.CCAVENUE_MERCHANT_ID || '';
    this.accessCode = process.env.CCAVENUE_ACCESS_CODE || '';
    this.workingKey = process.env.CCAVENUE_WORKING_KEY || '';
    this.environment = (process.env.CCAVENUE_ENVIRONMENT || 'uat').toLowerCase();
    this.gatewayUrl =
      process.env.CCAVENUE_URL ||
      (this.environment === 'production'
        ? 'https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction'
        : 'https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction');

    this.iv = Buffer.from([
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
      0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
    ]);
  }

  isConfigured() {
    return Boolean(this.merchantId && this.accessCode && this.workingKey);
  }

  getPublicConfig() {
    return {
      id: this.name,
      name: this.displayName,
      supportsCards: true,
      supportsUPI: true,
      supportsNetBanking: true,
      accessCode: this.accessCode,
      gatewayUrl: this.gatewayUrl,
    };
  }

  /**
   * Derive 128-bit key from workingKey using MD5 hash
   */
  getKey() {
    const workingKey = this.workingKey || process.env.CCAVENUE_WORKING_KEY;
    if (!workingKey) {
      throw new ApiError(500, 'CCAVENUE_WORKING_KEY is not configured');
    }
    const hash = crypto.createHash('md5');
    hash.update(workingKey);
    return hash.digest();
  }

  /**
   * Encrypt plaintext query string with AES-128-CBC
   */
  encrypt(plainText) {
    const key = this.getKey();
    const cipher = crypto.createCipheriv('aes-128-cbc', key, this.iv);
    let encoded = cipher.update(plainText, 'utf8', 'hex');
    encoded += cipher.final('hex');
    return encoded;
  }

  /**
   * Decrypt hex encoded response string with AES-128-CBC
   */
  decrypt(encResp) {
    if (!encResp) {
      throw new ApiError(400, 'Missing encrypted CCAvenue response');
    }
    const key = this.getKey();
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, this.iv);
    let decoded = decipher.update(encResp, 'hex', 'utf8');
    decoded += decipher.final('utf8');
    return decoded;
  }

  /**
   * Parse decrypted query string into an object
   */
  parseResponse(decryptedText) {
    const result = {};
    if (!decryptedText) return result;

    const parts = decryptedText.split('&');
    for (const part of parts) {
      const idx = part.indexOf('=');
      if (idx !== -1) {
        const key = part.substring(0, idx).trim();
        const rawVal = part.substring(idx + 1);
        try {
          result[key] = decodeURIComponent(rawVal.replace(/\+/g, ' '));
        } catch {
          result[key] = rawVal;
        }
      }
    }
    return result;
  }

  decryptAndParse(encResp) {
    const decryptedText = this.decrypt(encResp);
    return this.parseResponse(decryptedText);
  }

  /**
   * Build encrypted request form parameters
   */
  buildPaymentRequest({
    orderNumber,
    amount,
    currency = 'INR',
    redirectUrl,
    cancelUrl,
    billing = {},
    delivery = {},
    customParams = {},
  }) {
    const merchantId = this.merchantId || process.env.CCAVENUE_MERCHANT_ID;
    const accessCode = this.accessCode || process.env.CCAVENUE_ACCESS_CODE;

    if (!merchantId || !accessCode) {
      throw new ApiError(500, 'CCAvenue merchant ID or access code is missing');
    }

    const formattedAmount = Number(amount).toFixed(2);
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

    const defaultRedirectUrl = `${backendUrl}/api/payments/ccavenue/response`;
    const defaultCancelUrl = `${backendUrl}/api/payments/ccavenue/response`;

    const params = {
      merchant_id: merchantId,
      order_id: String(orderNumber),
      currency: currency || 'INR',
      amount: formattedAmount,
      redirect_url: redirectUrl || defaultRedirectUrl,
      cancel_url: cancelUrl || defaultCancelUrl,
      language: 'EN',

      // Billing details
      billing_name: [billing.firstName, billing.lastName].filter(Boolean).join(' ') || billing.name || 'Customer',
      billing_address: billing.addressLine || billing.address || 'Address',
      billing_city: billing.city || 'City',
      billing_state: billing.state || 'State',
      billing_zip: billing.postalCode || billing.pincode || '000000',
      billing_country: billing.country || 'India',
      billing_tel: billing.phone || '',
      billing_email: billing.email || '',

      // Delivery details
      delivery_name: [delivery.firstName, delivery.lastName].filter(Boolean).join(' ') || delivery.name || billing.name || 'Customer',
      delivery_address: delivery.addressLine || delivery.address || billing.addressLine || 'Address',
      delivery_city: delivery.city || billing.city || 'City',
      delivery_state: delivery.state || billing.state || 'State',
      delivery_zip: delivery.postalCode || delivery.pincode || billing.postalCode || '000000',
      delivery_country: delivery.country || billing.country || 'India',
      delivery_tel: delivery.phone || billing.phone || '',

      // Custom parameters
      merchant_param1: customParams.orderId || '',
      merchant_param2: customParams.userId || '',
      merchant_param3: customParams.orderNumber || String(orderNumber),
      merchant_param4: customParams.platform || 'web',
      merchant_param5: customParams.paymentType || 'full',
    };

    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v ?? ''))}`)
      .join('&');

    const encRequest = this.encrypt(queryString);

    return {
      provider: this.name,
      accessCode,
      encRequest,
      gatewayUrl: this.gatewayUrl,
      orderNumber,
      amount: formattedAmount,
      currency,
    };
  }

  /**
   * Standard Initiate Payment method
   */
  async initiatePayment({ order, amount }) {
    const ccData = this.buildPaymentRequest({
      orderNumber: order.orderNumber,
      amount,
      currency: 'INR',
      billing: {
        firstName: order.shippingAddress?.firstName || order.customer?.firstName,
        lastName: order.shippingAddress?.lastName || order.customer?.lastName,
        email: order.shippingAddress?.email || order.customer?.email,
        phone: order.shippingAddress?.phone || order.customer?.phone,
        addressLine: order.shippingAddress?.addressLine,
        city: order.shippingAddress?.city,
        state: order.shippingAddress?.state,
        postalCode: order.shippingAddress?.postalCode,
        country: order.shippingAddress?.country || 'India',
      },
      delivery: {
        firstName: order.shippingAddress?.firstName,
        lastName: order.shippingAddress?.lastName,
        email: order.shippingAddress?.email,
        phone: order.shippingAddress?.phone,
        addressLine: order.shippingAddress?.addressLine,
        city: order.shippingAddress?.city,
        state: order.shippingAddress?.state,
        postalCode: order.shippingAddress?.postalCode,
        country: order.shippingAddress?.country || 'India',
      },
      customParams: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: order.user ? order.user.toString() : '',
      },
    });

    order.payment.provider = this.name;
    order.payment.gatewayOrderId = order.orderNumber;
    order.payment.status = 'processing';
    await order.save();

    return {
      provider: this.name,
      orderId: order._id,
      orderNumber: order.orderNumber,
      amount,
      ...ccData,
    };
  }

  /**
   * Standard Handler for CCAvenue POST Redirect Callback
   */
  async handleResponse(encResp) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';

    if (!encResp) {
      return {
        redirectUrl: `${frontendUrl}/order-failed?error=Missing+CCAvenue+response`,
      };
    }

    const response = this.decryptAndParse(encResp);
    const orderNumber = response.order_id || response.merchant_param3;
    const trackingId = response.tracking_id;
    const orderStatus = response.order_status; // 'Success', 'Failure', 'Aborted'
    const failureMessage = response.failure_message || response.status_message || 'Payment transaction failed';
    const paymentMode = response.payment_mode;

    const query = [];
    if (orderNumber) query.push({ orderNumber });
    if (response.merchant_param1) query.push({ _id: response.merchant_param1 });

    const order = await Order.findOne({ $or: query });

    if (!order) {
      return {
        redirectUrl: `${frontendUrl}/order-failed?error=Order+not+found&trackingId=${encodeURIComponent(trackingId || '')}`,
        response,
      };
    }

    if (orderStatus === 'Success') {
      await this.markOrderAsPaid(order, {
        transactionId: trackingId,
        paymentMode,
        paymentDetails: response,
        timelineMessage: `Payment successful via CCAvenue (Tracking ID: ${trackingId})`,
      });

      return {
        status: 'Success',
        order,
        response,
        redirectUrl: `${frontendUrl}/order-success?orderId=${order._id}&orderNumber=${order.orderNumber}&trackingId=${encodeURIComponent(trackingId || '')}`,
      };
    } else {
      await this.markOrderAsFailed(order, {
        reason: failureMessage,
        paymentDetails: response,
        timelineMessage: `Payment failed via CCAvenue: ${failureMessage}`,
      });

      return {
        status: orderStatus || 'Failure',
        order,
        response,
        redirectUrl: `${frontendUrl}/order-failed?orderId=${order._id}&orderNumber=${order.orderNumber}&error=${encodeURIComponent(failureMessage)}`,
      };
    }
  }

  /**
   * Standard Handler for CCAvenue S2S Webhook
   */
  async handleWebhook({ encResp }) {
    return await this.handleResponse(encResp);
  }
}

module.exports = new CCAvenueService();
