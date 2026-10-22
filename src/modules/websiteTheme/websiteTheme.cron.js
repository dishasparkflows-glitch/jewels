const cron = require('node-cron');
const websiteThemeService = require('./websiteTheme.service');

let job;
let running = false;

async function reconcile(source = 'cron') {
  if (running) return;
  running = true;
  try {
    await websiteThemeService.reconcileSchedule();
  } catch (error) {
    console.error(`[Website Theme] Schedule reconciliation failed (${source}):`, error.message);
  } finally {
    running = false;
  }
}

function startWebsiteThemeCron() {
  if (process.env.WEBSITE_THEME_CRON_ENABLED === 'false' || job) return job;
  setTimeout(() => reconcile('startup'), 3000);
  job = cron.schedule('* * * * *', () => reconcile(), { timezone: 'Asia/Kolkata' });
  console.log('[Website Theme] Scheduled publish and expiry check enabled (Asia/Kolkata).');
  return job;
}

module.exports = { startWebsiteThemeCron, reconcile };
