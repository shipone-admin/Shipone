const { query } = require("./db");
const {
  syncPostNordTrackingForShipment
} = require("./trackingSyncService");

function normalizeLimit(limit) {
  const parsed = Number(limit);

  if (Number.isNaN(parsed)) {
    return 20;
  }

  return Math.max(1, Math.min(parsed, 100));
}

function isDeliveredStatus(shipment) {
  const carrierStatus = String(shipment?.carrier_status_text || "")
    .trim()
    .toLowerCase();
  const shipmentStatus = String(shipment?.status || "")
    .trim()
    .toLowerCase();

  if (
    carrierStatus.includes("levererad") ||
    carrierStatus.includes("delivered") ||
    carrierStatus.includes("utlämnad")
  ) {
    return true;
  }

  if (shipmentStatus === "delivered") {
    return true;
  }

  return false;
}

async function getBatchCandidateShipments({
  limit = 20,
  includeDelivered = false
} = {}) {
  const safeLimit = normalizeLimit(limit);

  const result = await query(
    `
      SELECT *
      FROM shipments
      WHERE actual_carrier = 'postnord'
      ORDER BY created_at DESC, id DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  const shipments = result.rows || [];

  if (includeDelivered) {
    return shipments;
  }

  return shipments.filter((shipment) => !isDeliveredStatus(shipment));
}

async function syncPostNordBatch({
  limit = 20,
  includeDelivered = false
} = {}) {
  const shipments = await getBatchCandidateShipments({
    limit,
    includeDelivered
  });

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
      const syncResult = await syncPostNordTrackingForShipment(shipment);

      if (syncResult.success) {
        summary.synced += 1;
      } else if ((syncResult.statusCode || 500) >= 400) {
        summary.failed += 1;
      } else {
        summary.skipped += 1;
      }

      summary.results.push({
        success: syncResult.success,
        statusCode: syncResult.statusCode,
        order_id: shipment.order_id,
        order_name: shipment.order_name,
        tracking_number: shipment.tracking_number,
        actual_carrier: shipment.actual_carrier,
        carrier_status_text:
          syncResult.shipment?.carrier_status_text || null,
        carrier_last_event_at:
          syncResult.shipment?.carrier_last_event_at || null,
        carrier_event_count:
          syncResult.shipment?.carrier_event_count || 0,
        carrier_last_synced_at:
          syncResult.shipment?.carrier_last_synced_at || null,
        error: syncResult.error || null
      });
    } catch (error) {
      summary.failed += 1;

      summary.results.push({
        success: false,
        statusCode: 500,
        order_id: shipment.order_id,
        order_name: shipment.order_name,
        tracking_number: shipment.tracking_number,
        actual_carrier: shipment.actual_carrier,
        carrier_status_text: null,
        carrier_last_event_at: null,
        carrier_event_count: 0,
        carrier_last_synced_at: null,
        error: error.message || "Unknown batch sync error"
      });
    }
  }

  return summary;
}

module.exports = {
  syncPostNordBatch
};
