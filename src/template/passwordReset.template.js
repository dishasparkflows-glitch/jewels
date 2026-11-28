const { EMAIL_ASSETS, renderEmailLayout, resolveBrandContact, sanitizeEmailUrl } = require('./emailLayout');
const { escapeHtml } = require('../utils/string');

/**
 * Generates branded luxury HTML email for Password Reset Request
 * Uses shared EMAIL_ASSETS from assets-manifest.json and renderEmailLayout.
 *
 * @param {Object} params
 * @param {string} params.resetUrl Password reset link with token
 * @param {Object} [params.setting] Settings document from setting.model.js
 * @param {string} [params.storeName] Override store/company name
 * @param {string} [params.expiresIn] Expiration duration text (default: '1 hour')
 * @returns {string} HTML string
 */
function getPasswordResetHtml({ resetUrl, setting, storeName, expiresIn = '1 hour' }) {
  const brand = resolveBrandContact({ setting, storeName, defaultEmail: 'support@jewels.in' });
  const safeCompany = escapeHtml(brand.companyName);
  const safeResetUrl = escapeHtml(sanitizeEmailUrl(resetUrl, '#'));
  const safeExpiresIn = escapeHtml(expiresIn);

  const bodyHtml = `
              <!-- Intro Description -->
              <p style="margin: 0 0 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #4A3C31;">
                We received a request to reset your account password for <strong>${safeCompany}</strong>.
              </p>

              <!-- Reset Button -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 18px;">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #724B2C;">
                    <a href="${safeResetUrl}" target="_blank" style="background-color: #724B2C; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12.5px; font-weight: 600; text-decoration: none; padding: 10px 24px; border-radius: 6px; display: inline-block; letter-spacing: 0.2px;">
                      Reset Your Password &nbsp;→
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry Warning Box with Clock Icon -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF5ED; border: 1px solid #ECE1D3; border-radius: 8px; margin: 0 0 18px;">
                <tr>
                  <td style="padding: 10px 14px; text-align: left;">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td valign="middle" style="padding-right: 10px; width: 20px;">
                          <img src="${escapeHtml(EMAIL_ASSETS['clock-icon'])}" width="18" height="18" alt="Clock" style="display: block; width: 18px; height: 18px; border: 0;" />
                        </td>
                        <td valign="middle">
                          <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11.5px; line-height: 1.5; color: #5C4B3E;">
                            This reset link will expire in <strong>${safeExpiresIn}</strong>. If you didn’t request a password reset, you can safely ignore this email.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;

  return renderEmailLayout({
    title: `Reset Your Password - ${brand.companyName}`,
    badgeUrl: EMAIL_ASSETS['pwd-reset-badge'],
    badgeAlt: 'Reset Password',
    headingHtml: 'Password Reset Request',
    bodyHtml,
    setting,
    storeName,
    defaultEmail: 'support@jewels.in',
  });
}

module.exports = {
  getPasswordResetHtml,
};
