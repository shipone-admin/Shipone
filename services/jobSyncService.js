const { syncActivePostNordBatch } = require("./trackingBatchSyncService");

async function runPostNordActiveSyncJob({
  limit = 20,
  maxAgeDays = 30
} = {}) {
  const startedAt = new Date().toISOString();

  try {
    const batchResult = await syncActivePostNordBatch({
      limit,
      maxAgeDays
    });

    return {
      success: Boolean(batchResult.success),
      job: "sync-postnord-active",
      startedAt,
      finishedAt: new Date().toISOString(),
      total: batchResult.total || 0,
      successCount: batchResult.successCount || 0,
      skippedCount: batchResult.skippedCount || 0,
      skippedByMerchantCount: batchResult.skippedByMerchantCount || 0,
      failureCount: batchResult.failureCount || 0,
      maxAgeDays: batchResult.maxAgeDays,
      results: batchResult.results || []
    };
  } catch (error) {
    return {
      success: false,
      job: "sync-postnord-active",
      startedAt,
      finishedAt: new Date().toISOString(),
      total: 0,
      successCount: 0,
      skippedCount: 0,
      skippedByMerchantCount: 0,
      failureCount: 1,
      error: error.message || "Job failed",
      results: []
    };
  }
}

module.exports = {
  runPostNordActiveSyncJob
};
