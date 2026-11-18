const axios = require('axios');

class NetSmsProvider {
  async send({ to, message, templateId }) {
    const endpoint = process.env.NETSMS_API_URL;
    const apiKey = process.env.NETSMS_API_KEY;

    if (!apiKey) {
      console.log(`[NetSMS Dev Mode] To: ${to} | TemplateID: ${templateId} | Msg: ${message}`);
      return { success: true, simulated: true };
    }

    try {
      const response = await axios.get(endpoint, {
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
      console.error('[NetSMS Send Error]:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = NetSmsProvider;
