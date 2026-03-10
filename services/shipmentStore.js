const { query } = require("./db");

function normalizeOrderNumber(order) {
  if (!order || order.order_number === undefined || order.order_number === null) {
    return null;
  }

  const value = Number(order.order_number);
  return Number.isNaN(value) ? null : value;
}

function buildCustomerName(order) {
  const firstName = String(order?.customer?.first_name || "").trim();
  const lastName = String(order?.customer?.last_name || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || null;
}

function buildShippingAddress(order) {
  return order?.shipping_address || {};
}

function normalizeBoolean(value) {
  return Boolean(value);
}

function normalizeRetryCount(value) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function beginOrderProcessing(order) {
  const shippingAddress = buildShippingAddress(order);
  const orderNumber = normalizeOrderNumber(order);
  const customerName = buildCustomerName(order);

  const existingResult = await query(
    `
      SELECT
        id,
        order_id,
        status
      FROM shipments
      WHERE order_id = $1
      LIMIT 1
    `,
    [order.id]
  );

  if (existingResult.rows.length > 0) {
    const existing = existingResult.rows[0];
    const existingStatus = String(existing.status || "").toLowerCase();

    if (existingStatus === "processing") {
      return {
        started: false,
        reason: "already_processing",
        shipment: existing
      };
    }

    if (existingStatus === "completed") {
      return {
        started: false,
        reason: "already_completed",
        shipment: existing
      };
    }

    await query(
      `
        UPDATE shipments
        SET
          order_name = $2,
          order_number = $3,
          email = $4,
          customer_name = $5,
          shipping_city = $6,
          shipping_zip = $7,
          shipping_country = $8,
          status = 'processing',
          retry_count = COALESCE(retry_count, 0) + 1,
          error = NULL,
          failed_at = NULL,
          updated_at = NOW()
        WHERE order_id = $1
      `,
      [
        order.id,
        order.name || null,
        orderNumber,
        order.email || null,
        customerName,
        shippingAddress.city || null,
        shippingAddress.zip || null,
        shippingAddress.country || null
      ]
    );

    return {
      started: true,
      reason: "restarted"
    };
  }

  await query(
    `
      INSERT INTO shipments (
        order_id,
        order_name,
        order_number,
        email,
        customer_name,
        shipping_city,
        shipping_zip,
        shipping_country,
        status,
        retry_count,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        'processing',
        0,
        NOW(),
        NOW()
      )
    `,
    [
      order.id,
      order.name || null,
      orderNumber,
      order.email || null,
      customerName,
      shippingAddress.city || null,
      shippingAddress.zip || null,
      shippingAddress.country || null
    ]
  );

  return {
    started: true,
    reason: "created"
  };
}

async function failOrderProcessing(orderId, failureData = {}) {
  const failedAt = failureData.failed_at || new Date().toISOString();

  const result = await query(
    `
      UPDATE shipments
      SET
        order_name = COALESCE($2, order_name),
        status = 'failed',
        error = $3,
        failed_at = $4,
        updated_at = NOW()
      WHERE order_id = $1
      RETURNING *
    `,
    [
      orderId,
      failureData.order_name || null,
      failureData.error || "Unknown shipment failure",
      failedAt
    ]
  );

  return result.rows[0] || null;
}

async function saveShipmentOutcome(order, outcome = {}) {
  const shippingAddress = buildShippingAddress(order);
  const orderNumber = normalizeOrderNumber(order);
  const customerName = buildCustomerName(order);

  const shipmentSuccess = normalizeBoolean(outcome.shipment_success);
  const fulfillmentSuccess = normalizeBoolean(outcome.fulfillment_success);

  let finalStatus = "failed";

  if (shipmentSuccess && fulfillmentSuccess) {
    finalStatus = "completed";
  } else if (shipmentSuccess && !fulfillmentSuccess) {
    finalStatus = "failed";
  } else if (!shipmentSuccess) {
    finalStatus = "failed";
  }

  const completedAt = finalStatus === "completed" ? new Date().toISOString() : null;
  const failedAt = finalStatus === "failed" ? new Date().toISOString() : null;

  const result = await query(
    `
      UPDATE shipments
      SET
        order_name = $2,
        order_number = $3,
        email = $4,
        customer_name = $5,
        shipping_city = $6,
        shipping_zip = $7,
        shipping_country = $8,
        status = $9,
        shipone_choice = $10,
        selected_option = $11,
        selected_carrier = $12,
        selected_service = $13,
        actual_carrier = $14,
        fallback_used = $15,
        fallback_from = $16,
        tracking_number = $17,
        tracking_url = $18,
        shipment_success = $19,
        fulfillment_success = $20,
        shipment_result = $21,
        fulfillment_result = $22,
        error = $23,
        completed_at = CASE
          WHEN $24::timestamptz IS NOT NULL THEN $24::timestamptz
          ELSE completed_at
        END,
        failed_at = CASE
          WHEN $25::timestamptz IS NOT NULL THEN $25::timestamptz
          ELSE failed_at
        END,
        updated_at = NOW()
      WHERE order_id = $1
      RETURNING *
    `,
    [
      order.id,
      order.name || null,
      orderNumber,
      order.email || null,
      customerName,
      shippingAddress.city || null,
      shippingAddress.zip || null,
      shippingAddress.country || null,
      finalStatus,
      outcome.shipone_choice || null,
      outcome.selected_option ? JSON.stringify(outcome.selected_option) : null,
      outcome.selected_carrier || null,
      outcome.selected_service || null,
      outcome.actual_carrier || null,
      normalizeBoolean(outcome.fallback_used),
      outcome.fallback_from || null,
      outcome.tracking_number || null,
      outcome.tracking_url || null,
      shipmentSuccess,
      fulfillmentSuccess,
      outcome.shipment_result ? JSON.stringify(outcome.shipment_result) : null,
      outcome.fulfillment_result ? JSON.stringify(outcome.fulfillment_result) : null,
      outcome.error || null,
      completedAt,
      failedAt
    ]
  );

  return result.rows[0] || null;
}

async function readShipments() {
  const result = await query(
    `
      SELECT
        id,
        order_id,
        order_name,
        order_number,
        email,
        customer_name,
        shipping_city,
        shipping_zip,
        shipping_country,
        status,
        retry_count,
        shipone_choice,
        selected_option,
        selected_carrier,
        selected_service,
        actual_carrier,
        fallback_used,
        fallback_from,
        tracking_number,
        tracking_url,
        shipment_success,
        fulfillment_success,
        shipment_result,
        fulfillment_result,
        error,
        carrier_status_text,
        carrier_last_event_at,
        carrier_event_count,
        carrier_last_synced_at,
        created_at,
        updated_at,
        completed_at,
        failed_at
      FROM shipments
      ORDER BY created_at DESC, id DESC
    `
  );

  return result.rows;
}

async function findShipmentByOrderId(orderId) {
  const result = await query(
    `
      SELECT
        id,
        order_id,
        order_name,
        order_number,
        email,
        customer_name,
        shipping_city,
        shipping_zip,
        shipping_country,
        status,
        retry_count,
        shipone_choice,
        selected_option,
        selected_carrier,
        selected_service,
        actual_carrier,
        fallback_used,
        fallback_from,
        tracking_number,
        tracking_url,
        shipment_success,
        fulfillment_success,
        shipment_result,
        fulfillment_result,
        error,
        carrier_status_text,
        carrier_last_event_at,
        carrier_event_count,
        carrier_last_synced_at,
        created_at,
        updated_at,
        completed_at,
        failed_at
      FROM shipments
      WHERE order_id = $1
      LIMIT 1
    `,
    [orderId]
  );

  return result.rows[0] || null;
}

async function getRecentShipments(limit = 20) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));

  const result = await query(
    `
      SELECT
        id,
        order_id,
        order_name,
        order_number,
        email,
        customer_name,
        shipping_city,
        shipping_zip,
        shipping_country,
        status,
        retry_count,
        shipone_choice,
        selected_option,
        selected_carrier,
        selected_service,
        actual_carrier,
        fallback_used,
        fallback_from,
        tracking_number,
        tracking_url,
        shipment_success,
        fulfillment_success,
        shipment_result,
        fulfillment_result,
        error,
        carrier_status_text,
        carrier_last_event_at,
        carrier_event_count,
        carrier_last_synced_at,
        created_at,
        updated_at,
        completed_at,
        failed_at
      FROM shipments
      ORDER BY created_at DESC, id DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

module.exports = {
  beginOrderProcessing,
  failOrderProcessing,
  saveShipmentOutcome,
  readShipments,
  findShipmentByOrderId,
  getRecentShipments
};
