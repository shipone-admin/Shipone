const { query } = require("./db");

function normalizeDateValue(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function minutesFromNow(minutes) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

function calculateNextSync(statusText = "") {
  const status = String(statusText || "").toLowerCase().trim();

  if (
    status.includes("levererad") ||
    status.includes("delivered") ||
    status.includes("utlämnad")
  ) {
    return null;
  }

  if (
    status.includes("utkörning") ||
    status.includes("out for delivery")
  ) {
    return minutesFromNow(10);
  }

  if (
    status.includes("transport") ||
    status.includes("in transit")
  ) {
    return minutesFromNow(30);
  }

  if (
    status.includes("registrerad") ||
    status.includes("inväntar försändelse") ||
    status.includes("registered")
  ) {
    return minutesFromNow(60);
  }

  return minutesFromNow(30);
}

async function saveCarrierTrackingSnapshot(shipmentId, carrierTracking = {}) {
  const statusText = carrierTracking.statusText || null;
  const latestEventAt = normalizeDateValue(carrierTracking.latestEventAt);
  const eventCount = Number(carrierTracking.eventCount || 0);
  const syncSuccess = Boolean(carrierTracking.success);
  const nextSyncAtDate = calculateNextSync(statusText);
  const nextSyncAt = nextSyncAtDate ? nextSyncAtDate.toISOString() : null;
  const lastSyncStatus = syncSuccess ? "success" : "failed";

  const result = await query(
    `
      UPDATE shipments
      SET
        carrier_status_text = $2,
        carrier_last_event_at = $3,
        carrier_event_count = $4,
        carrier_last_synced_at = NOW(),
        carrier_next_sync_at = $5,
        carrier_sync_attempts = COALESCE(carrier_sync_attempts, 0) + 1,
        carrier_last_sync_status = $6,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        order_id,
        tracking_number,
        carrier_status_text,
        carrier_last_event_at,
        carrier_event_count,
        carrier_last_synced_at,
        carrier_next_sync_at,
        carrier_sync_attempts,
        carrier_last_sync_status
    `,
    [
      shipmentId,
      statusText,
      latestEventAt,
      eventCount,
      nextSyncAt,
      lastSyncStatus
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  saveCarrierTrackingSnapshot
};
