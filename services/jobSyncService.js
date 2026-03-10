const { syncActivePostNordBatch } = require("./trackingBatchSyncService");

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function buildDurationMs(startedAt, finishedAt) {
  const start = startedAt instanceof Date ? startedAt.getTime() : new Date(startedAt).getTime();
  const end = finishedAt instanceof Date ? finishedAt.getTime() : new Date(finishedAt).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  return Math.max(0, end - start);
}

async function runPostNordActiveSyncJob({
  limit = 20,
  maxAgeDays = 30
} = {}) {
  const startedAt = new Date();

  try {
    const batchResult = await syncActivePostNordBatch({
      limit,
      maxAgeDays
    });

    const finishedAt = new Date();

    return {
      success: true,
      job: {
        name: "sync-postnord-active",
        started_at: toIso(startedAt),
        finished_at: toIso(finishedAt),
        duration_ms: buildDurationMs(startedAt, finishedAt),
        status: "completed"
      },
      summary: {
        total_candidates: batchResult.totalCandidates,
        synced: batchResult.synced,
        failed: batchResult.failed,
        skipped: batchResult.skipped
      },
      filters: batchResult.filters || {
        actual_carrier: "postnord",
        delivered_excluded: true,
        failed_excluded: true,
        tracking_number_required: true,
        maxAgeDays: Number(maxAgeDays),
        limit: Number(limit)
      },
      results: batchResult.results || []
    };
  } catch (error) {
    const finishedAt = new Date();

    return {
      success: false,
      job: {
        name: "sync-postnord-active",
        started_at: toIso(startedAt),
        finished_at: toIso(finishedAt),
        duration_ms: buildDurationMs(startedAt, finishedAt),
        status: "failed"
      },
      error: error.message || "PostNord active sync job failed"
    };
  }
}

module.exports = {
  runPostNordActiveSyncJob
};
