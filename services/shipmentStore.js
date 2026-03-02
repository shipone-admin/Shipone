// ================================
// SHIPONE SHIPMENT STORE
// Simple in-memory store (safe fallback)
// ================================

const shipments = [];

/**
 * Saves a shipment record
 */
async function saveShipment(data) {
  console.log("💾 Saving shipment record...");

  shipments.push({
    id: shipments.length + 1,
    ...data
  });

  console.log("✅ Shipment stored. Total:", shipments.length);
  return true;
}

/**
 * Debug helper — see stored shipments
 */
function getAllShipments() {
  return shipments;
}

module.exports = {
  saveShipment,
  getAllShipments
};
