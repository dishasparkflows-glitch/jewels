const path = require('path');
require('dotenv').config();
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const app = require('./app');
const { startBannerCron } = require('./modules/banner/banner.cron');
const { startCouponExpirationCron } = require('./modules/coupon/coupon.cron');
const { startWebsiteThemeCron } = require('./modules/websiteTheme/websiteTheme.cron');

const http = require('http');
const { initViewerSocket } = require('./socket/viewers.socket');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start server
connectDB().then(async () => {
  // Initialize and verify Redis connection
  await connectRedis();

  // Start recurring banner offer auto-cleanup cron
  startBannerCron();

  // Expire coupons nightly at midnight Asia/Kolkata.
  startCouponExpirationCron();

  // Activate scheduled storefront themes and apply campaign expiry fallbacks.
  startWebsiteThemeCron();

  const server = http.createServer(app);
  initViewerSocket(server);

  server.listen(PORT, () => {
    console.log(`\n🚀 Jewels API Server running on port ${PORT}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV}`);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
  process.exit(1);
});
