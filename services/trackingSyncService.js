const { query } = require("./db");
const { fetchPostNordTracking } = require("./postnordTracking");
const { fetchDHLTracking } = require("./dhlTracking");
const { saveCarrierTrackingSnapshot } = require("./trackingSyncStore");
const { getDisplayStatus } = require("./trackingStatus");
const { buildTrackingEvents } = require("./trackingEvents");

async function findShipmentByTrackingNumber(trackingNumber) {
  const result = await query(
    `
      SELECT *
      FROM shipments
      WHERE tracking_number = $1
      LIMIT 1
    `,
    [trackingNumber]
  );

  return result.rows[0] || null;
}

async function findShipmentByOrderId(orderId) {
  const result = await query(
    `
      SELECT *
      FROM shipments
      WHERE order_id = $1
      LIMIT 1
    `,
    [orderId]
  );

  return result.rows[0] || null;
}

async function fetchCarrierTrackingForShipment(shipment) {
  const actualCarrier = String(shipment?.actual_carrier || "").toLowerCase();

  if (actualCarrier === "postnord") {
    return fetchPostNordTracking(shipment.tracking_number);
  }

  if (actualCarrier === "dhl") {
    return fetchDHLTracking(shipment.tracking_number);
  }

  return {
    success: false,
    skipped: true,
    reason: "Manual live tracking sync is only supported for PostNord and DHL shipments",
    events: [],
    statusText: shipment?.carrier_status_text || null,
    eventCount: shipment?.carrier_event_count || 0,
    latestEventAt: shipment?.carrier_last_event_at || null
  };
}

async function syncPostNordTrackingForShipment(shipment) {
  if (!shipment) {
    return {
      success: false,
      statusCode: 404,
      error: "Shipment not found"
    };
  }

  const actualCarrier = String(shipment.actual_carrier || "").toLowerCase();

  if (actualCarrier !== "postnord" && actualCarrier !== "dhl") {
    return {
      success: false,
      statusCode: 400,
      error: "Manual live tracking sync is only supported for PostNord and DHL shipments",
      shipment: {
        id: shipment.id,
        order_id: shipment.order_id,
        tracking_number: shipment.tracking_number,
        actual_carrier: shipment.actual_carrier
      }
    };
  }

  if (!shipment.tracking_number) {
    return {
      success: false,
      statusCode: 400,
      error: "Shipment is missing tracking number",
      shipment: {
        id: shipment.id,
        order_id: shipment.order_id,
        actual_carrier: shipment.actual_carrier
      }
    };
  }

  const carrierTracking = await fetchCarrierTrackingForShipment(shipment);
  const snapshot = await saveCarrierTrackingSnapshot(shipment.id, carrierTracking);

  const refreshedResult = await query(
    `
      SELECT *
      FROM shipments
      WHERE id = $1
      LIMIT 1
    `,
    [shipment.id]
  );

  const refreshedShipment = refreshedResult.rows[0] || shipment;

  const displayStatus = getDisplayStatus({
    shipment: refreshedShipment,
    carrierTracking
  });

  const events = buildTrackingEvents({
    shipment: refreshedShipment,
    externalEvents: carrierTracking.events,
    externalSource: actualCarrier
  });

  return {
    success: true,
    statusCode: 200,
    shipment: {
      id: refreshedShipment.id,
      order_id: refreshedShipment.order_id,
      order_name: refreshedShipment.order_name,
      tracking_number: refreshedShipment.tracking_number,
      actual_carrier: refreshedShipment.actual_carrier,
      carrier_status_text: refreshedShipment.carrier_status_text,
      carrier_last_event_at: refreshedShipment.carrier_last_event_at,
      carrier_event_count: refreshedShipment.carrier_event_count,
      carrier_last_synced_at: refreshedShipment.carrier_last_synced_at,
      carrier_next_sync_at: refreshedShipment.carrier_next_sync_at,
      carrier_sync_attempts: refreshedShipment.carrier_sync_attempts,
      carrier_last_sync_status: refreshedShipment.carrier_last_sync_status
    },
    carrierTracking: {
      success: carrierTracking.success,
      skipped: carrierTracking.skipped,
      reason: carrierTracking.reason,
      statusText: carrierTracking.statusText,
      eventCount: carrierTracking.eventCount,
      latestEventAt: carrierTracking.latestEventAt
    },
    snapshot,
    displayStatus,
    events
  };
}

async function syncPostNordTrackingByTrackingNumber(trackingNumber) {
  const shipment = await findShipmentByTrackingNumber(trackingNumber);
  return syncPostNordTrackingForShipment(shipment);
}

async function syncPostNordTrackingByOrderId(orderId) {
  const shipment = await findShipmentByOrderId(orderId);
  return syncPostNordTrackingForShipment(shipment);
}

module.exports = {
  syncPostNordTrackingForShipment,
  syncPostNordTrackingByTrackingNumber,
  syncPostNordTrackingByOrderId
};
