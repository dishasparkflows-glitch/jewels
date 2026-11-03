const nodemailer = require('nodemailer');

/**
 * Resolve active SMTP settings from environment variables
 */
function getSmtpConfig() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = port === 465;
  const user = process.env.SMTP_USER || process.env.SMTP_EMAIL;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const from =
    process.env.SMTP_FROM ||
    (process.env.FROM_NAME && process.env.FROM_EMAIL
      ? `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`
      : process.env.FROM_EMAIL || user);

  return { host, port, secure, user, pass, from };
}

let transporterInstance = null;

/**
 * Get or initialize nodemailer transporter singleton
 */
function getTransporter() {
  if (!transporterInstance) {
    const config = getSmtpConfig();

    transporterInstance = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  return transporterInstance;
}

/**
 * Verify SMTP connection and credentials
 */
async function verifyTransporter() {
  const transporter = getTransporter();
  try {
    const success = await transporter.verify();
    console.log('✅ [EmailService] SMTP connection verified successfully');
    return { success: true, verified: success };
  } catch (error) {
    console.error('❌ [EmailService] SMTP verification failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send an email using configured SMTP transporter
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plain text body
 * @param {string} [options.html] - HTML body
 * @param {string} [options.from] - Custom from address (defaults to SMTP_FROM)
 * @param {Array} [options.attachments] - Nodemailer attachments array
 * @returns {Promise<Object>} Nodemailer sendMail result
 */
async function sendEmail({ to, subject, text, html, from, attachments = [], ...rest }) {
  if (!to) {
    throw new Error('Recipient email ("to") is required');
  }
  if (!subject) {
    throw new Error('Email "subject" is required');
  }

  const config = getSmtpConfig();
  const transporter = getTransporter();

  const mailOptions = {
    from: from || config.from,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    text,
    html,
    attachments,
    ...rest,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 [EmailService] Email sent successfully to ${mailOptions.to} (MessageId: ${info.messageId})`);
    return info;
  } catch (error) {
    console.error(`❌ [EmailService] Failed to send email to ${mailOptions.to}:`, error.message);
    throw error;
  }
}

module.exports = {
  getTransporter,
  verifyTransporter,
  sendEmail,
  getSmtpConfig,
};

