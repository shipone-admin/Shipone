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

function buildGeneratedTestOrderId() {
  const timestamp = Date.now();
  const suffix = Math.floor(Math.random() * 10);
  return String(`9${timestamp}${suffix}`);
}

function buildGeneratedTestOrderNumber(orderId) {
  const digits = String(orderId || "").replace(/\D/g, "");
  const tail = digits.slice(-6);
  const value = Number(tail);
  return Number.isNaN(value) ? null : value;
}

function normalizeTestValue(value) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeMerchantContext(context = {}) {
  const merchantId = String(context.merchant_id || "default").trim() || "default";
  const shopDomain = String(context.shop_domain || "").trim().toLowerCase() || null;

  return {
    merchant_id: merchantId,
    shop_domain: shopDomain
  };
}

function buildOrderSnapshot(order) {
  const shippingLines = Array.isArray(order?.shipping_lines)
    ? order.shipping_lines.map((line) => ({
        title: line?.title || null,
        code: line?.code || null,
        source: line?.source || null,
        price: line?.price || null
      }))
    : [];

  const firstShippingLine = shippingLines[0] || null;

  return {
    id: order?.id || null,
    name: order?.name || null,
    shipone_delivery_raw: Array.isArray(order?.note_attributes)
      ? (
          order.note_attributes.find((attribute) => {
            const name = String(attribute?.name || "").trim().toLowerCase();
            return name === "shipone_delivery";
          })?.value || null
        )
      : null,
    first_shipping_line: firstShippingLine,
    shipping_lines: shippingLines
  };
}

function buildRoutingSnapshot(outcome = {}) {
  return {
    shipone_choice_normalized: outcome.shipone_choice || null,
    shipone_delivery_raw: outcome.shipone_delivery_raw || null,
    selected_carrier: outcome.selected_carrier || null,
    selected_service: outcome.selected_service || null,
    actual_carrier: outcome.actual_carrier || null,
    fallback_used: normalizeBoolean(outcome.fallback_used),
    fallback_from: outcome.fallback_from || null
  };
}

