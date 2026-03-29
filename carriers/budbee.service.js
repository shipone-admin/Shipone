// =====================================================
// BUDBEE SERVICE (MOCK → PRODUCTION READY STRUCTURE)
// =====================================================

function getBudbeeConfig() {
  return {
    carrier: "budbee",
    label: "Budbee",
    mode: String(process.env.BUDBEE_MODE || "sandbox").trim().toLowerCase()
  };
}

// =====================================================
// MOCK RATES (USED BY RATE COLLECTOR)
// =====================================================

async function getBudbeeRates(order) {
  console.log("📦 Budbee MOCK getRates called");

  return [
    {
      carrier: "budbee",
      id: "BUD_HOME",
      name: "Budbee Home",
      price: 89,
      eta_days: 2,
      co2: 1.2
    },
    {
      carrier: "budbee",
      id: "BUD_BOX",
      name: "Budbee Box",
      price: 69,
      eta_days: 2,
      co2: 0.8
    }
  ];
}

// =====================================================
// MOCK SHIPMENT (READY FOR REAL API LATER)
// =====================================================

async function createBudbeeShipment(order) {
  console.log("📦 Budbee MOCK createShipment called");

  return {
    success: true,
    carrier: "budbee",
    mode: "mock",
    data: {
      trackingNumber: "BUD" + Date.now(),
      trackingUrl: null
    },
    raw: {
      mock: true
    }
  };
}

// =====================================================
// READINESS (FOR DEBUG)
// =====================================================

function getBudbeePublicConfig() {
  const config = getBudbeeConfig();

  return {
    carrier: config.carrier,
    label: config.label,
    mode: config.mode,
    mock: true
  };
}

module.exports = {
  getBudbeeRates,
  createBudbeeShipment,
  getBudbeePublicConfig
};
