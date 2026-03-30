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
  labelUrl: null,
  trackingNumber: "DHL" + Date.now(),
  provider: "dhl",
  mode: "semi_live"
};
}

module.exports = { createDHLShipment };
