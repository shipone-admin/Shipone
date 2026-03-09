// ================================
// SHIPONE UNIVERSAL SHIPMENT HANDLER
// CARRIER-CONFIG VERSION
// ================================

const { createPostNordShipment } = require("../postnordShipment");
const { createDHLShipment } = require("../carriers/dhl.service");

const {
  canUseCarrierForShipment,
  getEnabledShipmentCarriers
} = require("./carrierConfig");

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

  throw new Error("Budbee shipment service is not implemented yet");
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

function buildFallbackChain(preferredCarrier) {
  const enabledShipmentCarriers = getEnabledShipmentCarriers();

  return enabledShipmentCarriers.filter(
    (carrier) => carrier !== preferredCarrier
  );
}

async function createShipment(order, selectedOption) {
  console.log("🚚 ShipOne creating shipment...");

  if (!selectedOption || !selectedOption.carrier) {
    return {
      success: false,
      error: "Missing selected shipping option or carrier"
    };
  }

  const preferredCarrier = String(selectedOption.carrier).toLowerCase();

  console.log("🎯 Preferred carrier:", preferredCarrier);
  console.log("🎯 Preferred service:", selectedOption.name || "Unknown");

  const fallbackChain = buildFallbackChain(preferredCarrier);

  console.log("🛟 Fallback chain:", fallbackChain.join(" -> ") || "none");

  // 1) Try preferred carrier first
  try {
    const preferredResult = await runCarrierAttempt(preferredCarrier, order);

    return {
      ...preferredResult,
      selected_carrier: preferredCarrier,
      selected_service: selectedOption.name || null,
      fallbackUsed: false
    };
  } catch (error) {
    console.log(`❌ ${preferredCarrier.toUpperCase()} failed — activating fallback`);
    console.log("Reason:", error.message);
  }

  // 2) Try enabled fallback carriers only
  for (const fallbackCarrier of fallbackChain) {
    try {
      console.log(`📡 Trying fallback carrier: ${fallbackCarrier}`);

      const fallbackResult = await runCarrierAttempt(fallbackCarrier, order);

      return {
        ...fallbackResult,
        selected_carrier: preferredCarrier,
        selected_service: selectedOption.name || null,
        fallbackUsed: true,
        fallbackFrom: preferredCarrier
      };
    } catch (fallbackError) {
      console.log(`❌ ${fallbackCarrier.toUpperCase()} also failed`);
      console.log("Reason:", fallbackError.message);
    }
  }

  return {
    success: false,
    selected_carrier: preferredCarrier,
    selected_service: selectedOption.name || null,
    error: "All enabled carriers failed"
  };
}

module.exports = { createShipment };
