const cron = require('node-cron');
const ornateService = require('./ornate.service');
const { ORNATE } = require('../../config/constants');

let cronJob = null;
let isSyncing = false;
let lastSyncTime = null;
let lastSyncStatus = 'idle'; // 'idle', 'in_progress', 'success', 'error'
let lastSyncResult = null;
let lastSyncError = null;

async function triggerOrnateSync(source = 'cron', userId = null) {
  if (isSyncing) {
    return { skipped: true, reason: 'Sync already in progress' };
  }

  isSyncing = true;
  lastSyncStatus = 'in_progress';
  const startTime = Date.now();

  try {
    const result = await ornateService.runOrnateFullSync(userId);
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

function startOrnateCron() {
  const isEnabled = ORNATE.SYNC_ENABLED;
  const cronSchedule = ORNATE.SYNC_CRON || '*/30 * * * *';

  if (!isEnabled || cronJob) {
    return;
  }

  cronJob = cron.schedule(cronSchedule, async () => {
    await triggerOrnateSync('scheduled_cron');
  });
}

function stopOrnateCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
}

function getOrnateSyncStatus() {
  return {
    isCronScheduled: Boolean(cronJob),
    cronSchedule: ORNATE.SYNC_CRON || '*/30 * * * *',
    isEnabled: ORNATE.SYNC_ENABLED,
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
