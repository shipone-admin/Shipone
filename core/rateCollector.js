// ================================
// SHIPONE RATE COLLECTOR
// CARRIER-CONFIG VERSION
// ================================

const {
  canUseCarrierForRates,
  getEnabledRateCarriers
} = require("../services/carrierConfig");

const postnordRates = require("../carriers/postnord.mock");
const dhlRates = require("../carriers/dhl.mock");
const budbeeRates = require("../carriers/budbee.mock");

async function collectRates(order) {
  const allRates = [];
  const enabledRateCarriers = getEnabledRateCarriers();

  console.log("📦 Enabled rate carriers:", enabledRateCarriers.join(", ") || "none");

  if (canUseCarrierForRates("postnord")) {
    try {
      const postnord = await postnordRates(order);

      if (Array.isArray(postnord)) {
        allRates.push(...postnord);
      } else if (postnord) {
        allRates.push(postnord);
      }
    } catch (error) {
      console.log("❌ PostNord rates failed");
      console.log("Reason:", error.message);
    }
  } else {
    console.log("⏭ Skipping PostNord rates (disabled)");
  }

  if (canUseCarrierForRates("dhl")) {
    try {
      const dhl = await dhlRates(order);

      if (Array.isArray(dhl)) {
        allRates.push(...dhl);
      } else if (dhl) {
        allRates.push(dhl);
      }
    } catch (error) {
      console.log("❌ DHL rates failed");
      console.log("Reason:", error.message);
    }
  } else {
    console.log("⏭ Skipping DHL rates (disabled)");
  }

  if (canUseCarrierForRates("budbee")) {
    try {
      const budbee = await budbeeRates(order);

      if (Array.isArray(budbee)) {
        allRates.push(...budbee);
      } else if (budbee) {
        allRates.push(budbee);
      }
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
