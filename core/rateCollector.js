// ================================
// SHIPONE RATE COLLECTOR
// CARRIER-CONFIG VERSION
// COMMONJS SAFE VERSION
// ================================

const {
  canUseCarrierForRates,
  getEnabledRateCarriers
} = require("../services/carrierConfig");

const { getRates: getPostNordRates } = require("../carriers/postnord.mock");
const { getRates: getDHLRates } = require("../carriers/dhl.mock");
const { getRates: getBudbeeRates } = require("../carriers/budbee.mock");

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
      const postnordRates = await getPostNordRates(order);
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
      const dhlRates = await getDHLRates(order);
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
      const budbeeRates = await getBudbeeRates(order);
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
