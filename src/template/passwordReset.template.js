/**
 * Password Reset Email Template
 *
 * @param {Object} options
 * @param {string} options.resetUrl - Full password reset URL with token
 * @param {string} [options.storeName='Jai Shree Krishna Fab'] - Store name
 * @param {string} [options.expiresIn='1 hour'] - Expiry duration text
 * @returns {string} Compiled HTML string
 */
function getPasswordResetHtml({ resetUrl, storeName = 'Jai Shree Krishna Fab', expiresIn = '1 hour' }) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #8b6f4e; margin-top: 0;">Password Reset Request</h2>
      <p>We received a request to reset your account password for <strong>${storeName}</strong>.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="background-color: #8b6f4e; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Reset Your Password
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #888; font-size: 12px; margin-bottom: 0;">This reset link will expire in ${expiresIn}. If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
  `.trim();
}

module.exports = {
  getPasswordResetHtml,
};

