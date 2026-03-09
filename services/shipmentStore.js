// ================================
// SHIPONE SHIPMENT STORE
// STRUCTURED VERSION
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

function findShipmentIndexByOrderId(shipments, orderId) {
  return shipments.findIndex(
    (shipment) => String(shipment.order_id) === String(orderId)
  );
}

function findShipmentByOrderId(orderId) {
  const shipments = readShipments();
  const index = findShipmentIndexByOrderId(shipments, orderId);

  if (index === -1) {
    return null;
  }

  return shipments[index];
}

function buildBaseRecord(order) {
  return {
    order_id: order.id || null,
    order_name: order.name || null,
    order_number: order.order_number || null,
    email: order.email || null,
    customer_name: order.customer
      ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() || null
      : null,
    shipping_city: order.shipping_address?.city || null,
    shipping_zip: order.shipping_address?.zip || null,
    shipping_country: order.shipping_address?.country || null,
    status: "processing",
    retry_count: 0,
    shipone_choice: null,
    selected_option: null,
    selected_carrier: null,
    selected_service: null,
    actual_carrier: null,
    fallback_used: false,
    fallback_from: null,
    tracking_number: null,
    tracking_url: null,
    shipment_success: false,
    fulfillment_success: false,
    shipment_result: null,
    fulfillment_result: null,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
    failed_at: null
  };
}

function updateRecord(existing, updates = {}) {
  return {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };
}

function beginOrderProcessing(order) {
  const shipments = readShipments();
  const index = findShipmentIndexByOrderId(shipments, order.id);

  if (index !== -1) {
    const existing = shipments[index];

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
      const restarted = updateRecord(existing, {
        order_name: order.name || existing.order_name,
        status: "processing",
        retry_count: (existing.retry_count || 0) + 1,
        error: null,
        failed_at: null
      });

      shipments[index] = restarted;
      writeShipments(shipments);

      return {
        started: true,
        reusedFailedRecord: true,
        record: restarted
      };
    }
  }

  const record = buildBaseRecord(order);

  shipments.push(record);
  writeShipments(shipments);

  return {
    started: true,
    reusedFailedRecord: false,
    record
  };
}

function completeOrderProcessing(orderId, payload = {}) {
  const shipments = readShipments();
  const index = findShipmentIndexByOrderId(shipments, orderId);

  const existing =
    index !== -1
      ? shipments[index]
      : buildBaseRecord({ id: orderId });

  const completed = updateRecord(existing, {
    ...payload,
    status: "completed",
    error: null,
    completed_at: new Date().toISOString(),
    failed_at: null
  });

  if (index !== -1) {
    shipments[index] = completed;
  } else {
    shipments.push(completed);
  }

  writeShipments(shipments);
  return completed;
}

function failOrderProcessing(orderId, payload = {}) {
  const shipments = readShipments();
  const index = findShipmentIndexByOrderId(shipments, orderId);

  const existing =
    index !== -1
      ? shipments[index]
      : buildBaseRecord({ id: orderId });

  const failed = updateRecord(existing, {
    ...payload,
    status: "failed",
    failed_at: new Date().toISOString()
  });

  if (index !== -1) {
    shipments[index] = failed;
  } else {
    shipments.push(failed);
  }

  writeShipments(shipments);
  return failed;
}

function saveShipmentOutcome(order, context = {}) {
  const payload = {
    order_name: order?.name || null,
    order_number: order?.order_number || null,
    email: order?.email || null,
    customer_name: order?.customer
      ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() || null
      : null,
    shipping_city: order?.shipping_address?.city || null,
    shipping_zip: order?.shipping_address?.zip || null,
    shipping_country: order?.shipping_address?.country || null,
    shipone_choice: context.shipone_choice || null,
    selected_option: context.selected_option || null,
    selected_carrier: context.selected_carrier || null,
    selected_service: context.selected_service || null,
    actual_carrier: context.actual_carrier || null,
    fallback_used: Boolean(context.fallback_used),
    fallback_from: context.fallback_from || null,
    tracking_number: context.tracking_number || null,
    tracking_url: context.tracking_url || null,
    shipment_success: Boolean(context.shipment_success),
    fulfillment_success: Boolean(context.fulfillment_success),
    shipment_result: context.shipment_result || null,
    fulfillment_result: context.fulfillment_result || null,
    error: context.error || null
  };

  return completeOrderProcessing(order.id, payload);
}

function getRecentShipments(limit = 20) {
  const shipments = readShipments();

  return [...shipments]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, limit);
}

module.exports = {
  readShipments,
  writeShipments,
  findShipmentByOrderId,
  beginOrderProcessing,
  completeOrderProcessing,
  failOrderProcessing,
  saveShipmentOutcome,
  getRecentShipments
};
