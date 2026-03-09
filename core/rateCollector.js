// ================================
// SHIPONE RATE COLLECTOR
// CARRIER-CONFIG VERSION
// MATCHED TO CURRENT MOCK EXPORTS
// ================================

const {
  canUseCarrierForRates,
  getEnabledRateCarriers
} = require("../services/carrierConfig");

const { getRates: getPostNordRates } = require("../carriers/postnord.mock");

async function loadDHLRates(order) {
  const dhlModule = await import("../carriers/dhl.mock.js");
  return await dhlModule.default.getRates(order);
}

async function loadBudbeeRates(order) {
  const budbeeModule = await import("../carriers/budbee.mock.js");
  return await budbeeModule.default.getRates(order);
}

function pushRates(allRates, incomingRates) {
  if (Array.isArray(incomingRates)) {
    allRates.push(...incomingRates);
    return;
  }

  if (incomingRates) {
    allRates.push(incomingRates);
  }
}

async function collectRates(order) {
  const allRates = [];
  const enabledRateCarriers = getEnabledRateCarriers();

  console.log(
    "📦 Enabled rate carriers:",
    enabledRateCarriers.length ? enabledRateCarriers.join(", ") : "none"
  );

  if (canUseCarrierForRates("postnord")) {
    try {
      const postnordRates = getPostNordRates(order);
      pushRates(allRates, postnordRates);
    } catch (error) {
      console.log("❌ PostNord rates failed");
      console.log("Reason:", error.message);
    }
  } else {
    console.log("⏭ Skipping PostNord rates (disabled)");
  }

  if (canUseCarrierForRates("dhl")) {
    try {
      const dhlRates = await loadDHLRates(order);
      pushRates(allRates, dhlRates);
    } catch (error) {
      console.log("❌ DHL rates failed");
      console.log("Reason:", error.message);
    }
  } else {
    console.log("⏭ Skipping DHL rates (disabled)");
  }

  if (canUseCarrierForRates("budbee")) {
    try {
      const budbeeRates = await loadBudbeeRates(order);
      pushRates(allRates, budbeeRates);
    } catch (error) {
      console.log("❌ Budbee rates failed");
      console.log("Reason:", error.message);
    }
  } else {
    console.log("⏭ Skipping Budbee rates (disabled)");
  }

  console.log("📊 Total collected rates:", allRates.length);

  return allRates;
}

module.exports = { collectRates };
