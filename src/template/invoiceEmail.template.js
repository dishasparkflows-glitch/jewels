/**
 * Generates branded luxury HTML email for Tax Invoice
 * Matches Neirah's exact reference design (media_1794918111341_fd6dfe98.jpg)
 * Uses high-res hosted PNG assets for 100% reliability in Gmail, Outlook & iOS Mail.
 *
 * @param {Object} params
 * @param {Object} params.order Order document from database
 * @param {Object} [params.setting] Settings document from setting.model.js
 * @param {string} [params.invoiceUrl] Download URL or web portal link
 * @returns {string} HTML string
 */
function getInvoiceEmailHtml({ order, setting, invoiceUrl }) {
  const bDetails = setting?.businessDetails || {};
  const companyName = bDetails.companyName || 'Neirah';
  const mobileNumber = bDetails.mobileNumber || '+91 84600 91955';
  const emailAddress = bDetails.emailAddress || 'info@neirah.in';

  let website = 'www.neirah.in';
  if (emailAddress && emailAddress.includes('@')) {
    const domain = emailAddress.split('@')[1];
    if (domain && domain.includes('.')) {
      website = domain.startsWith('www.') ? domain : `www.${domain}`;
    }
  }

  const cleanPhone = mobileNumber.replace(/\s+/g, '');

  const orderNumber = order?.orderNumber || 'RJ/ORD-0003';
  const customerName =
    order?.shippingAddress?.fullName ||
    order?.user?.name ||
    order?.customerName ||
    'Valued Customer';

  const totalAmount = order?.pricing?.total ?? order?.totalAmount ?? 0;
  const totalFormatted = Number(totalAmount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const webUrl = website.startsWith('http') ? website : `https://${website}`;
  const orderId = order?._id || order?.id || orderNumber;
  const downloadUrl = invoiceUrl || `${webUrl}/profile?orderId=${orderId}`;
  const currentYear = new Date().getFullYear();

  // Hosted PNG assets (R2 public CDN) for flawless rendering in Gmail
  const ASSETS = {
    badge: 'https://pub-82427c7fd20e4acaa4bdb3b933c0a3bf.r2.dev/email-assets/1794920018744-invoice-doc-badge.png',
    box: 'https://pub-82427c7fd20e4acaa4bdb3b933c0a3bf.r2.dev/email-assets/1794920032176-box-icon.png',
    coins: 'https://pub-82427c7fd20e4acaa4bdb3b933c0a3bf.r2.dev/email-assets/1794920034472-coins-icon.png',
    diamond: 'https://pub-82427c7fd20e4acaa4bdb3b933c0a3bf.r2.dev/email-assets/1794920022976-diamond-icon.png',
    phone: 'https://pub-82427c7fd20e4acaa4bdb3b933c0a3bf.r2.dev/email-assets/1794920025319-phone-icon.png',
    email: 'https://pub-82427c7fd20e4acaa4bdb3b933c0a3bf.r2.dev/email-assets/1794920027588-email-icon.png',
    globe: 'https://pub-82427c7fd20e4acaa4bdb3b933c0a3bf.r2.dev/email-assets/1794920030094-globe-icon.png',
  };

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tax Invoice - ${orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF5EF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF5EF; padding: 32px 14px; margin: 0;">
    <tr>
      <td align="center" valign="top">
        
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #FFFDFB; border-radius: 16px; border: 1px solid #EFE4D6; box-shadow: 0 4px 20px rgba(138, 94, 53, 0.05); overflow: hidden;">
          <tr>
            <td style="padding: 32px 26px 26px; text-align: center;">
              
              <!-- 1. Top Document Badge with Sparkles -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 14px;">
                <tr>
                  <td align="center" valign="middle">
                    <img src="${ASSETS.badge}" width="90" height="90" alt="Invoice Ready" style="display: block; width: 90px; height: 90px; border: 0; margin: 0 auto;" />
                  </td>
                </tr>
              </table>

              <!-- 2. Main Heading -->
              <h1 style="margin: 0 0 16px; font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 600; color: #2E1E14; letter-spacing: 0.2px;">
                Your Tax Invoice is Ready &nbsp;✨
              </h1>

              <!-- 3. Greeting & Intro Text -->
              <div style="text-align: left; margin: 0 0 16px;">
                <p style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 700; color: #1F140E;">
                  Dear ${customerName},
                </p>
                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12.5px; line-height: 1.5; color: #4A3C31;">
                  Thank you for shopping with <strong>${companyName}</strong>. Your official tax invoice for <strong>Order #${orderNumber}</strong> has been generated and attached to this email as a PDF.
                </p>
              </div>

              <!-- 4. Order Information Box (Slim Compact 2 Columns) -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF5ED; border: 1px solid #ECE1D3; border-radius: 8px; margin: 0 0 16px;">
                <tr>
                  <!-- Left: Order Number -->
                  <td width="50%" style="padding: 9px 14px; text-align: left;">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td valign="middle" style="padding-right: 10px; width: 22px;">
                          <img src="${ASSETS.box}" width="20" height="20" alt="Order" style="display: block; width: 20px; height: 20px; border: 0;" />
                        </td>
                        <td valign="middle">
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 10px; color: #8A7869; margin-bottom: 1px;">Order Number</div>
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12.5px; font-weight: 700; color: #1F140E;">#${orderNumber}</div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Subtle Divider -->
                  <td width="1" style="background-color: #E5D8CA;"></td>

                  <!-- Right: Order Total -->
                  <td width="50%" style="padding: 9px 14px; text-align: left;">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td valign="middle" style="padding-right: 10px; width: 22px;">
                          <img src="${ASSETS.coins}" width="20" height="20" alt="Total" style="display: block; width: 20px; height: 20px; border: 0;" />
                        </td>
                        <td valign="middle">
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 10px; color: #8A7869; margin-bottom: 1px;">Order Total</div>
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12.5px; font-weight: 700; color: #1F140E;">Rs. ${totalFormatted}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- 5. Download Invoice Button (Compact & Sleek) -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 14px;">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #5C3524;">
                    <a href="${downloadUrl}" target="_blank" style="background-color: #5C3524; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 600; text-decoration: none; padding: 9px 22px; border-radius: 6px; display: inline-block; letter-spacing: 0.2px;">
                      Download Invoice (PDF)
                    </a>
                  </td>
                </tr>
              </table>

              <!-- 6. Help / Question Text -->
              <p style="margin: 0 0 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11.5px; color: #7A695C; text-align: center;">
                If you have any questions, feel free to contact our support team.
              </p>

              <!-- 7. Divider with Center Diamond -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 16px;">
                <tr>
                  <td width="45%" style="border-bottom: 1px solid #EFE4D6;"></td>
                  <td width="10%" align="center" style="padding: 0 6px;">
                    <img src="${ASSETS.diamond}" width="14" height="14" alt="Diamond" style="display: block; width: 14px; height: 14px; border: 0; margin: 0 auto;" />
                  </td>
                  <td width="45%" style="border-bottom: 1px solid #EFE4D6;"></td>
                </tr>
              </table>

              <!-- 8. Contact Information Row (Phone, Email, Website) -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 14px;">
                <tr>
                  <!-- Phone -->
                  <td style="padding: 0 7px;" valign="middle">
                    <a href="tel:${cleanPhone}" style="text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #5C4B3E; white-space: nowrap; display: inline-block;">
                      <img src="${ASSETS.phone}" width="11" height="11" alt="Phone" style="display: inline-block; vertical-align: -1px; margin-right: 3px; border: 0;" />
                      ${mobileNumber}
                    </a>
                  </td>

                  <!-- Pipe -->
                  <td style="color: #D8C8B6; font-size: 11px; padding: 0 2px;" valign="middle">|</td>

                  <!-- Email -->
                  <td style="padding: 0 7px;" valign="middle">
                    <a href="mailto:${emailAddress}" style="text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #5C4B3E; white-space: nowrap; display: inline-block;">
                      <img src="${ASSETS.email}" width="11" height="11" alt="Email" style="display: inline-block; vertical-align: -1px; margin-right: 3px; border: 0;" />
                      ${emailAddress}
                    </a>
                  </td>

                  <!-- Pipe -->
                  <td style="color: #D8C8B6; font-size: 11px; padding: 0 2px;" valign="middle">|</td>

                  <!-- Website -->
                  <td style="padding: 0 7px;" valign="middle">
                    <a href="${webUrl}" target="_blank" style="text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #5C4B3E; white-space: nowrap; display: inline-block;">
                      <img src="${ASSETS.globe}" width="11" height="11" alt="Website" style="display: inline-block; vertical-align: -1px; margin-right: 3px; border: 0;" />
                      ${website}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- 9. Copyright Footer Line -->
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 10px; color: #8A7869; margin: 0;">
                © ${currentYear} ${companyName} Jewels Private Limited. All rights reserved.
              </div>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

module.exports = {
  getInvoiceEmailHtml,
};
