// ================================
// SHIPONE SHIPMENT STORE
// IDEMPOTENCY + FILE STORAGE
// ================================

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../data/shipments.json");

function ensureDataFile() {
  const dataDir = path.dirname(DATA_FILE);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
  }
}

function readShipments() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");

    if (!raw.trim()) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.log("❌ Failed to read shipments.json");
    console.log(error.message);
    return [];
  }
}

function writeShipments(shipments) {
  ensureDataFile();

  fs.writeFileSync(DATA_FILE, JSON.stringify(shipments, null, 2), "utf8");
}

function findShipmentByOrderId(orderId) {
  const shipments = readShipments();

  return shipments.find(
    (shipment) => String(shipment.order_id) === String(orderId)
  );
}

function beginOrderProcessing(order) {
  const shipments = readShipments();

  const existingIndex = shipments.findIndex(
    (shipment) => String(shipment.order_id) === String(order.id)
  );

  if (existingIndex !== -1) {
    const existing = shipments[existingIndex];

    if (existing.status === "processing") {
      return {
        started: false,
        reason: "already_processing",
        existing
      };
    }

    if (existing.status === "completed") {
      return {
        started: false,
        reason: "already_completed",
        existing
      };
    }

    if (existing.status === "failed") {
      shipments[existingIndex] = {
        ...existing,
        status: "processing",
        order_name: order.name,
        updated_at: new Date().toISOString(),
        retry_count: (existing.retry_count || 0) + 1,
        last_error: null
      };

      writeShipments(shipments);

      return {
        started: true,
        reusedFailedRecord: true,
        record: shipments[existingIndex]
      };
    }
  }

  const processingRecord = {
    order_id: order.id,
    order_name: order.name,
    status: "processing",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    retry_count: 0
  };

  shipments.push(processingRecord);
  writeShipments(shipments);

  return {
    started: true,
    reusedFailedRecord: false,
    record: processingRecord
  };
}

function completeOrderProcessing(orderId, payload) {
  const shipments = readShipments();

  const index = shipments.findIndex(
    (shipment) => String(shipment.order_id) === String(orderId)
  );

  const completedRecord = {
    ...(index !== -1 ? shipments[index] : {}),
    ...payload,
    order_id: orderId,
    status: "completed",
    updated_at: new Date().toISOString()
  };

  if (index !== -1) {
    shipments[index] = completedRecord;
  } else {
    shipments.push(completedRecord);
  }

  writeShipments(shipments);

  return completedRecord;
}

function failOrderProcessing(orderId, payload = {}) {
  const shipments = readShipments();

  const index = shipments.findIndex(
    (shipment) => String(shipment.order_id) === String(orderId)
  );

  const failedRecord = {
    ...(index !== -1 ? shipments[index] : {}),
    ...payload,
    order_id: orderId,
    status: "failed",
    updated_at: new Date().toISOString()
  };

  if (index !== -1) {
    shipments[index] = failedRecord;
  } else {
    shipments.push(failedRecord);
  }

  writeShipments(shipments);

  return failedRecord;
}

module.exports = {
  readShipments,
  findShipmentByOrderId,
  beginOrderProcessing,
  completeOrderProcessing,
  failOrderProcessing
};
