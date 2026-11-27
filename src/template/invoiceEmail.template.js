const { EMAIL_ASSETS, renderEmailLayout, resolveBrandContact, sanitizeEmailUrl } = require('./emailLayout');
const { formatCurrency } = require('../utils/templateFormatters');
const { escapeHtml } = require('../utils/string');

/**
 * Generates branded luxury HTML email for Tax Invoice
 * Uses shared EMAIL_ASSETS from assets-manifest.json and renderEmailLayout.
 *
 * @param {Object} params
 * @param {Object} params.order Order document from database
 * @param {Object} [params.setting] Settings document from setting.model.js
 * @param {string} [params.invoiceUrl] Download URL or web portal link
 * @returns {string} HTML string
 */
function getInvoiceEmailHtml({ order, setting, invoiceUrl }) {
  const brand = resolveBrandContact({ setting, defaultEmail: 'info@neirah.in' });
  const orderNumber = order?.orderNumber || 'RJ/ORD-0003';
  const customerName =
    order?.shippingAddress?.fullName ||
    order?.user?.name ||
    order?.customerName ||
    'Valued Customer';

  const totalAmount = order?.pricing?.total ?? order?.totalAmount ?? 0;
  const totalFormatted = formatCurrency(totalAmount);

  const orderId = order?._id || order?.id || orderNumber;
  const downloadUrl = sanitizeEmailUrl(
    invoiceUrl || `${brand.webUrl}/profile?orderId=${encodeURIComponent(String(orderId))}`,
    brand.webUrl
  );

  const safeCompany = escapeHtml(brand.companyName);
  const safeCustomerName = escapeHtml(customerName);
  const safeOrderNumber = escapeHtml(orderNumber);
  const safeTotal = escapeHtml(totalFormatted);
  const safeDownloadUrl = escapeHtml(downloadUrl);

  const bodyHtml = `
              <!-- Greeting & Intro Text -->
              <div style="text-align: left; margin: 0 0 16px;">
                <p style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 700; color: #1F140E;">
                  Dear ${safeCustomerName},
                </p>
                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12.5px; line-height: 1.5; color: #4A3C31;">
                  Thank you for shopping with <strong>${safeCompany}</strong>. Your official tax invoice for <strong>Order #${safeOrderNumber}</strong> has been generated and attached to this email as a PDF.
                </p>
              </div>

              <!-- Order Information Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF5ED; border: 1px solid #ECE1D3; border-radius: 8px; margin: 0 0 16px;">
                <tr>
                  <td width="50%" style="padding: 9px 14px; text-align: left;">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td valign="middle" style="padding-right: 10px; width: 22px;">
                          <img src="${escapeHtml(EMAIL_ASSETS['box-icon'])}" width="20" height="20" alt="Order" style="display: block; width: 20px; height: 20px; border: 0;" />
                        </td>
                        <td valign="middle">
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 10px; color: #8A7869; margin-bottom: 1px;">Order Number</div>
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12.5px; font-weight: 700; color: #1F140E;">#${safeOrderNumber}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="1" style="background-color: #E5D8CA;"></td>
                  <td width="50%" style="padding: 9px 14px; text-align: left;">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td valign="middle" style="padding-right: 10px; width: 22px;">
                          <img src="${escapeHtml(EMAIL_ASSETS['coins-icon'])}" width="20" height="20" alt="Total" style="display: block; width: 20px; height: 20px; border: 0;" />
                        </td>
                        <td valign="middle">
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 10px; color: #8A7869; margin-bottom: 1px;">Order Total</div>
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12.5px; font-weight: 700; color: #1F140E;">Rs. ${safeTotal}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Download Invoice Button -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 14px;">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #5C3524;">
                    <a href="${safeDownloadUrl}" target="_blank" style="background-color: #5C3524; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 600; text-decoration: none; padding: 9px 22px; border-radius: 6px; display: inline-block; letter-spacing: 0.2px;">
                      Download Invoice (PDF)
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Help / Question Text -->
              <p style="margin: 0 0 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11.5px; color: #7A695C; text-align: center;">
                If you have any questions, feel free to contact our support team.
              </p>`;

  return renderEmailLayout({
    title: `Tax Invoice - ${orderNumber}`,
    badgeUrl: EMAIL_ASSETS['invoice-doc-badge'],
    badgeAlt: 'Invoice Ready',
    headingHtml: 'Your Tax Invoice is Ready &nbsp;✨',
    bodyHtml,
    setting,
    defaultEmail: 'info@neirah.in',
  });
}

module.exports = {
  getInvoiceEmailHtml,
};
