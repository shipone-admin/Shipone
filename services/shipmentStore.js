const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../data/shipments.json");

// Read all shipments
function getAll() {
  const raw = fs.readFileSync(FILE);
  return JSON.parse(raw);
}

// Save new shipment
function save(shipment) {
  const all = getAll();
  all.push(shipment);
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
}

// Check if order already processed (idempotency base)
function exists(orderId) {
  const all = getAll();
  return all.some(s => s.order_id === orderId);
}

module.exports = {
  save,
  exists,
  getAll
};
