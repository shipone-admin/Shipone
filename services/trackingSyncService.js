const { query } = require("./db");
const { fetchPostNordTracking } = require("./postnordTracking");
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

async function canSyncPostNordTrackingForShipment(shipment) {
  if (!shipment) {
    return {
      allowed: false,
      statusCode: 404,
      error: "Shipment not found"
    };
  }

  const actualCarrier = String(shipment.actual_carrier || "").toLowerCase();

  if (actualCarrier !== "postnord") {
    return {
      allowed: false,
      statusCode: 400,
      error: "Tracking sync only supports PostNord shipments"
    };
  }

  if (!shipment.tracking_number) {
    return {
      allowed: false,
      statusCode: 400,
      error: "Shipment is missing tracking number"
    };
  }

  const merchantId = String(shipment.merchant_id || "default").trim().toLowerCase();

  const trackingEnabled = await isTrackingCarrierEnabledForMerchant(
    merchantId,
    "postnord"
  );

  if (!trackingEnabled) {
    return {
      allowed: false,
      statusCode: 403,
      error: `Tracking is disabled for merchant ${merchantId} and carrier postnord`
    };
  }

  return {
    allowed: true,
    statusCode: 200
  };
}

async function syncShipment(shipment) {
  const eligibility = await canSyncPostNordTrackingForShipment(shipment);

  if (!eligibility.allowed) {
    if (eligibility.statusCode === 403) {
      await markTrackingDisabledForShipment(shipment, "disabled_by_merchant");
    }

    return {
      success: false,
      statusCode: eligibility.statusCode,
      error: eligibility.error,
      shipment
    };
  }

  const carrierTracking = await fetchPostNordTracking(shipment.tracking_number);

  if (!carrierTracking.success) {
    return {
      success: false,
      statusCode: 502,
      error: carrierTracking.error || "PostNord tracking fetch failed",
      shipment,
      carrierTracking
    };
  }

  await saveCarrierTrackingSnapshot(shipment.id, carrierTracking);

  const updatedShipment = await reloadShipmentById(shipment.id);

  return {
    success: true,
    statusCode: 200,
    shipment: updatedShipment || shipment,
    carrierTracking,
    syncedAt: new Date().toISOString()
  };
}

async function syncPostNordTrackingByOrderId(orderId) {
  const shipment = await findShipmentByOrderId(orderId);

  if (!shipment) {
    return {
      success: false,
      statusCode: 404,
      error: "Shipment not found for order id"
    };
  }

  return syncShipment(shipment);
}

async function syncPostNordTrackingByTrackingNumber(trackingNumber) {
  const shipment = await findShipmentByTrackingNumber(trackingNumber);

  if (!shipment) {
    return {
      success: false,
      statusCode: 404,
      error: "Shipment not found for tracking number"
    };
  }

  return syncShipment(shipment);
}

module.exports = {
  syncPostNordTrackingByTrackingNumber,
  syncPostNordTrackingByOrderId
};
