const path = require('path');
require('dotenv').config();
const { PORT, NODE_ENV } = require('./config/constants');
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const app = require('./app');
const { startBannerCron } = require('./modules/banner/banner.cron');
const { startCouponExpirationCron } = require('./modules/coupon/coupon.cron');
const { startThemeCron } = require('./modules/theme/theme.cron');
const moduleService = require('./modules/module/module.service');

const http = require('http');
const { initViewerSocket } = require('./socket/viewers.socket');

// Connect to MongoDB and start server
connectDB().then(async () => {
  // Initialize and verify Redis connection
  await connectRedis();

  // Ensure the local database has its `modules` collection populated
  await moduleService.ensureLocalModulesSeeded().catch((err) => {
    console.warn('⚠️ Failed to seed local modules collection:', err?.message || err);
  });

  // Start recurring banner offer auto-cleanup cron
  startBannerCron();

  // Expire coupons nightly at midnight Asia/Kolkata.
  startCouponExpirationCron();

  // Activate scheduled storefront themes and apply campaign expiry fallbacks.
  startThemeCron();

  const server = http.createServer(app);
  initViewerSocket(server);

  server.listen(PORT, () => {
    console.log(`\n🚀 Jewels API Server running on port ${PORT}`);
    console.log(`📋 Environment: ${NODE_ENV}`);
  });
});

// Handle unhandled promise rejections gracefully without crashing the server
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err?.stack || err?.message || err);
  // Avoid process.exit(1) to prevent transient external network/webhook blips from crashing the API
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err?.stack || err?.message || err);
});
