/**
 * Password Reset Email Template
 *
 * @param {Object} options
 * @param {string} options.resetUrl - Full password reset URL with token
 * @param {string} [options.storeName='Neirah'] - Store name
 * @param {string} [options.expiresIn='1 hour'] - Expiry duration text
 * @returns {string} Compiled HTML string
 */
function getPasswordResetHtml({ resetUrl, storeName = 'Neirah', expiresIn = '1 hour' }) {
  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password - ${storeName}</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse:collapse;border-spacing:0;margin:0;}
    div, td {padding:0;}
    div {margin:0 !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #faf6f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #faf6f0; min-height: 100vh; padding: 40px 16px;">
    <tr>
      <td align="center" valign="top">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border: 1px solid #ede4d8; border-radius: 20px; box-shadow: 0 8px 30px rgba(139, 111, 78, 0.06); overflow: hidden;">
          <tr>
            <td style="padding: 44px 36px 40px 36px; text-align: center;">
              
              <!-- Brand Title -->
              <h1 style="margin: 0; font-family: 'Playfair Display', Didot, 'Bodoni MT', Georgia, serif; font-size: 26px; font-weight: 500; color: #30261c; letter-spacing: 2.5px; text-transform: uppercase;">
                ${storeName}
              </h1>
              <p style="margin: 4px 0 0 0; font-family: 'Playfair Display', Georgia, serif; font-size: 11px; font-style: italic; letter-spacing: 1.5px; color: #9c7c58; text-transform: uppercase;">
                Fine Jewellery
              </p>

              <!-- Top Decorative Floral Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 18px 0 24px 0;">
                <tr>
                  <td style="border-bottom: 1px solid #ebd9c8; vertical-align: middle;"></td>
                  <td style="width: 36px; text-align: center; vertical-align: middle; padding: 0 10px;">
                    <!-- Floral Motif Icon -->
                    <svg width="22" height="15" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C10.5 5.5 7.5 8 2 8C7.5 8 10.5 10.5 12 14C13.5 10.5 16.5 8 22 8C16.5 8 13.5 5.5 12 2Z" fill="#9c7c58" fill-opacity="0.25" stroke="#9c7c58" stroke-width="1.2" />
                      <circle cx="12" cy="8" r="2" fill="#9c7c58" />
                    </svg>
                  </td>
                  <td style="border-bottom: 1px solid #ebd9c8; vertical-align: middle;"></td>
                </tr>
              </table>

              <!-- Lock Badge with Rays Illustration -->
              <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" style="margin: 6px auto 20px auto;">
                <tr>
                  <td align="center" valign="middle">
                    <div style="position: relative; display: inline-block;">
                      <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center" valign="middle" style="width: 76px; height: 76px; background-color: #f7efe4; border-radius: 50%; text-align: center; border: 1px solid #ecdcc8;">
                            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8b6f4e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display: block; margin: 0 auto;">
                              <rect x="5" y="11" width="14" height="10" rx="2" ry="2"></rect>
                              <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
                              <circle cx="12" cy="15.5" r="1.3" fill="#8b6f4e"></circle>
                              <path d="M12 17v1.5"></path>
                            </svg>
                          </td>
                          <!-- Subtle Sunburst Sparkles at top-right -->
                          <td valign="top" style="padding-left: 6px; padding-top: 2px;">
                            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="#a38258" stroke-width="1.8" stroke-linecap="round">
                              <line x1="2" y1="14" x2="8" y2="8" />
                              <line x1="14" y1="2" x2="9" y2="7" />
                              <line x1="14" y1="10" x2="10" y2="9" />
                            </svg>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Main Heading -->
              <h2 style="margin: 0 0 14px 0; font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 600; color: #22201d; letter-spacing: -0.2px;">
                Password Reset Request
              </h2>

              <!-- Description -->
              <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.6; color: #534c44; max-width: 460px; margin-left: auto; margin-right: auto;">
                We received a request to reset your account password for <strong style="color: #22201d; font-weight: 600;">${storeName}</strong>.
              </p>

              <!-- Call-to-action Button -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 30px auto;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #8b6f4e;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${resetUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="18%" strokecolor="#8b6f4e" fillcolor="#8b6f4e">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Reset Your Password</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-- -->
                    <a href="${resetUrl}" target="_blank" style="background-color: #8b6f4e; color: #ffffff; display: inline-block; font-size: 15px; font-weight: 600; letter-spacing: 0.3px; padding: 14px 36px; text-decoration: none; border-radius: 10px; border: 1px solid #7d6243; box-shadow: 0 4px 14px rgba(139, 111, 78, 0.28);">
                      Reset Your Password
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Bottom Decorative Floral Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 10px 0 24px 0;">
                <tr>
                  <td style="border-bottom: 1px solid #ebd9c8; vertical-align: middle;"></td>
                  <td style="width: 36px; text-align: center; vertical-align: middle; padding: 0 10px;">
                    <svg width="22" height="15" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C10.5 5.5 7.5 8 2 8C7.5 8 10.5 10.5 12 14C13.5 10.5 16.5 8 22 8C16.5 8 13.5 5.5 12 2Z" fill="#9c7c58" fill-opacity="0.25" stroke="#9c7c58" stroke-width="1.2" />
                      <circle cx="12" cy="8" r="2" fill="#9c7c58" />
                    </svg>
                  </td>
                  <td style="border-bottom: 1px solid #ebd9c8; vertical-align: middle;"></td>
                </tr>
              </table>

              <!-- Footer Expiry Note -->
              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #7f7870; max-width: 440px; margin-left: auto; margin-right: auto;">
                This reset link will expire in ${expiresIn}. If you didn’t request a password reset, you can safely ignore this email.
              </p>

            </td>
          </tr>
        </table>

        <!-- Micro Footer / Copyright -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; margin-top: 18px;">
          <tr>
            <td align="center" style="font-size: 12px; color: #a49b8f;">
              © ${new Date().getFullYear()} ${storeName}. All rights reserved.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

module.exports = {
  getPasswordResetHtml,
};
