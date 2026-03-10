const { query } = require("./db");

function toIsoOrNull(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function getLatestEventTime(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return null;
  }

  const timestamps = events
    .map((event) => toIsoOrNull(event?.occurredAt))
    .filter(Boolean)
    .sort();

  return timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;
}

async function saveCarrierTrackingSnapshot(shipmentId, carrierTracking) {
  if (!shipmentId || !carrierTracking) {
    return null;
  }

  const statusText = carrierTracking.statusText || null;
  const eventCount = Array.isArray(carrierTracking.events)
    ? carrierTracking.events.length
    : 0;
  const latestEventAt = getLatestEventTime(carrierTracking.events);
  const syncedAt = new Date().toISOString();

  const result = await query(
    `
      UPDATE shipments
      SET
        carrier_status_text = $2,
        carrier_last_event_at = $3,
        carrier_event_count = $4,
        carrier_last_synced_at = $5,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        order_id,
        tracking_number,
        carrier_status_text,
        carrier_last_event_at,
        carrier_event_count,
        carrier_last_synced_at
    `,
    [shipmentId, statusText, latestEventAt, eventCount, syncedAt]
  );

  return result.rows[0] || null;
}

module.exports = {
  saveCarrierTrackingSnapshot
};
