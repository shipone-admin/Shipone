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

function normalizeMaxAgeDays(value) {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return 30;
  }

  return Math.max(1, Math.min(parsed, 365));
}

function normalizeDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
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

function isFailedShipment(shipment) {
  const shipmentStatus = String(shipment?.status || "")
    .trim()
    .toLowerCase();
  const carrierStatus = String(shipment?.carrier_status_text || "")
    .trim()
    .toLowerCase();

  if (shipmentStatus === "failed") {
    return true;
  }

  if (
    carrierStatus.includes("misslyck") ||
    carrierStatus.includes("failed") ||
    carrierStatus.includes("returnerad") ||
    carrierStatus.includes("retur")
  ) {
    return true;
  }

  return false;
}

function isTooOld(shipment, maxAgeDays) {
  const createdAt = normalizeDate(shipment?.created_at);

  if (!createdAt) {
    return false;
  }

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const ageMs = Date.now() - createdAt.getTime();

  return ageMs > maxAgeMs;
}

function isActiveShipment(shipment, maxAgeDays) {
  if (!shipment) return false;
  if (!shipment.tracking_number) return false;
  if (String(shipment.actual_carrier || "").toLowerCase() !== "postnord") {
    return false;
  }
  if (isDeliveredStatus(shipment)) return false;
  if (isFailedShipment(shipment)) return false;
  if (isTooOld(shipment, maxAgeDays)) return false;

  return true;
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

async function getActiveBatchCandidateShipments({
  limit = 20,
  maxAgeDays = 30
} = {}) {
  const safeLimit = normalizeLimit(limit);
  const safeMaxAgeDays = normalizeMaxAgeDays(maxAgeDays);

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

  return shipments.filter((shipment) =>
    isActiveShipment(shipment, safeMaxAgeDays)
  );
}

async function syncShipmentsCollection(shipments) {
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

async function syncPostNordBatch({
  limit = 20,
  includeDelivered = false
} = {}) {
  const shipments = await getBatchCandidateShipments({
    limit,
    includeDelivered
  });

  return syncShipmentsCollection(shipments);
}

async function syncActivePostNordBatch({
  limit = 20,
  maxAgeDays = 30
} = {}) {
  const safeLimit = normalizeLimit(limit);
  const safeMaxAgeDays = normalizeMaxAgeDays(maxAgeDays);

  const shipments = await getActiveBatchCandidateShipments({
    limit: safeLimit,
    maxAgeDays: safeMaxAgeDays
  });

  const summary = await syncShipmentsCollection(shipments);

  return {
    ...summary,
    mode: "active",
    filters: {
      actual_carrier: "postnord",
      delivered_excluded: true,
      failed_excluded: true,
      tracking_number_required: true,
      maxAgeDays: safeMaxAgeDays,
      limit: safeLimit
    }
  };
}

module.exports = {
  syncPostNordBatch,
  syncActivePostNordBatch
};
