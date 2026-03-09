// ================================
// SHIPONE UNIVERSAL SHIPMENT HANDLER
// ================================

const { createPostNordShipment } = require("../postnordShipment");
const { createDHLShipment } = require("../carriers/dhl.service");

async function createShipment(order) {
  console.log("🚚 ShipOne creating shipment...");

  // ---------------------------
  // TRY POSTNORD FIRST
  // ---------------------------
  try {
    console.log("📡 Trying PostNord...");

    const result = await createPostNordShipment(order);

    console.log("✅ PostNord shipment created");

    return {
      carrier: "postnord",
      success: true,
      data: result
    };
  } catch (error) {
    console.log("❌ PostNord failed — activating fallback");
    console.log("Reason:", error.message);
  }

  // ---------------------------
  // FALLBACK → DHL
  // ---------------------------
  try {
    console.log("📡 Trying DHL fallback...");

    const dhlResult = await createDHLShipment(order);

    console.log("✅ DHL fallback shipment created");

    return {
      carrier: "dhl",
      fallbackUsed: true,
      success: true,
      data: dhlResult
    };
  } catch (fallbackError) {
    console.log("❌ DHL also failed");
    console.log("Reason:", fallbackError.message);

    return {
      success: false,
      error: "All carriers failed",
      details: fallbackError.message
    };
  }
}

module.exports = { createShipment };
