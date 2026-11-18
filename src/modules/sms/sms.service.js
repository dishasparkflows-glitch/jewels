const NetSmsProvider = require('./providers/netsms.provider');

const providers = {
  netsms: NetSmsProvider,
};

const applyVariables = (template, variables) =>
  String(template || '').replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
    const value = path.split('.').reduce((current, key) => current?.[key], variables);
    return value === undefined || value === null ? '' : String(value);
  });

class SmsService {
  // ------------------------------- get sms provider ----------------------------
  getProvider() {
    const providerName = (process.env.SMS_PROVIDER || 'netsms').trim().toLowerCase();
    const Provider = providers[providerName];
    if (!Provider) throw new Error('SMS provider "' + providerName + '" is not registered');
    return new Provider();
  }

  // ------------------------------- send sms ----------------------------
  async sendSms({ to, message, templateId, countryCode, variables }) {
    if (!to || !message || !templateId) {
      return { skipped: true, reason: 'Recipient, approved template, and message are required' };
    }
    return this.getProvider().send({ to, message, templateId, countryCode, variables });
  }

  // ------------------------------- send signup confirmation sms ----------------------------
  async sendSignupConfirmation(user) {
    const variables = {
      name: user.profile?.firstName || user.profile?.lastName || '',
      email: user.auth?.email || '',
    };
    const message = applyVariables(process.env.SMS_SIGNUP_MESSAGE, variables);
    return this.sendSms({
      to: user.profile?.phone,
      message,
      templateId: process.env.NETSMS_OTP_TEMPLATE_ID,
      variables,
    });
  }

  // ------------------------------- send order confirmation sms ----------------------------
  async sendOrderConfirmation(order) {
    const variables = {
      orderId: order.orderNumber || String(order._id || ''),
      amount: order.totalAmount ?? order.grandTotal ?? order.total ?? '',
    };
    const message = applyVariables(process.env.SMS_ORDER_MESSAGE, variables);
    return this.sendSms({
      to: order.customer?.phone || order.shippingAddress?.phone,
      message,
      templateId: process.env.NETSMS_OTP_TEMPLATE_ID,
      variables,
    });
  }

  // ------------------------------- send OTP sms ----------------------------
  async sendOtp({ to, otp, countryCode }) {
    const rawTemplate = process.env.NETSMS_OTP_TEMPLATE || 'Your OTP for verification is {#var#}. Valid for 5 minutes.';
    const message = rawTemplate.replace('{#var#}', String(otp));
    const templateId = process.env.NETSMS_OTP_TEMPLATE_ID;
    return this.sendSms({ to, message, templateId, countryCode });
  }
}

module.exports = new SmsService();
