const cron = require('node-cron');
const ornateService = require('./ornate.service');

let cronJob = null;
let isSyncing = false;
let lastSyncTime = null;
let lastSyncStatus = 'idle'; // 'idle', 'in_progress', 'success', 'error'
let lastSyncResult = null;
let lastSyncError = null;

/**
 * Triggers the Ornate product synchronization process.
 * Guards against concurrent overlapping runs.
 */
async function triggerOrnateSync(source = 'cron') {
  if (isSyncing) {
    console.warn(`[Ornate Cron] ⏳ Sync already in progress (triggered by ${source}), skipping duplicate trigger.`);
    return { skipped: true, reason: 'Sync already in progress' };
  }

  isSyncing = true;
  lastSyncStatus = 'in_progress';
  const startTime = Date.now();
  console.log(`\n======================================================`);
  console.log(`[Ornate Cron] 🚀 Starting Ornate 30-min Sync (${new Date().toISOString()}) [Source: ${source}]`);
  console.log(`======================================================`);

  try {
    const result = await ornateService.runOrnateFullSync();
    lastSyncTime = new Date();
    lastSyncStatus = 'success';
    lastSyncResult = {
      timestamp: lastSyncTime,
      durationMs: Date.now() - startTime,
      results: result.results,
    };
    lastSyncError = null;

    console.log(`[Ornate Cron] ✅ Full Sync completed successfully in ${Date.now() - startTime}ms`);
    return { success: true, result: lastSyncResult };
  } catch (err) {
    lastSyncTime = new Date();
    lastSyncStatus = 'error';
    lastSyncError = err.message;
    console.error(`[Ornate Cron] ❌ Full Sync failed:`, err.message);
    return { success: false, error: err.message };
  } finally {
    isSyncing = false;
  }
}

/**
 * Starts the 30-minute recurring Ornate synchronization cron job.
 */
function startOrnateCron() {
  const isEnabled = process.env.ORNATE_SYNC_ENABLED !== 'false';
  const cronSchedule = process.env.ORNATE_SYNC_CRON || '*/30 * * * *';

  if (!isEnabled) {
    console.log('[Ornate Cron] ⚠️ Ornate product sync cron is disabled via ORNATE_SYNC_ENABLED=false');
    return;
  }

  if (cronJob) {
    console.log('[Ornate Cron] Cron job already scheduled.');
    return;
  }

  console.log(`[Ornate Cron] ⏰ Scheduling Ornate product sync cron: "${cronSchedule}" (every 30 minutes)`);

  cronJob = cron.schedule(cronSchedule, async () => {
    await triggerOrnateSync('scheduled_cron');
  });

  console.log('[Ornate Cron] ✅ Cron job scheduled successfully.');
}

/**
 * Stops the Ornate sync cron job if running.
 */
function stopOrnateCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[Ornate Cron] ⏹️ Ornate sync cron stopped.');
  }
}

/**
 * Returns current status and last execution stats.
 */
function getOrnateSyncStatus() {
  return {
    isCronScheduled: Boolean(cronJob),
    cronSchedule: process.env.ORNATE_SYNC_CRON || '*/30 * * * *',
    isEnabled: process.env.ORNATE_SYNC_ENABLED !== 'false',
    isSyncing,
    lastSyncStatus,
    lastSyncTime,
    lastSyncResult,
    lastSyncError,
  };
}

module.exports = {
  startOrnateCron,
  stopOrnateCron,
  triggerOrnateSync,
  getOrnateSyncStatus,
};
