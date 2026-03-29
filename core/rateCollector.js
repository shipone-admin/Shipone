// ================================
// SHIPONE RATE COLLECTOR
// CARRIER-CONFIG VERSION
// COMMONJS SAFE VERSION
// SAFE BUDBEE FALLBACK VERSION
// ================================

const {
  canUseCarrierForRates,
  getEnabledRateCarriers
} = require("../services/carrierConfig");

const { getRates: getPostNordRates } = require("../carriers/postnord.mock");
const { getRates: getDHLRates } = require("../carriers/dhl.mock");

function pushRates(allRates, incomingRates) {
  if (Array.isArray(incomingRates)) {
    allRates.push(...incomingRates);
    return;
  }

  if (incomingRates) {
    allRates.push(incomingRates);
  }
}

function normalizeCarrierRates(carrierKey, incomingRates) {
  const list = Array.isArray(incomingRates)
    ? incomingRates
    : incomingRates
      ? [incomingRates]
      : [];

  return list.map((rate) => {
    return {
      ...rate,
      carrier: String(rate?.carrier || carrierKey).trim().toLowerCase()
    };
  });
}

function loadBudbeeRateProvider() {
  try {
    const budbeeService = require("../carriers/budbee.service");

    if (typeof budbeeService.getBudbeeRates === "function") {
      return {
        source: "service",
        getRates: budbeeService.getBudbeeRates
      };
    }
  } catch (error) {
    console.log("🟡 Budbee service rate provider not available");
    console.log("Reason:", error.message);
  }

  try {
    const budbeeMock = require("../carriers/budbee.mock");

    if (typeof budbeeMock.getRates === "function") {
      return {
        source: "mock",
        getRates: budbeeMock.getRates
      };
    }
  } catch (error) {
    console.log("❌ Budbee mock rate provider failed to load");
    console.log("Reason:", error.message);
  }

  return {
    source: "none",
    getRates: null
  };
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
      pushRates(allRates, normalizeCarrierRates("postnord", postnordRates));
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
      pushRates(allRates, normalizeCarrierRates("dhl", dhlRates));
    } catch (error) {
      console.log("❌ DHL rates failed");
      console.log("Reason:", error.message);
    }
  } else {
    console.log("⏭ Skipping DHL rates (disabled)");
  }

  if (canUseCarrierForRates("budbee")) {
    try {
      const budbeeProvider = loadBudbeeRateProvider();

      if (!budbeeProvider.getRates) {
        throw new Error("No Budbee rate provider is available");
      }

      console.log(`📦 Budbee rate provider: ${budbeeProvider.source}`);

      const budbeeRates = await budbeeProvider.getRates(order);
      pushRates(allRates, normalizeCarrierRates("budbee", budbeeRates));
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
