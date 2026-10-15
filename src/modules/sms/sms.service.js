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
  getProvider() {
    const providerName = (process.env.SMS_PROVIDER || 'netsms').trim().toLowerCase();
    const Provider = providers[providerName];
    if (!Provider) throw new Error('SMS provider "' + providerName + '" is not registered');
    return new Provider();
  }

  async sendSms({ to, message, templateId, variables }) {
    if (!to || !message || !templateId) {
      return { skipped: true, reason: 'Recipient, approved template, and message are required' };
    }
    return this.getProvider().send({ to, message, templateId, variables });
  }

  async sendSignupConfirmation(user) {
    const variables = {
      name: user.profile?.firstName || '',
      email: user.auth?.email || user.email || '',
    };
    const message = applyVariables(process.env.SMS_SIGNUP_MESSAGE, variables);
    return this.sendSms({
      to: user.profile?.phone || user.phone,
      message,
      templateId: process.env.NETSMS_SIGNUP_TEMPLATE_ID,
      variables,
    });
  }

  async sendOrderConfirmation(order) {
    const variables = {
      orderId: order.orderNumber || order.orderId || String(order._id || ''),
      amount: order.totalAmount ?? order.grandTotal ?? order.total ?? '',
    };
    const message = applyVariables(process.env.SMS_ORDER_MESSAGE, variables);
    return this.sendSms({
      to: order.phone || order.customer?.phone || order.shippingAddress?.phone,
      message,
      templateId: process.env.NETSMS_ORDER_TEMPLATE_ID,
      variables,
    });
  }
}

module.exports = new SmsService();
