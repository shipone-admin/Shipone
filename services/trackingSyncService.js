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
    console.log("❌ syncShipment eligibility failed: shipment missing");
    return {
      allowed: false,
      statusCode: 404,
      error: "Shipment not found"
    };
  }

  const actualCarrier = normalizeCarrier(shipment.actual_carrier);

  console.log("🔎 Sync eligibility check");
  console.log(
    JSON.stringify(
      {
        order_id: shipment.order_id,
        merchant_id: shipment.merchant_id,
        tracking_number: shipment.tracking_number,
        actual_carrier: shipment.actual_carrier || null
      },
      null,
      2
    )
  );

  if (!actualCarrier) {
    console.log("❌ syncShipment eligibility failed: actual carrier missing");
    return {
      allowed: false,
      statusCode: 400,
      error: "Shipment is missing actual carrier"
    };
  }

  if (!shipment.tracking_number) {
    console.log("❌ syncShipment eligibility failed: tracking number missing");
    return {
      allowed: false,
      statusCode: 400,
      error: "Shipment is missing tracking number"
    };
  }

  if (!["postnord", "dhl"].includes(actualCarrier)) {
    console.log(
      `❌ syncShipment eligibility failed: unsupported carrier ${actualCarrier}`
    );
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

  console.log(
    `🛂 Tracking policy check merchant=${merchantId} carrier=${actualCarrier} enabled=${trackingEnabled}`
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

  console.log(
    `📡 fetchCarrierTracking called for carrier=${actualCarrier} tracking=${shipment?.tracking_number || "-"}`
  );

  if (actualCarrier === "postnord") {
    console.log("📡 Using PostNord tracking fetcher");
    return fetchPostNordTracking(shipment.tracking_number);
  }

  if (actualCarrier === "dhl") {
    console.log("📡 Using DHL tracking fetcher");
    return fetchDHLTracking(shipment.tracking_number);
  }

  return {
    success: false,
    error: `Unsupported carrier for tracking fetch: ${actualCarrier}`
  };
}

async function syncShipment(shipment) {
  console.log(
    `🚚 syncShipment start order=${shipment?.order_id || "-"} carrier=${shipment?.actual_carrier || "-"}`
  );

  const eligibility = await canSyncTrackingForShipment(shipment);

  if (!eligibility.allowed) {
    console.log(
      `⛔ syncShipment blocked status=${eligibility.statusCode} error=${eligibility.error}`
    );

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

  console.log(
    "📦 carrierTracking result:",
    JSON.stringify(
      {
        success: carrierTracking?.success || false,
        skipped: carrierTracking?.skipped || false,
        reason: carrierTracking?.reason || null,
        error: carrierTracking?.error || null,
        statusText: carrierTracking?.statusText || null,
        eventCount: carrierTracking?.eventCount || 0
      },
      null,
      2
    )
  );

  if (!carrierTracking.success) {
    console.log("❌ syncShipment failed before snapshot save");
    return {
      success: false,
      skipped: false,
      skipReason: null,
      statusCode: 502,
      error:
        carrierTracking.error ||
        carrierTracking.reason ||
        "Carrier tracking fetch failed",
      shipment,
      carrierTracking
    };
  }

  await saveCarrierTrackingSnapshot(shipment.id, carrierTracking);

  const updatedShipment = await reloadShipmentById(shipment.id);

  console.log(
    `✅ syncShipment success order=${shipment.order_id} carrier=${eligibility.carrier}`
  );

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
  console.log(`🔁 syncTrackingByOrderId called orderId=${orderId}`);

  const shipment = await findShipmentByOrderId(orderId);

  if (!shipment) {
    console.log("❌ syncTrackingByOrderId: shipment not found");
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
  console.log(
    `🔁 syncTrackingByTrackingNumber called trackingNumber=${trackingNumber}`
  );

  const shipment = await findShipmentByTrackingNumber(trackingNumber);

  if (!shipment) {
    console.log("❌ syncTrackingByTrackingNumber: shipment not found");
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
  console.log(`🔁 syncPostNordTrackingByOrderId called orderId=${orderId}`);

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
    console.log(
      `❌ syncPostNordTrackingByOrderId wrong carrier actual=${actualCarrier}`
    );
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
  console.log(
    `🔁 syncPostNordTrackingByTrackingNumber called trackingNumber=${trackingNumber}`
  );

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
    console.log(
      `❌ syncPostNordTrackingByTrackingNumber wrong carrier actual=${actualCarrier}`
    );
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
