const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../data/shipments.json");

// Ensure file exists
if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify([]));
}

// Read all shipments
function getAll() {
  const raw = fs.readFileSync(FILE);
  return JSON.parse(raw);
}

// Save new shipment
async function save(shipment) {
  const data = getAll();
  data.push(shipment);
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// Stats (this becomes powerful later)
function stats() {
  const data = getAll();

  return {
    total_orders: data.length,
    carriers: groupBy(data, "carrier"),
    services: groupBy(data, "service")
  };
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

module.exports = { save, getAll, stats };
