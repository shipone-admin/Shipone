// ========================================
// DHL FREIGHT SERVICE (STEP 1: REAL CALL STRUCTURE)
// ========================================

const fetch = require("node-fetch");

async function createDHLShipment(order) {
  console.log("📦 DHL Freight shipment start");

  const API_KEY = process.env.DHL_API_KEY;
  const API_SECRET = process.env.DHL_API_SECRET;

  if (!API_KEY || !API_SECRET) {
    throw new Error("DHL credentials missing");
  }

  // 🧪 TEST ENDPOINT (vi byter senare till riktig booking endpoint)
  const url = "https://api-eu.dhl.com/track/shipments?trackingNumber=123";

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "DHL-API-Key": API_KEY,
        "Accept": "application/json"
      }
    });

    const data = await res.text();

    console.log("📡 DHL response status:", res.status);

    // 🔥 STEP 1: bara verifiera att API funkar
    return {
      success: true,
      carrier: "dhl",
      mode: "freight_step1",
      data: {
        trackingNumber: "DHL" + Date.now(),
        rawTestResponse: data.slice(0, 200)
      }
    };

  } catch (error) {
    console.log("❌ DHL Freight error:", error.message);

    throw new Error("DHL Freight API failed");
  }
}

module.exports = { createDHLShipment };
