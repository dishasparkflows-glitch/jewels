require('dotenv').config();

module.exports = {
  // App & Server
  PORT: process.env.PORT || 9900,
  NODE_ENV: process.env.NODE_ENV || 'development',
  STORE_NAME: process.env.STORE_NAME || 'Jewels',

  // URL
  URL: {
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:9900',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    ADMIN_URL: process.env.ADMIN_URL || 'http://localhost:5175',
  }, 
  
  // Database & Cache
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/neirah',
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',

  // Authentication & Security
  JWT: {
    SECRET: process.env.JWT_SECRET,
    EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  },

  PAYLOAD_ENCRYPTION_KEY: process.env.PAYLOAD_ENCRYPTION_KEY,
  INTEGRATION_TOKEN_ENCRYPTION_KEY:
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
    process.env.SHIPROCKET_TOKEN_ENCRYPTION_KEY ||
    'edf6cec5af78979fbb750a5ff61b701f80dc1b0917f9e15219e92e9944fdb74b',

  // Default Providers
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || 'razorpay',
  SMS_PROVIDER: process.env.SMS_PROVIDER || 'netsms',
  LOGISTICS_PROVIDER: process.env.LOGISTICS_PROVIDER || process.env.SHIPPING_PROVIDER || 'shiprocket',

  // Cloudflare R2
  CLOUDFLARE_R2: {
    ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    PUBLIC_DOMAIN: process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || process.env.CLOUDFLARE_R2_PUBLIC_URL,
    ENDPOINT: process.env.CLOUDFLARE_R2_ENDPOINT,
  },

  // Shiprocket
  SHIPROCKET: {
    EMAIL: process.env.SHIPROCKET_EMAIL,
    PASSWORD: process.env.SHIPROCKET_PASSWORD,
    PICKUP_LOCATION: process.env.SHIPROCKET_PICKUP_LOCATION || 'Home',
    PICKUP_PINCODE: process.env.SHIPROCKET_PICKUP_PINCODE || '395010',
    MOCK_MODE: process.env.SHIPROCKET_MOCK_MODE || 'false',
    WEBHOOK_TOKEN: process.env.SHIPROCKET_WEBHOOK_TOKEN || process.env.LOGISTICS_WEBHOOK_TOKEN || 'sr_wh_neirah_live_secret',
    TOKEN_ENCRYPTION_KEY:
      process.env.SHIPROCKET_TOKEN_ENCRYPTION_KEY ||
      process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
      'edf6cec5af78979fbb750a5ff61b701f80dc1b0917f9e15219e92e9944fdb74b',
  },

  // Razorpay
  RAZORPAY: {
    KEY_ID: process.env.RAZORPAY_KEY_ID,
    KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  },
  TEST_PAYMENT_PHONE_NUMBERS: process.env.TEST_PAYMENT_PHONE_NUMBERS,

  // CCAvenue
  CCAVENUE: {
    MERCHANT_ID: process.env.CCAVENUE_MERCHANT_ID,
    ACCESS_CODE: process.env.CCAVENUE_ACCESS_CODE,
    WORKING_KEY: process.env.CCAVENUE_WORKING_KEY,
    URL: process.env.CCAVENUE_URL || 'https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction',
    ENVIRONMENT: process.env.CCAVENUE_ENVIRONMENT || 'uat',
    ENCRYPTION_MODE: process.env.CCAVENUE_ENCRYPTION_MODE || 'aes128',
    TEST_AMOUNT: process.env.CCAVENUE_TEST_AMOUNT || 'true',
  },

  // Email
  SMTP: {
    HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    PORT: Number(process.env.SMTP_PORT) || 587,
    USER: process.env.SMTP_USER,
    PASS: process.env.SMTP_PASS,
    FROM: process.env.SMTP_FROM,
  },

  // WhatsApp
  CONNECTWHATS: {
    API_URL: process.env.CONNECTWHATS_API_URL || 'https://app.connectwhats.com',
    API_KEY: process.env.CONNECTWHATS_API_KEY,
    TOKEN: process.env.CONNECTWHATS_TOKEN,
    INSTANCE_ID: process.env.CONNECTWHATS_INSTANCE_ID,
    PHONE_NUMBER: process.env.CONNECTWHATS_PHONE_NUMBER,
    PHONE_NUMBER_ID: process.env.CONNECTWHATS_PHONE_NUMBER_ID,
    WABA_ID: process.env.CONNECTWHATS_WABA_ID,
  },

  // NetSMS
  NETSMS: {
    API_URL: process.env.NETSMS_API_URL || 'https://ui.netsms.co.in/API/SendSMS.aspx',
    API_KEY: process.env.NETSMS_API_KEY,
    SENDER_ID: process.env.NETSMS_SENDER_ID || 'NETSMS',
    SMS_TYPE: process.env.NETSMS_SMS_TYPE || 'TRANS',
    ENTITY_ID: process.env.NETSMS_ENTITY_ID,
    OTP_TEMPLATE_ID: process.env.NETSMS_OTP_TEMPLATE_ID,
    OTP_TEMPLATE: process.env.NETSMS_OTP_TEMPLATE,
    SIGNUP_MESSAGE: process.env.SMS_SIGNUP_MESSAGE,
    ORDER_MESSAGE: process.env.SMS_ORDER_MESSAGE,
  },

  // Twilio
  TWILIO: {
    ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  },

  // Ornate ERP
  ORNATE: {
    BASE_URL: process.env.ORNATE_BASE_URL,
    USERNAME: process.env.ORNATE_USERNAME,
    PASSWORD: process.env.ORNATE_PASSWORD,
    FTP_HOST: process.env.ORNATE_FTP_HOST,
    FTP_USER: process.env.ORNATE_FTP_USER,
    FTP_PASSWORD: process.env.ORNATE_FTP_PASSWORD,
    FTP_PORT: process.env.ORNATE_FTP_PORT || '2166',
    TIMEOUT: Number(process.env.ORNATE_TIMEOUT) || 30000,
    SYNC_ENABLED: process.env.ORNATE_SYNC_ENABLED === 'true',
    SYNC_CRON: process.env.ORNATE_SYNC_CRON || '0 */2 * * *',
  },

  // Google OAuth & Analytics
  GOOGLE: {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
    GA4_PROPERTY_ID: process.env.GA4_PROPERTY_ID,
    GA_SERVICE_ACCOUNT_KEY: process.env.GA_SERVICE_ACCOUNT_KEY,
  },

  // Cron Schedules
  CRON_TIME: {
    COUPON_EXPIRATION: '0 0,12 * * *', // Every 12 AM and 12 PM
    OFFER_EXPIRATION_CRON: process.env.OFFER_EXPIRATION_CRON || '0 * * * *',
    ORNATE_SYNC: process.env.ORNATE_SYNC_CRON || '0 */2 * * *',
    THEME_CRON_ENABLED: process.env.THEME_CRON_ENABLED !== 'false',
  },
};
