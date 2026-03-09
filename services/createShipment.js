// ================================
// SHIPONE UNIVERSAL SHIPMENT HANDLER
// CARRIER-AWARE VERSION
// ================================

const { createPostNordShipment } = require("../postnordShipment");
const { createDHLShipment } = require("../carriers/dhl.service");

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

function buildFallbackChain(preferredCarrier) {
  const allCarriers = ["postnord", "dhl", "budbee"];
  return allCarriers.filter((carrier) => carrier !== preferredCarrier);
}

async function runCarrierAttempt(carrier, order) {
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

  console.log("🛟 Fallback chain:", fallbackChain.join(" -> "));

  // ---------------------------
  // 1) TRY SELECTED CARRIER FIRST
  // ---------------------------
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

  // ---------------------------
  // 2) FALLBACK CHAIN
  // ---------------------------
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
    error: "All carriers failed"
  };
}

module.exports = { createShipment };