async function beginOrderProcessing(order, merchantContext = {}) {
  const shippingAddress = buildShippingAddress(order);
  const orderNumber = normalizeOrderNumber(order);
  const customerName = buildCustomerName(order);
  const normalizedMerchant = normalizeMerchantContext(merchantContext);

  const existingResult = await query(
    `
      SELECT
        id,
        order_id,
        merchant_id,
        shop_domain,
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
          merchant_id = $2,
          shop_domain = $3,
          order_name = $4,
          order_number = $5,
          email = $6,
          customer_name = $7,
          shipping_city = $8,
          shipping_zip = $9,
          shipping_country = $10,
          status = 'processing',
          retry_count = COALESCE(retry_count, 0) + 1,
          error = NULL,
          failed_at = NULL,
          updated_at = NOW()
        WHERE order_id = $1
      `,
      [
        order.id,
        normalizedMerchant.merchant_id,
        normalizedMerchant.shop_domain,
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
        merchant_id,
        shop_domain,
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
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        'processing',
        0,
        NOW(),
        NOW()
      )
    `,
    [
      order.id,
      normalizedMerchant.merchant_id,
      normalizedMerchant.shop_domain,
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

async function failOrderProcessing(orderId, failureData = {}, merchantContext = {}) {
  const failedAt = failureData.failed_at || new Date().toISOString();
  const normalizedMerchant = normalizeMerchantContext(merchantContext);

  const result = await query(
    `
      UPDATE shipments
      SET
        merchant_id = COALESCE($2, merchant_id),
        shop_domain = COALESCE($3, shop_domain),
        order_name = COALESCE($4, order_name),
        status = 'failed',
        error = $5,
        failed_at = $6,
        updated_at = NOW()
      WHERE order_id = $1
      RETURNING *
    `,
    [
      orderId,
      normalizedMerchant.merchant_id || null,
      normalizedMerchant.shop_domain || null,
      failureData.order_name || null,
      failureData.error || "Unknown shipment failure",
      failedAt
    ]
  );

  return result.rows[0] || null;
}

async function saveShipmentOutcome(order, outcome = {}, merchantContext = {}) {
  const shippingAddress = buildShippingAddress(order);
  const orderNumber = normalizeOrderNumber(order);
  const customerName = buildCustomerName(order);
  const normalizedMerchant = normalizeMerchantContext(merchantContext);

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

  const shipmentResultPayload = outcome.shipment_result
    ? {
        ...outcome.shipment_result,
        order_snapshot: buildOrderSnapshot(order),
        routing_snapshot: buildRoutingSnapshot(outcome),
        merchant_snapshot: {
          merchant_id: normalizedMerchant.merchant_id,
          shop_domain: normalizedMerchant.shop_domain
        }
      }
    : null;

  const result = await query(
    `
      UPDATE shipments
      SET
        merchant_id = $2,
        shop_domain = $3,
        order_name = $4,
        order_number = $5,
        email = $6,
        customer_name = $7,
        shipping_city = $8,
        shipping_zip = $9,
        shipping_country = $10,
        status = $11,
        shipone_choice = $12,
        selected_option = $13,
        selected_carrier = $14,
        selected_service = $15,
        actual_carrier = $16,
        fallback_used = $17,
        fallback_from = $18,
        tracking_number = $19,
        tracking_url = $20,
        shipment_success = $21,
        fulfillment_success = $22,
        shipment_result = $23,
        fulfillment_result = $24,
        error = $25,
        completed_at = CASE
          WHEN $26::timestamptz IS NOT NULL THEN $26::timestamptz
          ELSE completed_at
        END,
        failed_at = CASE
          WHEN $27::timestamptz IS NOT NULL THEN $27::timestamptz
          ELSE failed_at
        END,
        updated_at = NOW()
      WHERE order_id = $1
      RETURNING *
    `,
    [
      order.id,
      normalizedMerchant.merchant_id,
      normalizedMerchant.shop_domain,
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
      shipmentResultPayload ? JSON.stringify(shipmentResultPayload) : null,
      outcome.fulfillment_result ? JSON.stringify(outcome.fulfillment_result) : null,
      outcome.error || null,
      completedAt,
      failedAt
    ]
  );

  return result.rows[0] || null;
}

async function createDHLTestShipment(testData = {}) {
  const orderId = normalizeTestValue(testData.order_id) || buildGeneratedTestOrderId();
  const orderNumber =
    testData.order_number !== undefined && testData.order_number !== null
      ? Number(testData.order_number)
      : buildGeneratedTestOrderNumber(orderId);

  const safeOrderNumber = Number.isNaN(orderNumber) ? null : orderNumber;
  const trackingNumber = normalizeTestValue(testData.tracking_number);

  if (!trackingNumber) {
    throw new Error("Missing DHL tracking number");
  }

  const orderName =
    normalizeTestValue(testData.order_name) || `#DHL-TEST-${String(orderId).slice(-6)}`;

  const email = normalizeTestValue(testData.email) || "dhl-test@shipone.local";
  const customerName = normalizeTestValue(testData.customer_name) || "DHL Test Customer";
  const shippingCity = normalizeTestValue(testData.shipping_city) || "Stockholm";
  const shippingZip = normalizeTestValue(testData.shipping_zip) || "111 22";
  const shippingCountry = normalizeTestValue(testData.shipping_country) || "Sweden";
  const selectedService =
    normalizeTestValue(testData.selected_service) || "DHL Parcel Test";
  const shiponeChoice = normalizeTestValue(testData.shipone_choice) || "DHL_TEST";
  const normalizedMerchant = normalizeMerchantContext({
    merchant_id: testData.merchant_id,
    shop_domain: testData.shop_domain
  });

  const selectedOption = {
    id: "DHL_TEST",
    name: selectedService,
    carrier: "dhl",
    price: 0,
    eta_days: null,
    co2: null
  };

  const shipmentResult = {
    success: true,
    carrier: "dhl",
    mode: "manual_test",
    data: {
      trackingNumber,
      trackingUrl: null
    },
    merchant_snapshot: {
      merchant_id: normalizedMerchant.merchant_id,
      shop_domain: normalizedMerchant.shop_domain
    }
  };

  const fulfillmentResult = {
    success: true,
    mode: "manual_test",
    note: "Created as isolated DHL test shipment in admin-safe flow"
  };

  const result = await query(
    `
      INSERT INTO shipments (
        order_id,
        merchant_id,
        shop_domain,
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
        carrier_next_sync_at,
        carrier_sync_attempts,
        carrier_last_sync_status,
        created_at,
        updated_at,
        completed_at,
        failed_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        'completed',
        0,
        $11,
        $12,
        'dhl',
        $13,
        'dhl',
        false,
        NULL,
        $14,
        NULL,
        true,
        true,
        $15,
        $16,
        NULL,
        NULL,
        NULL,
        0,
        NULL,
        NOW(),
        0,
        NULL,
        NOW(),
        NOW(),
        NOW(),
        NULL
      )
      ON CONFLICT (order_id)
      DO UPDATE SET
        merchant_id = EXCLUDED.merchant_id,
        shop_domain = EXCLUDED.shop_domain,
        order_name = EXCLUDED.order_name,
        order_number = EXCLUDED.order_number,
        email = EXCLUDED.email,
        customer_name = EXCLUDED.customer_name,
        shipping_city = EXCLUDED.shipping_city,
        shipping_zip = EXCLUDED.shipping_zip,
        shipping_country = EXCLUDED.shipping_country,
        status = EXCLUDED.status,
        retry_count = 0,
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
        error = NULL,
        carrier_status_text = NULL,
        carrier_last_event_at = NULL,
        carrier_event_count = 0,
        carrier_last_synced_at = NULL,
        carrier_next_sync_at = NOW(),
        carrier_sync_attempts = 0,
        carrier_last_sync_status = NULL,
        completed_at = NOW(),
        failed_at = NULL,
        updated_at = NOW()
      RETURNING *
    `,
    [
      orderId,
      normalizedMerchant.merchant_id,
      normalizedMerchant.shop_domain,
      orderName,
      safeOrderNumber,
      email,
      customerName,
      shippingCity,
      shippingZip,
      shippingCountry,
      shiponeChoice,
      JSON.stringify(selectedOption),
      selectedService,
      trackingNumber,
      JSON.stringify(shipmentResult),
      JSON.stringify(fulfillmentResult)
    ]
  );

  return result.rows[0] || null;
}

async function deleteShipmentByOrderId(orderId) {
  const result = await query(
    `
      DELETE FROM shipments
      WHERE order_id = $1
      RETURNING *
    `,
    [orderId]
  );

  return result.rows[0] || null;
}

async function readShipments() {
  const result = await query(
    `
      SELECT
        id,
        order_id,
        merchant_id,
        shop_domain,
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
        carrier_next_sync_at,
        carrier_sync_attempts,
        carrier_last_sync_status,
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
        merchant_id,
        shop_domain,
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
        carrier_next_sync_at,
        carrier_sync_attempts,
        carrier_last_sync_status,
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
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 200));

  const result = await query(
    `
      SELECT
        id,
        order_id,
        merchant_id,
        shop_domain,
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
        carrier_next_sync_at,
        carrier_sync_attempts,
        carrier_last_sync_status,
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
  createDHLTestShipment,
  deleteShipmentByOrderId,
  readShipments,
  findShipmentByOrderId,
  getRecentShipments
};
