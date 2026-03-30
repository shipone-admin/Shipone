// ========================================
// DHL SERVICE STRUCTURE (READY FOR API)
// ========================================

async function createDHLShipment(order) {
  console.log("📦 DHL shipment placeholder");

 if (!process.env.DHL_API_KEY) {
  throw new Error("DHL API key missing");
}

  // Här kommer OAuth + shipment call senare

  return {
    labelUrl: "mock-label",
    trackingNumber: "DHL123456789"
  };
}

module.exports = { createDHLShipment };
