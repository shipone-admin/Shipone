// ================================
// SHIPONE UNIVERSAL SHIPMENT HANDLER
// CARRIER-CONFIG + MERCHANT SETTINGS VERSION
// SAFE BUDBEE FALLBACK VERSION
// ================================

const { createPostNordShipment } = require("../postnordShipment");
const { createDHLShipment } = require("../carriers/dhl.service");
const { createShipment: createBudbeeMockShipment } = require("../carriers/budbee.mock");

const {
  canUseCarrierForShipment,
  getEnabledShipmentCarriers
} = require("./carrierConfig");

const {
  normalizeMerchantId,
  getEnabledShipmentCarriersForMerchant
} = require("./merchantCarrierSettings");

async function tryPostNord(order) {
  console.log("📡 Trying PostNord...");

  const result = await createPostNordShipment(order);

  console.log("✅ PostNord shipment created");

  return {
    carrier: "postnord",
    success: true,
    data: result
  };
}

async function tryDHL(order) {
  console.log("📡 Trying DHL...");

  const result = await createDHLShipment(order);

  console.log("✅ DHL shipment created");

  return {
    carrier: "dhl",
    success: true,
    data: result
  };
}

async function tryBudbee(order) {
  console.log("📡 Trying Budbee...");

  const result = await createBudbeeMockShipment(order);

  if (!result || result.success !== true || !result.data) {
    throw new Error("Budbee mock shipment failed");
  }

  console.log("✅ Budbee shipment created");

  return {
    carrier: "budbee",
    success: true,
    data: result.data
  };
}

async function runCarrierAttempt(carrier, order) {
  if (!canUseCarrierForShipment(carrier)) {
    throw new Error(`Carrier disabled for shipment: ${carrier}`);
  }

  if (carrier === "postnord") {
    return await tryPostNord(order);
  }

  if (carrier === "dhl") {
    return await tryDHL(order);
  }

  if (carrier === "budbee") {
    return await tryBudbee(order);
  }

  throw new Error(`Unsupported carrier: ${carrier}`);
}

async function buildMerchantAllowedCarrierChain(merchantId) {
  const globallyEnabledCarriers = getEnabledShipmentCarriers();
  const merchantEnabledCarriers = await getEnabledShipmentCarriersForMerchant(
    merchantId
  );

  return globallyEnabledCarriers.filter((carrier) =>
    merchantEnabledCarriers.includes(carrier)
  );
}

function buildFallbackChain(preferredCarrier, allowedCarriers) {
  return allowedCarriers.filter((carrier) => carrier !== preferredCarrier);
}

async function createShipment(order, selectedOption, merchantContext = {}) {
  console.log("🚚 ShipOne creating shipment...");

  if (!selectedOption || !selectedOption.carrier) {
    return {
      success: false,
      carrier: null,
      selected_carrier: null,
      selected_service: null,
      fallbackUsed: false,
      fallbackFrom: null,
      error: "Missing selected shipping option or carrier"
    };
  }

  const merchantId = normalizeMerchantId(merchantContext.merchant_id);
  const preferredCarrier = String(selectedOption.carrier).toLowerCase();
  const selectedService = selectedOption.name || null;

  console.log("🏪 Shipment merchant:", merchantId);
  console.log("🎯 Preferred carrier:", preferredCarrier);
  console.log("🎯 Preferred service:", selectedService || "Unknown");

  const allowedCarriers = await buildMerchantAllowedCarrierChain(merchantId);

  console.log(
    "🧩 Merchant-allowed shipment carriers:",
    allowedCarriers.join(" -> ") || "none"
  );

  if (!allowedCarriers.includes(preferredCarrier)) {
    console.log(
      `⛔ Preferred carrier blocked by merchant settings: ${preferredCarrier}`
    );
  }

  const fallbackChain = buildFallbackChain(preferredCarrier, allowedCarriers);

  console.log("🛟 Fallback chain:", fallbackChain.join(" -> ") || "none");

  if (allowedCarriers.includes(preferredCarrier)) {
    try {
      const preferredResult = await runCarrierAttempt(preferredCarrier, order);

      return {
        ...preferredResult,
        selected_carrier: preferredCarrier,
        selected_service: selectedService,
        fallbackUsed: false,
        fallbackFrom: null,
        merchant_id: merchantId
      };
    } catch (error) {
      console.log(`❌ ${preferredCarrier.toUpperCase()} failed — activating fallback`);
      console.log("Reason:", error.message);
    }
  }

  for (const fallbackCarrier of fallbackChain) {
    try {
      console.log(`📡 Trying fallback carrier: ${fallbackCarrier}`);

      const fallbackResult = await runCarrierAttempt(fallbackCarrier, order);

      return {
        ...fallbackResult,
        selected_carrier: preferredCarrier,
        selected_service: selectedService,
        fallbackUsed: true,
        fallbackFrom: preferredCarrier,
        merchant_id: merchantId
      };
    } catch (fallbackError) {
      console.log(`❌ ${fallbackCarrier.toUpperCase()} also failed`);
      console.log("Reason:", fallbackError.message);
    }
  }

  if (allowedCarriers.length === 0) {
    return {
      success: false,
      carrier: null,
      selected_carrier: preferredCarrier,
      selected_service: selectedService,
      fallbackUsed: false,
      fallbackFrom: null,
      merchant_id: merchantId,
      error: `No shipment carriers enabled for merchant: ${merchantId}`
    };
  }

  if (!allowedCarriers.includes(preferredCarrier) && fallbackChain.length === 0) {
    return {
      success: false,
      carrier: null,
      selected_carrier: preferredCarrier,
      selected_service: selectedService,
      fallbackUsed: false,
      fallbackFrom: null,
      merchant_id: merchantId,
      error: `Preferred carrier disabled for merchant and no fallback carriers available: ${preferredCarrier}`
    };
  }

  return {
    success: false,
    carrier: null,
    selected_carrier: preferredCarrier,
    selected_service: selectedService,
    fallbackUsed: false,
    fallbackFrom: null,
    merchant_id: merchantId,
    error: "All enabled carriers failed"
  };
}

module.exports = { createShipment };
