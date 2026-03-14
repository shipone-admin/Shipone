const { query } = require("./db");
const { syncPostNordTrackingForShipment } = require("./trackingSyncService");

function normalizeLimit(limit) {
  const value = Number(limit);
  if (!Number.isFinite(value)) return 20;
  return Math.max(1, Math.min(Math.floor(value), 200));
}

function normalizeMaxAgeDays(maxAgeDays) {
  const value = Number(maxAgeDays);
  if (!Number.isFinite(value)) return 30;
  return Math.max(1, Math.min(Math.floor(value), 365));
}

async function getActivePostNordShipments({ limit = 20, maxAgeDays = 30 } = {}) {
  const safeLimit = normalizeLimit(limit);
  const safeMaxAgeDays = normalizeMaxAgeDays(maxAgeDays);

  const result = await query(
    `
      SELECT *
      FROM shipments
      WHERE actual_carrier = 'postnord'
        AND tracking_number IS NOT NULL
        AND status != 'failed'
        AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
        AND (
          carrier_next_sync_at IS NULL
          OR carrier_next_sync_at <= NOW()
        )
      ORDER BY carrier_next_sync_at ASC NULLS FIRST, created_at DESC
      LIMIT $1
    `,
    [safeLimit, safeMaxAgeDays]
  );

  return {
    shipments: result.rows,
    filters: {
      actual_carrier: "postnord",
      failed_excluded: true,
      tracking_number_required: true,
      due_for_sync_only: true,
      maxAgeDays: safeMaxAgeDays,
      limit: safeLimit
    }
  };
}

async function syncActivePostNordBatch({ limit = 20, maxAgeDays = 30 } = {}) {
  const safeLimit = normalizeLimit(limit);
  const safeMaxAgeDays = normalizeMaxAgeDays(maxAgeDays);

  const { shipments, filters } = await getActivePostNordShipments({
    limit: safeLimit,
    maxAgeDays: safeMaxAgeDays
  });

  const summary = {
    success: true,
    totalCandidates: shipments.length,
    synced: 0,
    failed: 0,
    skipped: 0,
    filters,
    results: []
  };

  for (const shipment of shipments) {
    try {
      const result = await syncPostNordTrackingForShipment(shipment);

      if (result.success) {
        summary.synced++;
      } else if (result.statusCode === 400 || result.statusCode === 404) {
        summary.skipped++;
      } else {
        summary.failed++;
      }

      summary.results.push({
        success: result.success,
        statusCode: result.statusCode,
        order_id: shipment.order_id,
        order_name: shipment.order_name,
        tracking_number: shipment.tracking_number,
        actual_carrier: shipment.actual_carrier,
        carrier_status_text: result.shipment?.carrier_status_text || null,
        carrier_last_event_at: result.shipment?.carrier_last_event_at || null,
        carrier_event_count: result.shipment?.carrier_event_count || 0,
        carrier_last_synced_at: result.shipment?.carrier_last_synced_at || null,
        carrier_next_sync_at: result.shipment?.carrier_next_sync_at || null,
        carrier_last_sync_status: result.shipment?.carrier_last_sync_status || null,
        error: result.error || null
      });
    } catch (error) {
      summary.failed++;

      summary.results.push({
        success: false,
        statusCode: 500,
        order_id: shipment.order_id,
        order_name: shipment.order_name,
        tracking_number: shipment.tracking_number,
        actual_carrier: shipment.actual_carrier,
        error: error.message
      });
    }
  }

  return summary;
}

module.exports = {
  syncActivePostNordBatch
};
