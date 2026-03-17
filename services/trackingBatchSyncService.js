const { query } = require("./db");
const { syncPostNordTrackingByOrderId } = require("./trackingSyncService");

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
          OR carrier_status_text NOT ILIKE '%delivered%'
          OR carrier_status_text NOT ILIKE '%utdelad%'
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

async function syncPostNordBatch({ limit = 20, includeDelivered = false } = {}) {
  const safeLimit = toSafeLimit(limit, 20, 200);
  const shipments = await loadPostNordShipments(
    safeLimit,
    Boolean(includeDelivered)
  );

  const results = [];

  for (const shipment of shipments) {
    const result = await syncPostNordTrackingByOrderId(shipment.order_id);

    results.push({
      order_id: shipment.order_id,
      tracking_number: shipment.tracking_number,
      merchant_id: shipment.merchant_id || "default",
      success: Boolean(result.success),
      statusCode: result.statusCode || 500,
      error: result.error || null
    });
  }

  const successCount = results.filter((item) => item.success).length;
  const failureCount = results.length - successCount;

  return {
    success: failureCount === 0,
    mode: "batch_postnord",
    total: results.length,
    successCount,
    failureCount,
    results
  };
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

    results.push({
      order_id: shipment.order_id,
      tracking_number: shipment.tracking_number,
      merchant_id: shipment.merchant_id || "default",
      success: Boolean(result.success),
      statusCode: result.statusCode || 500,
      error: result.error || null
    });
  }

  const successCount = results.filter((item) => item.success).length;
  const failureCount = results.length - successCount;
  const skippedByMerchantCount = results.filter(
    (item) => item.statusCode === 403
  ).length;

  return {
    success: failureCount === 0,
    mode: "active_postnord",
    total: results.length,
    successCount,
    failureCount,
    skippedByMerchantCount,
    maxAgeDays: safeMaxAgeDays,
    results
  };
}

module.exports = {
  syncPostNordBatch,
  syncActivePostNordBatch
};
