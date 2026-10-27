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
    return { skipped: true, reason: 'Sync already in progress' };
  }

  isSyncing = true;
  lastSyncStatus = 'in_progress';
  const startTime = Date.now();

  try {
    const result = await ornateService.runOrnateFullSync();
    lastSyncTime = new Date();
    lastSyncStatus = result.success ? 'success' : 'error';
    lastSyncResult = {
      timestamp: lastSyncTime,
      durationMs: Date.now() - startTime,
      results: result.results,
    };
    lastSyncError = result.success ? null : 'Ornate sync completed with failed records';
    if (!result.success) return { success: false, error: lastSyncError, result: lastSyncResult };

    return { success: true, result: lastSyncResult };
  } catch (err) {
    lastSyncTime = new Date();
    lastSyncStatus = 'error';
    lastSyncError = err.message;
    console.error(`[Ornate Cron] Sync failed:`, err.message);
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

  if (!isEnabled || cronJob) {
    return;
  }

  cronJob = cron.schedule(cronSchedule, async () => {
    await triggerOrnateSync('scheduled_cron');
  });
}

/**
 * Stops the Ornate sync cron job if running.
 */
function stopOrnateCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
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
