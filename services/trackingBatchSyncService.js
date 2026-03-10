const { query } = require("./db");
const { syncPostNordTrackingForShipment } = require("./trackingSyncService");

async function getActivePostNordShipments(limit = 20) {
  const result = await query(
    `
    SELECT *
    FROM shipments
    WHERE actual_carrier = 'postnord'
    AND tracking_number IS NOT NULL
    AND status != 'failed'
    AND (
      carrier_next_sync_at IS NULL
      OR carrier_next_sync_at <= NOW()
    )
    ORDER BY carrier_next_sync_at ASC NULLS FIRST
    LIMIT $1
  `,
    [limit]
  );

  return result.rows;
}

async function syncActivePostNordBatch({ limit = 20 } = {}) {
  const shipments = await getActivePostNordShipments(limit);

  const summary = {
    success: true,
    totalCandidates: shipments.length,
    synced: 0,
    failed: 0,
    skipped: 0,
    results: []
  };

  for (const shipment of shipments) {
    try {
      const result = await syncPostNordTrackingForShipment(shipment);

      if (result.success) {
        summary.synced++;
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
        carrier_status_text:
          result.shipment?.carrier_status_text || null,
        carrier_last_event_at:
          result.shipment?.carrier_last_event_at || null,
        carrier_event_count:
          result.shipment?.carrier_event_count || 0,
        carrier_last_synced_at:
          result.shipment?.carrier_last_synced_at || null,
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
