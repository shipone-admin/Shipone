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
      ...batchResult
    };
  } catch (error) {
    return {
      success: false,
      job: "sync-postnord-active",
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error.message || "Job failed"
    };
  }
}

module.exports = {
  runPostNordActiveSyncJob
};
