const { getPasswordResetHtml } = require('./passwordReset.template');
const { getInvoiceEmailHtml } = require('./invoiceEmail.template');

module.exports = {
  getPasswordResetHtml,
  getInvoiceEmailHtml,
};
