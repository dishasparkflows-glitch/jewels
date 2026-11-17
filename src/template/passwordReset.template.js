/**
 * Generates branded luxury HTML email for Password Reset Request
 * Matches Neirah's exact reference design (media_1794919454833_a949c163.jpg)
 * Uses high-res hosted PNG assets for 100% reliability in Gmail, Outlook & iOS Mail.
 *
 * @param {Object} params
 * @param {string} params.resetUrl Password reset link with token
 * @param {Object} [params.setting] Settings document from setting.model.js
 * @param {string} [params.storeName] Override store/company name
 * @param {string} [params.expiresIn] Expiration duration text (default: '1 hour')
 * @returns {string} HTML string
 */
function getPasswordResetHtml({ resetUrl, setting, storeName, expiresIn = '1 hour' }) {
  const bDetails = setting?.businessDetails || {};
  const companyName = storeName || bDetails.companyName || 'Neirah';
  const mobileNumber = bDetails.mobileNumber || '+91 84600 91955';
  const emailAddress = bDetails.emailAddress || 'support@neirah.in';

  let website = 'www.neirah.in';
  if (emailAddress && emailAddress.includes('@')) {
    const domain = emailAddress.split('@')[1];
    if (domain && domain.includes('.')) {
      website = domain.startsWith('www.') ? domain : `www.${domain}`;
    }
  }

  const cleanPhone = mobileNumber.replace(/\s+/g, '');
  const webUrl = website.startsWith('http') ? website : `https://${website}`;
  const currentYear = new Date().getFullYear();

  // Hosted PNG assets (R2 public CDN) for flawless rendering in Gmail
  const ASSETS = {
    badge: 'https://pub-82427c7fd20e4acaa4bdb3b933c0a3bf.r2.dev/email-assets/1794920016427-pwd-reset-badge.png',
    clock: 'https://pub-82427c7fd20e4acaa4bdb3b933c0a3bf.r2.dev/email-assets/1794920021094-clock-icon.png',
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
  <title>Reset Your Password - ${companyName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF5EF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF5EF; padding: 32px 14px; margin: 0;">
    <tr>
      <td align="center" valign="top">
        
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #FFFDFB; border-radius: 16px; border: 1px solid #EFE4D6; box-shadow: 0 4px 20px rgba(138, 94, 53, 0.05); overflow: hidden;">
          <tr>
            <td style="padding: 32px 26px 26px; text-align: center;">
              
              <!-- 1. Top Lock Badge with Sparkles -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 14px;">
                <tr>
                  <td align="center" valign="middle">
                    <img src="${ASSETS.badge}" width="90" height="90" alt="Reset Password" style="display: block; width: 90px; height: 90px; border: 0; margin: 0 auto;" />
                  </td>
                </tr>
              </table>

              <!-- 2. Main Heading -->
              <h1 style="margin: 0 0 12px; font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 600; color: #2E1E14; letter-spacing: 0.1px;">
                Password Reset Request
              </h1>

              <!-- 3. Intro Description -->
              <p style="margin: 0 0 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #4A3C31;">
                We received a request to reset your account password for <strong>${companyName}</strong>.
              </p>

              <!-- 4. Reset Button (Compact & Sleek) -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 18px;">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #724B2C;">
                    <a href="${resetUrl}" target="_blank" style="background-color: #724B2C; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12.5px; font-weight: 600; text-decoration: none; padding: 10px 24px; border-radius: 6px; display: inline-block; letter-spacing: 0.2px;">
                      Reset Your Password &nbsp;→
                    </a>
                  </td>
                </tr>
              </table>

              <!-- 5. Expiry Warning Box with Clock Icon -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF5ED; border: 1px solid #ECE1D3; border-radius: 8px; margin: 0 0 18px;">
                <tr>
                  <td style="padding: 10px 14px; text-align: left;">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td valign="middle" style="padding-right: 10px; width: 20px;">
                          <img src="${ASSETS.clock}" width="18" height="18" alt="Clock" style="display: block; width: 18px; height: 18px; border: 0;" />
                        </td>
                        <td valign="middle">
                          <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11.5px; line-height: 1.5; color: #5C4B3E;">
                            This reset link will expire in <strong>${expiresIn}</strong>. If you didn’t request a password reset, you can safely ignore this email.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- 6. Divider with Center Diamond -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 16px;">
                <tr>
                  <td width="45%" style="border-bottom: 1px solid #EFE4D6;"></td>
                  <td width="10%" align="center" style="padding: 0 6px;">
                    <img src="${ASSETS.diamond}" width="14" height="14" alt="Diamond" style="display: block; width: 14px; height: 14px; border: 0; margin: 0 auto;" />
                  </td>
                  <td width="45%" style="border-bottom: 1px solid #EFE4D6;"></td>
                </tr>
              </table>

              <!-- 7. Contact Information Row (Phone, Email, Website) -->
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

              <!-- 8. Copyright Footer Line -->
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
  getPasswordResetHtml,
};
