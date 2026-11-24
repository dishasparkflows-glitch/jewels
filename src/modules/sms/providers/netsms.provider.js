const axios = require('axios');
const { NETSMS } = require('../../../config/constants');

class NetSmsProvider {
  async send({ to, message, templateId }) {
    const endpoint = NETSMS.API_URL;
    const apiKey = NETSMS.API_KEY;

    if (!apiKey) {
      console.log(`[NetSMS Dev Mode] To: ${to} | TemplateID: ${templateId} | Msg: ${message}`);
      return { success: true, simulated: true };
    }

    try {
      const response = await axios.get(endpoint, {
        params: {
          APIKey: apiKey,
          SenderID: NETSMS.SENDER_ID,
          SMSType: NETSMS.SMS_TYPE,
          Mobile: to,
          MsgText: message,
          EntityID: NETSMS.ENTITY_ID,
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
