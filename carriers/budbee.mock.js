// =====================================================
// BUDBEE MOCK (PRODUCTION-LIKE)
// =====================================================

function buildBudbeeRates(order) {
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

async function getRates(order) {
  console.log("📦 Budbee MOCK getRates called");

  const rates = buildBudbeeRates(order);

  console.log("📦 Budbee MOCK rates:", rates.length);

  return rates;
}

// framtida shipment mock (för createShipment fallback)
async function createShipment(order) {
  console.log("📦 Budbee MOCK createShipment called");

  return {
    success: true,
    carrier: "budbee",
    mode: "mock",
    data: {
      trackingNumber: "BUD" + Date.now(),
      trackingUrl: null
    }
  };
}

module.exports = {
  getRates,
  createShipment
};
