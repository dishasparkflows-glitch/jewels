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
  async sendSms({ to, message, templateId, variables }) {
    if (!to || !message || !templateId) {
      return { skipped: true, reason: 'Recipient, approved template, and message are required' };
    }
    return this.getProvider().send({ to, message, templateId, variables });
  }

  // ------------------------------- send signup confirmation sms ----------------------------
  async sendSignupConfirmation(user) {
    const variables = {
      name: user.profile?.firstName || '',
      email: user.auth?.email || '',
    };
    const message = applyVariables(process.env.SMS_SIGNUP_MESSAGE, variables);
    return this.sendSms({
      to: user.profile?.phone,
      message,
      templateId: process.env.NETSMS_SIGNUP_TEMPLATE_ID,
      variables,
    });
  }

  // ------------------------------- send order confirmation sms ----------------------------
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

  // ------------------------------- send OTP sms ----------------------------
  async sendOtp({ to, otp }) {
    const rawTemplate = process.env.NETSMS_ORDER_OTP_TEMPLATE;
    const message = rawTemplate.replace('{#var#}', String(otp));
    const templateId = process.env.NETSMS_ORDER_OTP_TEMPLATE_ID;
    const apiKey = process.env.NETSMS_API_KEY;
    if (!apiKey) {
      console.log(`[SMS OTP Dev Mode] To: ${to} | OTP: ${otp} | Msg: ${message}`);
      return { success: true, simulated: true, otp };
    }

    try {
      const axios = require('axios');
      const response = await axios.get(process.env.NETSMS_API_URL, {
        params: {
          APIKey: apiKey,
          SenderID: process.env.NETSMS_SENDER_ID,
          SMSType: process.env.NETSMS_SMS_TYPE,
          Mobile: to,
          MsgText: message,
          EntityID: process.env.NETSMS_ENTITY_ID,
          TemplateID: templateId,
        },
        timeout: 10000,
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('[SMS OTP Error]:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SmsService();
