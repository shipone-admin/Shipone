// ================================
// SHIPONE SHIPMENT STORE
// POSTGRES VERSION
// ================================

const { query } = require("./db");

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

function mapRow(row) {
  return {
    id: row.id,
    order_id: Number(row.order_id),
    order_name: row.order_name,
    order_number: row.order_number,
    email: row.email,
    customer_name: row.customer_name,
    shipping_city: row.shipping_city,
    shipping_zip: row.shipping_zip,
    shipping_country: row.shipping_country,
    status: row.status,
    retry_count: row.retry_count,
    shipone_choice: row.shipone_choice,
    selected_option: row.selected_option,
    selected_carrier: row.selected_carrier,
    selected_service: row.selected_service,
    actual_carrier: row.actual_carrier,
    fallback_used: row.fallback_used,
    fallback_from: row.fallback_from,
    tracking_number: row.tracking_number,
    tracking_url: row.tracking_url,
    shipment_success: row.shipment_success,
    fulfillment_success: row.fulfillment_success,
    shipment_result: row.shipment_result,
    fulfillment_result: row.fulfillment_result,
    error: row.error,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
    failed_at: row.failed_at
  };
}

async function findShipmentByOrderId(orderId) {
  const result = await query(
    `SELECT * FROM shipments WHERE order_id = $1 LIMIT 1`,
    [orderId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRow(result.rows[0]);
}

async function beginOrderProcessing(order) {
  const existing = await findShipmentByOrderId(order.id);

  if (existing) {
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
      const result = await query(
        `
        UPDATE shipments
        SET
          order_name = $2,
          status = 'processing',
          retry_count = retry_count + 1,
          error = NULL,
          failed_at = NULL,
          updated_at = NOW()
        WHERE order_id = $1
        RETURNING *
        `,
        [order.id, order.name || existing.order_name]
      );

      return {
        started: true,
        reusedFailedRecord: true,
        record: mapRow(result.rows[0])
      };
    }
  }

  const base = buildBaseRecord(order);

  const result = await query(
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
      created_at,
      updated_at,
      completed_at,
      failed_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
      $21,$22,$23,$24,$25,$26,$27,$28
    )
    RETURNING *
    `,
    [
      base.order_id,
      base.order_name,
      base.order_number,
      base.email,
      base.customer_name,
      base.shipping_city,
      base.shipping_zip,
      base.shipping_country,
      base.status,
      base.retry_count,
      base.shipone_choice,
      base.selected_option,
      base.selected_carrier,
      base.selected_service,
      base.actual_carrier,
      base.fallback_used,
      base.fallback_from,
      base.tracking_number,
      base.tracking_url,
      base.shipment_success,
      base.fulfillment_success,
      base.shipment_result,
      base.fulfillment_result,
      base.error,
      base.created_at,
      base.updated_at,
      base.completed_at,
      base.failed_at
    ]
  );

  return {
    started: true,
    reusedFailedRecord: false,
    record: mapRow(result.rows[0])
  };
}

async function completeOrderProcessing(orderId, payload = {}) {
  const existing = await findShipmentByOrderId(orderId);
  const base = existing || buildBaseRecord({ id: orderId });

  const merged = {
    ...base,
    ...payload,
    status: "completed",
    error: null,
    updated_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    failed_at: null
  };

  const result = await query(
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
      created_at,
      updated_at,
      completed_at,
      failed_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
      $21,$22,$23,$24,$25,$26,$27,$28
    )
    ON CONFLICT (order_id)
    DO UPDATE SET
      order_name = EXCLUDED.order_name,
      order_number = EXCLUDED.order_number,
      email = EXCLUDED.email,
      customer_name = EXCLUDED.customer_name,
      shipping_city = EXCLUDED.shipping_city,
      shipping_zip = EXCLUDED.shipping_zip,
      shipping_country = EXCLUDED.shipping_country,
      status = EXCLUDED.status,
      retry_count = EXCLUDED.retry_count,
      shipone_choice = EXCLUDED.shipone_choice,
      selected_option = EXCLUDED.selected_option,
      selected_carrier = EXCLUDED.selected_carrier,
      selected_service = EXCLUDED.selected_service,
      actual_carrier = EXCLUDED.actual_carrier,
      fallback_used = EXCLUDED.fallback_used,
      fallback_from = EXCLUDED.fallback_from,
      tracking_number = EXCLUDED.tracking_number,
      tracking_url = EXCLUDED.tracking_url,
      shipment_success = EXCLUDED.shipment_success,
      fulfillment_success = EXCLUDED.fulfillment_success,
      shipment_result = EXCLUDED.shipment_result,
      fulfillment_result = EXCLUDED.fulfillment_result,
      error = EXCLUDED.error,
      updated_at = EXCLUDED.updated_at,
      completed_at = EXCLUDED.completed_at,
      failed_at = EXCLUDED.failed_at
    RETURNING *
    `,
    [
      merged.order_id,
      merged.order_name,
      merged.order_number,
      merged.email,
      merged.customer_name,
      merged.shipping_city,
      merged.shipping_zip,
      merged.shipping_country,
      merged.status,
      merged.retry_count,
      merged.shipone_choice,
      merged.selected_option,
      merged.selected_carrier,
      merged.selected_service,
      merged.actual_carrier,
      merged.fallback_used,
      merged.fallback_from,
      merged.tracking_number,
      merged.tracking_url,
      merged.shipment_success,
      merged.fulfillment_success,
      merged.shipment_result,
      merged.fulfillment_result,
      merged.error,
      merged.created_at,
      merged.updated_at,
      merged.completed_at,
      merged.failed_at
    ]
  );

  return mapRow(result.rows[0]);
}

