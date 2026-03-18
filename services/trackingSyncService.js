const { query } = require("./db");
const { fetchPostNordTracking } = require("./postnordTracking");
const { fetchDHLTracking } = require("./dhlTracking");
const { saveCarrierTrackingSnapshot } = require("./trackingSyncStore");
const {
  isTrackingCarrierEnabledForMerchant
} = require("./merchantCarrierSettings");

function normalizeOrderId(value) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeTrackingNumber(value) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeCarrier(value) {
  return String(value || "").trim().toLowerCase();
}

function getCarrierLabel(carrier) {
  const normalized = normalizeCarrier(carrier);

  if (normalized === "postnord") return "PostNord";
  if (normalized === "dhl") return "DHL";
  if (normalized === "budbee") return "Budbee";

  return carrier || "carrier";
}

async function findShipmentByOrderId(orderId) {
  const safeOrderId = normalizeOrderId(orderId);

  if (!safeOrderId) {
    return null;
  }

  const result = await query(
    `
      SELECT *
      FROM shipments
      WHERE order_id = $1
      LIMIT 1
    `,
    [safeOrderId]
  );

  return result.rows[0] || null;
}

async function findShipmentByTrackingNumber(trackingNumber) {
  const safeTrackingNumber = normalizeTrackingNumber(trackingNumber);

  if (!safeTrackingNumber) {
    return null;
  }

  const result = await query(
    `
      SELECT *
      FROM shipments
      WHERE tracking_number = $1
      ORDER BY id DESC
      LIMIT 1
    `,
    [safeTrackingNumber]
  );

  return result.rows[0] || null;
}

async function reloadShipmentById(id) {
  const result = await query(
    `
      SELECT *
      FROM shipments
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function markTrackingDisabledForShipment(shipment, reason) {
  if (!shipment?.id) {
    return;
  }

  await query(
    `
      UPDATE shipments
      SET
        carrier_last_sync_status = $2,
        carrier_last_synced_at = NOW(),
        carrier_next_sync_at = NULL,
        updated_at = NOW()
      WHERE id = $1
    `,
    [shipment.id, reason || "disabled_by_merchant"]
  );
}

async function canSyncTrackingForShipment(shipment) {
  if (!shipment) {
    return {
      allowed: false,
      statusCode: 404,
      error: "Shipment not found"
    };
  }

  const actualCarrier = normalizeCarrier(shipment.actual_carrier);

  if (!actualCarrier) {
    return {
      allowed: false,
      statusCode: 400,
      error: "Shipment is missing actual carrier"
    };
  }

  if (!shipment.tracking_number) {
    return {
      allowed: false,
      statusCode: 400,
      error: "Shipment is missing tracking number"
    };
  }

  if (!["postnord", "dhl"].includes(actualCarrier)) {
    return {
      allowed: false,
      statusCode: 400,
      error: `Tracking sync does not support carrier ${actualCarrier}`
    };
  }

  const merchantId = String(shipment.merchant_id || "default")
    .trim()
    .toLowerCase();

  const trackingEnabled = await isTrackingCarrierEnabledForMerchant(
    merchantId,
    actualCarrier
  );

  if (!trackingEnabled) {
    return {
      allowed: false,
      statusCode: 403,
      error: `Tracking is disabled for merchant ${merchantId} and carrier ${actualCarrier}`,
      skipReason: "disabled_by_merchant",
      carrier: actualCarrier
    };
  }

  return {
    allowed: true,
    statusCode: 200,
    carrier: actualCarrier
  };
}

async function fetchCarrierTracking(shipment) {
  const actualCarrier = normalizeCarrier(shipment?.actual_carrier);

  if (actualCarrier === "postnord") {
    return fetchPostNordTracking(shipment.tracking_number);
  }

  if (actualCarrier === "dhl") {
    return fetchDHLTracking(shipment.tracking_number);
  }

  return {
    success: false,
    error: `Unsupported carrier for tracking fetch: ${actualCarrier}`
  };
}

async function syncShipment(shipment) {
  const eligibility = await canSyncTrackingForShipment(shipment);

  if (!eligibility.allowed) {
    if (eligibility.statusCode === 403) {
      await markTrackingDisabledForShipment(shipment, "disabled_by_merchant");
    }

    return {
      success: false,
      skipped: eligibility.statusCode === 403,
      skipReason: eligibility.skipReason || null,
      statusCode: eligibility.statusCode,
      error: eligibility.error,
      shipment
    };
  }

  const carrierTracking = await fetchCarrierTracking(shipment);

  if (!carrierTracking.success) {
    return {
      success: false,
      skipped: false,
      skipReason: null,
      statusCode: 502,
      error:
        carrierTracking.error ||
        `${getCarrierLabel(eligibility.carrier)} tracking fetch failed`,
      shipment,
      carrierTracking
    };
  }

  await saveCarrierTrackingSnapshot(shipment.id, carrierTracking);

  const updatedShipment = await reloadShipmentById(shipment.id);

  return {
    success: true,
    skipped: false,
    skipReason: null,
    statusCode: 200,
    shipment: updatedShipment || shipment,
    carrierTracking,
    syncedAt: new Date().toISOString()
  };
}

async function syncTrackingByOrderId(orderId) {
  const shipment = await findShipmentByOrderId(orderId);

  if (!shipment) {
    return {
      success: false,
      skipped: false,
      skipReason: null,
      statusCode: 404,
      error: "Shipment not found for order id"
    };
  }

  return syncShipment(shipment);
}

async function syncTrackingByTrackingNumber(trackingNumber) {
  const shipment = await findShipmentByTrackingNumber(trackingNumber);

  if (!shipment) {
    return {
      success: false,
      skipped: false,
      skipReason: null,
      statusCode: 404,
      error: "Shipment not found for tracking number"
    };
  }

  return syncShipment(shipment);
}

async function syncPostNordTrackingByOrderId(orderId) {
  const shipment = await findShipmentByOrderId(orderId);

  if (!shipment) {
    return {
      success: false,
      skipped: false,
      skipReason: null,
      statusCode: 404,
      error: "Shipment not found for order id"
    };
  }

  const actualCarrier = normalizeCarrier(shipment.actual_carrier);

  if (actualCarrier !== "postnord") {
    return {
      success: false,
      skipped: false,
      skipReason: null,
      statusCode: 400,
      error: `Shipment carrier is ${actualCarrier || "unknown"}, not postnord`
    };
  }

  return syncShipment(shipment);
}

async function syncPostNordTrackingByTrackingNumber(trackingNumber) {
  const shipment = await findShipmentByTrackingNumber(trackingNumber);

  if (!shipment) {
    return {
      success: false,
      skipped: false,
      skipReason: null,
      statusCode: 404,
      error: "Shipment not found for tracking number"
    };
  }

  const actualCarrier = normalizeCarrier(shipment.actual_carrier);

  if (actualCarrier !== "postnord") {
    return {
      success: false,
      skipped: false,
      skipReason: null,
      statusCode: 400,
      error: `Shipment carrier is ${actualCarrier || "unknown"}, not postnord`
    };
  }

  return syncShipment(shipment);
}

module.exports = {
  syncTrackingByTrackingNumber,
  syncTrackingByOrderId,
  syncPostNordTrackingByTrackingNumber,
  syncPostNordTrackingByOrderId
};
