const { query } = require("./db");
const {
  syncTrackingByOrderId,
  syncPostNordTrackingByOrderId
} = require("./trackingSyncService");

function toSafeLimit(value, fallback = 20, max = 200) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function toSafeMaxAgeDays(value, fallback = 30, max = 365) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function getSupportedBatchCarriers() {
  return ["postnord", "dhl"];
}

async function loadPostNordShipments(limit, includeDelivered) {
  if (includeDelivered) {
    const result = await query(
      `
        SELECT *
        FROM shipments
        WHERE actual_carrier = 'postnord'
          AND tracking_number IS NOT NULL
        ORDER BY created_at DESC, id DESC
        LIMIT $1
      `,
      [limit]
    );

    return result.rows;
  }

  const result = await query(
    `
      SELECT *
      FROM shipments
      WHERE actual_carrier = 'postnord'
        AND tracking_number IS NOT NULL
        AND (
          carrier_status_text IS NULL
          OR (
            carrier_status_text NOT ILIKE '%delivered%'
            AND carrier_status_text NOT ILIKE '%utdelad%'
          )
        )
      ORDER BY created_at DESC, id DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

async function loadActivePostNordShipments(limit, maxAgeDays) {
  const result = await query(
    `
      SELECT *
      FROM shipments
      WHERE actual_carrier = 'postnord'
        AND tracking_number IS NOT NULL
        AND status = 'completed'
        AND created_at >= NOW() - ($2::text || ' days')::interval
        AND (
          carrier_next_sync_at IS NULL
          OR carrier_next_sync_at <= NOW()
        )
      ORDER BY
        COALESCE(carrier_next_sync_at, created_at) ASC,
        id DESC
      LIMIT $1
    `,
    [limit, String(maxAgeDays)]
  );

  return result.rows;
}

async function loadCarrierAwareShipments(limit, includeDelivered) {
  const supportedCarriers = getSupportedBatchCarriers();

  if (includeDelivered) {
    const result = await query(
      `
        SELECT *
        FROM shipments
        WHERE actual_carrier = ANY($2::text[])
          AND tracking_number IS NOT NULL
        ORDER BY created_at DESC, id DESC
        LIMIT $1
      `,
      [limit, supportedCarriers]
    );

    return result.rows;
  }

  const result = await query(
    `
      SELECT *
      FROM shipments
      WHERE actual_carrier = ANY($2::text[])
        AND tracking_number IS NOT NULL
        AND (
          carrier_status_text IS NULL
          OR (
            carrier_status_text NOT ILIKE '%delivered%'
            AND carrier_status_text NOT ILIKE '%utdelad%'
            AND carrier_status_text NOT ILIKE '%completed%'
          )
        )
      ORDER BY created_at DESC, id DESC
      LIMIT $1
    `,
    [limit, supportedCarriers]
  );

  return result.rows;
}

async function loadActiveCarrierAwareShipments(limit, maxAgeDays) {
  const supportedCarriers = getSupportedBatchCarriers();

  const result = await query(
    `
      SELECT *
      FROM shipments
      WHERE actual_carrier = ANY($3::text[])
        AND tracking_number IS NOT NULL
        AND status = 'completed'
        AND created_at >= NOW() - ($2::text || ' days')::interval
        AND (
          carrier_next_sync_at IS NULL
          OR carrier_next_sync_at <= NOW()
        )
      ORDER BY
        COALESCE(carrier_next_sync_at, created_at) ASC,
        id DESC
      LIMIT $1
    `,
    [limit, String(maxAgeDays), supportedCarriers]
  );

  return result.rows;
}

function buildBatchResultItem(shipment, result) {
  return {
    order_id: shipment.order_id,
    tracking_number: shipment.tracking_number,
    merchant_id: shipment.merchant_id || "default",
    actual_carrier: shipment.actual_carrier || null,
    success: Boolean(result.success),
    skipped: Boolean(result.skipped),
    skipReason: result.skipReason || null,
    statusCode: result.statusCode || 500,
    error: result.error || null
  };
}

function buildBatchSummary(mode, results, extra = {}) {
  const successCount = results.filter((item) => item.success).length;
  const skippedCount = results.filter((item) => item.skipped).length;
  const skippedByMerchantCount = results.filter(
    (item) => item.skipReason === "disabled_by_merchant"
  ).length;
  const failureCount = results.filter(
    (item) => !item.success && !item.skipped
  ).length;

  return {
    success: failureCount === 0,
    mode,
    total: results.length,
    successCount,
    skippedCount,
    skippedByMerchantCount,
    failureCount,
    results,
    ...extra
  };
}

async function syncPostNordBatch({ limit = 20, includeDelivered = false } = {}) {
  const safeLimit = toSafeLimit(limit, 20, 200);
  const shipments = await loadPostNordShipments(
    safeLimit,
    Boolean(includeDelivered)
  );

  const results = [];

  for (const shipment of shipments) {
    const result = await syncPostNordTrackingByOrderId(shipment.order_id);

    results.push(buildBatchResultItem(shipment, result));
  }

  return buildBatchSummary("batch_postnord", results, {
    includeDelivered: Boolean(includeDelivered)
  });
}

async function syncActivePostNordBatch({
  limit = 20,
  maxAgeDays = 30
} = {}) {
  const safeLimit = toSafeLimit(limit, 20, 200);
  const safeMaxAgeDays = toSafeMaxAgeDays(maxAgeDays, 30, 365);

  const shipments = await loadActivePostNordShipments(
    safeLimit,
    safeMaxAgeDays
  );

  const results = [];

  for (const shipment of shipments) {
    const result = await syncPostNordTrackingByOrderId(shipment.order_id);

    results.push(buildBatchResultItem(shipment, result));
  }

  return buildBatchSummary("active_postnord", results, {
    maxAgeDays: safeMaxAgeDays
  });
}

async function syncTrackingBatch({ limit = 20, includeDelivered = false } = {}) {
  const safeLimit = toSafeLimit(limit, 20, 200);
  const shipments = await loadCarrierAwareShipments(
    safeLimit,
    Boolean(includeDelivered)
  );

  const results = [];

  for (const shipment of shipments) {
    const result = await syncTrackingByOrderId(shipment.order_id);

    results.push(buildBatchResultItem(shipment, result));
  }

  return buildBatchSummary("batch_tracking", results, {
    includeDelivered: Boolean(includeDelivered),
    supportedCarriers: getSupportedBatchCarriers()
  });
}

async function syncActiveTrackingBatch({
  limit = 20,
  maxAgeDays = 30
} = {}) {
  const safeLimit = toSafeLimit(limit, 20, 200);
  const safeMaxAgeDays = toSafeMaxAgeDays(maxAgeDays, 30, 365);

  const shipments = await loadActiveCarrierAwareShipments(
    safeLimit,
    safeMaxAgeDays
  );

  const results = [];

  for (const shipment of shipments) {
    const result = await syncTrackingByOrderId(shipment.order_id);

    results.push(buildBatchResultItem(shipment, result));
  }

  return buildBatchSummary("active_tracking", results, {
    maxAgeDays: safeMaxAgeDays,
    supportedCarriers: getSupportedBatchCarriers()
  });
}

module.exports = {
  syncPostNordBatch,
  syncActivePostNordBatch,
  syncTrackingBatch,
  syncActiveTrackingBatch
};
