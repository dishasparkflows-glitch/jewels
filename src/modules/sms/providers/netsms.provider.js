const axios = require('axios');

const interpolate = (value, context) => {
  if (Array.isArray(value)) return value.map((item) => interpolate(item, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item, context)]));
  }
  if (typeof value !== 'string') return value;

  const exactMatch = value.match(/^\{\{([\w.]+)\}\}$/);
  if (exactMatch) {
    return exactMatch[1].split('.').reduce((result, key) => result?.[key], context) ?? '';
  }
  return value.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
    const result = path.split('.').reduce((current, key) => current?.[key], context);
    return result === undefined || result === null ? '' : String(result);
  });
};

class NetSmsProvider {
  async send({ to, message, templateId, variables = {} }) {
    const endpoint = process.env.NETSMS_API_URL;
    const requestTemplate = process.env.NETSMS_REQUEST_TEMPLATE_JSON;
    if (!endpoint || !requestTemplate) {
      return { skipped: true, reason: 'NetSMS endpoint and request template are not configured' };
    }

    let bodyTemplate;
    let headers = {};
    try {
      bodyTemplate = JSON.parse(requestTemplate);
      if (process.env.NETSMS_HEADERS_JSON) {
        headers = JSON.parse(process.env.NETSMS_HEADERS_JSON);
      }
    } catch {
      throw new Error('NetSMS request template or headers are invalid JSON');
    }

    const context = {
      to,
      message,
      templateId,
      senderId: process.env.NETSMS_SENDER_ID || '',
      apiKey: process.env.NETSMS_API_KEY || '',
      variables,
    };
    const method = (process.env.NETSMS_HTTP_METHOD || 'POST').toUpperCase();
    const response = await axios.request({
      url: endpoint,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      ...(method === 'GET' ? { params: interpolate(bodyTemplate, context) } : { data: interpolate(bodyTemplate, context) }),
      timeout: 10000,
    });

    return response.data;
  }
}

module.exports = NetSmsProvider;
