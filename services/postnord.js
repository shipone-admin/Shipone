// services/postnord.js

const MOCK_MODE = true; // ← ändra till false när API aktiveras

// -----------------------------
// MOCK RESPONSE (NUVARANDE TEST)
// -----------------------------
function mockShipment(order) {
  console.log("🧪 MOCK MODE ACTIVE → Shipment NOT sent to PostNord");

  return {
    tracking_number: "MOCK123456",
    service: order.shipone_choice,
    eta_days: order.shipone_choice === "FAST" ? 1 : 2
  };
}

// -----------------------------
// LIVE POSTNORD (AKTIVERAS SEN)
// -----------------------------
async function createRealShipment(order) {
  console.log("📡 Creating REAL PostNord shipment...");

  // Här kopplas riktiga API:t senare
  // Vi lämnar den tom tills PostNord öppnar access

  return {
    tracking_number: "PENDING",
    service: order.shipone_choice
  };
}

// -----------------------------
// EXPORT MAIN FUNCTION
// -----------------------------
async function createShipment(order) {
  if (MOCK_MODE) {
    return mockShipment(order);
  } else {
    return await createRealShipment(order);
  }
}

module.exports = {
  createShipment
};

