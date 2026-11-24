const nodemailer = require('nodemailer');
const { SMTP } = require('../config/constants');

// ------------------------------- get smtp config ----------------------------
function getSmtpConfig() {
  const host = SMTP.HOST;
  const port = SMTP.PORT;
  const secure = port === 465;
  const user = SMTP.USER;
  const pass = SMTP.PASS;
  const from = SMTP.FROM || user;

  return { host, port, secure, user, pass, from };
}

let transporterInstance = null;

// ------------------------------- get transporter ----------------------------
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

// ------------------------------- verify transporter ----------------------------
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

// ------------------------------- send email ----------------------------
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