async function failOrderProcessing(orderId, payload = {}) {
  const existing = await findShipmentByOrderId(orderId);
  const base = existing || buildBaseRecord({ id: orderId });

  const merged = {
    ...base,
    ...payload,
    status: "failed",
    updated_at: new Date().toISOString(),
    failed_at: new Date().toISOString()
  };

  const result = await query(
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
      created_at,
      updated_at,
      completed_at,
      failed_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
      $21,$22,$23,$24,$25,$26,$27,$28
    )
    ON CONFLICT (order_id)
    DO UPDATE SET
      order_name = EXCLUDED.order_name,
      order_number = EXCLUDED.order_number,
      email = EXCLUDED.email,
      customer_name = EXCLUDED.customer_name,
      shipping_city = EXCLUDED.shipping_city,
      shipping_zip = EXCLUDED.shipping_zip,
      shipping_country = EXCLUDED.shipping_country,
      status = EXCLUDED.status,
      retry_count = EXCLUDED.retry_count,
      shipone_choice = EXCLUDED.shipone_choice,
      selected_option = EXCLUDED.selected_option,
      selected_carrier = EXCLUDED.selected_carrier,
      selected_service = EXCLUDED.selected_service,
      actual_carrier = EXCLUDED.actual_carrier,
      fallback_used = EXCLUDED.fallback_used,
      fallback_from = EXCLUDED.fallback_from,
      tracking_number = EXCLUDED.tracking_number,
      tracking_url = EXCLUDED.tracking_url,
      shipment_success = EXCLUDED.shipment_success,
      fulfillment_success = EXCLUDED.fulfillment_success,
      shipment_result = EXCLUDED.shipment_result,
      fulfillment_result = EXCLUDED.fulfillment_result,
      error = EXCLUDED.error,
      updated_at = EXCLUDED.updated_at,
      completed_at = EXCLUDED.completed_at,
      failed_at = EXCLUDED.failed_at
    RETURNING *
    `,
    [
      merged.order_id,
      merged.order_name,
      merged.order_number,
      merged.email,
      merged.customer_name,
      merged.shipping_city,
      merged.shipping_zip,
      merged.shipping_country,
      merged.status,
      merged.retry_count,
      merged.shipone_choice,
      merged.selected_option,
      merged.selected_carrier,
      merged.selected_service,
      merged.actual_carrier,
      merged.fallback_used,
      merged.fallback_from,
      merged.tracking_number,
      merged.tracking_url,
      merged.shipment_success,
      merged.fulfillment_success,
      merged.shipment_result,
      merged.fulfillment_result,
      merged.error,
      merged.created_at,
      merged.updated_at,
      merged.completed_at,
      merged.failed_at
    ]
  );

  return mapRow(result.rows[0]);
}

async function saveShipmentOutcome(order, context = {}) {
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

async function readShipments() {
  const result = await query(
    `SELECT * FROM shipments ORDER BY updated_at DESC`
  );

  return result.rows.map(mapRow);
}

async function getRecentShipments(limit = 20) {
  const result = await query(
    `SELECT * FROM shipments ORDER BY updated_at DESC LIMIT $1`,
    [limit]
  );

  return result.rows.map(mapRow);
}

module.exports = {
  findShipmentByOrderId,
  beginOrderProcessing,
  completeOrderProcessing,
  failOrderProcessing,
  saveShipmentOutcome,
  readShipments,
  getRecentShipments
};
