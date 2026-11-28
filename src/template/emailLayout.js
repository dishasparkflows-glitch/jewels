const EMAIL_ASSETS = require('../assets/email/assets-manifest.json');
const { escapeHtml } = require('../utils/string');

function sanitizeEmailUrl(rawUrl, fallback = '#') {
  const str = String(rawUrl || '').trim();
  if (!str) return fallback;
  try {
    const parsed = new URL(str);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // fallback if relative or malformed URL
  }
  return fallback;
}

function resolveBrandContact({ setting, storeName, defaultEmail = 'support@jewels.in' } = {}) {
  const bDetails = setting?.businessDetails || {};
  const companyName = storeName || bDetails.companyName || 'Jewels';
  const mobileNumber = bDetails.mobileNumber || '+91 84600 91955';
  const emailAddress = bDetails.emailAddress || defaultEmail;

  let website = 'www.jewels.in';
  if (emailAddress && emailAddress.includes('@')) {
    const domain = emailAddress.split('@')[1];
    if (domain && domain.includes('.')) {
      website = domain.startsWith('www.') ? domain : `www.${domain}`;
    }
  }

  const cleanPhone = String(mobileNumber).replace(/[^\d+]/g, '');
  const webUrl = sanitizeEmailUrl(website.startsWith('http') ? website : `https://${website}`, 'https://www.jewels.in');

  return {
    companyName,
    mobileNumber,
    emailAddress,
    website,
    cleanPhone,
    webUrl,
  };
}

/**
 * Shared branded HTML email wrapper used across all transactional templates.
 * All metadata/brand fields are HTML-escaped cleanly; `bodyHtml` should contain pre-escaped values.
 */
function renderEmailLayout({
  title,
  badgeUrl,
  badgeAlt = '',
  headingHtml,
  bodyHtml,
  setting,
  storeName,
  defaultEmail = 'support@jewels.in',
}) {
  const brand = resolveBrandContact({ setting, storeName, defaultEmail });
  const currentYear = new Date().getFullYear();

  const safeTitle = escapeHtml(title);
  const safeCompany = escapeHtml(brand.companyName);
  const safePhone = escapeHtml(brand.mobileNumber);
  const safeCleanPhone = escapeHtml(brand.cleanPhone);
  const safeEmail = escapeHtml(brand.emailAddress);
  const safeWebsite = escapeHtml(brand.website);
  const safeWebUrl = escapeHtml(brand.webUrl);
  const safeBadgeUrl = escapeHtml(sanitizeEmailUrl(badgeUrl, ''));
  const safeBadgeAlt = escapeHtml(badgeAlt);

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF5EF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF5EF; padding: 32px 14px; margin: 0;">
    <tr>
      <td align="center" valign="top">

        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #FFFDFB; border-radius: 16px; border: 1px solid #EFE4D6; box-shadow: 0 4px 20px rgba(138, 94, 53, 0.05); overflow: hidden;">
          <tr>
            <td style="padding: 32px 26px 26px; text-align: center;">

              <!-- Top Badge with Sparkles -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 14px;">
                <tr>
                  <td align="center" valign="middle">
                    <img src="${safeBadgeUrl}" width="90" height="90" alt="${safeBadgeAlt}" style="display: block; width: 90px; height: 90px; border: 0; margin: 0 auto;" />
                  </td>
                </tr>
              </table>

              <!-- Main Heading -->
              <h1 style="margin: 0 0 14px; font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 600; color: #2E1E14; letter-spacing: 0.2px;">
                ${headingHtml}
              </h1>

              ${bodyHtml}

              <!-- Divider with Center Diamond -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 16px;">
                <tr>
                  <td width="45%" style="border-bottom: 1px solid #EFE4D6;"></td>
                  <td width="10%" align="center" style="padding: 0 6px;">
                    <img src="${escapeHtml(EMAIL_ASSETS['diamond-icon'])}" width="14" height="14" alt="Diamond" style="display: block; width: 14px; height: 14px; border: 0; margin: 0 auto;" />
                  </td>
                  <td width="45%" style="border-bottom: 1px solid #EFE4D6;"></td>
                </tr>
              </table>

              <!-- Contact Information Row (Phone, Email, Website) -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 14px;">
                <tr>
                  <td style="padding: 0 7px;" valign="middle">
                    <a href="tel:${safeCleanPhone}" style="text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #5C4B3E; white-space: nowrap; display: inline-block;">
                      <img src="${escapeHtml(EMAIL_ASSETS['phone-icon'])}" width="11" height="11" alt="Phone" style="display: inline-block; vertical-align: -1px; margin-right: 3px; border: 0;" />
                      ${safePhone}
                    </a>
                  </td>
                  <td style="color: #D8C8B6; font-size: 11px; padding: 0 2px;" valign="middle">|</td>
                  <td style="padding: 0 7px;" valign="middle">
                    <a href="mailto:${safeEmail}" style="text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #5C4B3E; white-space: nowrap; display: inline-block;">
                      <img src="${escapeHtml(EMAIL_ASSETS['email-icon'])}" width="11" height="11" alt="Email" style="display: inline-block; vertical-align: -1px; margin-right: 3px; border: 0;" />
                      ${safeEmail}
                    </a>
                  </td>
                  <td style="color: #D8C8B6; font-size: 11px; padding: 0 2px;" valign="middle">|</td>
                  <td style="padding: 0 7px;" valign="middle">
                    <a href="${safeWebUrl}" target="_blank" style="text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #5C4B3E; white-space: nowrap; display: inline-block;">
                      <img src="${escapeHtml(EMAIL_ASSETS['globe-icon'])}" width="11" height="11" alt="Website" style="display: inline-block; vertical-align: -1px; margin-right: 3px; border: 0;" />
                      ${safeWebsite}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Copyright Footer Line -->
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 10px; color: #8A7869; margin: 0;">
                © ${currentYear} ${safeCompany} Jewels Private Limited. All rights reserved.
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
  EMAIL_ASSETS,
  sanitizeEmailUrl,
  resolveBrandContact,
  renderEmailLayout,
};
