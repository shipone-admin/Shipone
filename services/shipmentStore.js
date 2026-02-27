// =====================================================
// Shipment Store (ESM VERSION)
// =====================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE = path.join(__dirname, "../data/shipments.json");

if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify([]));
}

function getAll() {
  return JSON.parse(fs.readFileSync(FILE));
}

async function save(shipment) {
  const data = getAll();
  data.push(shipment);
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function stats() {
  const data = getAll();

  const groupBy = (arr, key) =>
    arr.reduce((acc, item) => {
      acc[item[key]] = (acc[item[key]] || 0) + 1;
      return acc;
    }, {});

  return {
    total_orders: data.length,
    carriers: groupBy(data, "carrier"),
    services: groupBy(data, "service")
  };
}

export default { save, getAll, stats };
