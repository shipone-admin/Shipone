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

function safeJsonClone(value) {
  if (value === undefined) return null;
  if (value === null) return null;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return null;
  }
}

function getShipOneChoiceRaw(order) {
  const noteAttributes = Array.isArray(order?.note_attributes)
    ? order.note_attributes
    : [];

  const match = noteAttributes.find((attribute) => {
    const name = String(attribute?.name || "").trim().toLowerCase();
    return name === "shipone_delivery";
  });

  const rawChoice = String(match?.value || "").trim();
  return rawChoice || null;
}

function buildCheckoutShippingContext(order) {
  const shippingLines = Array.isArray(order?.shipping_lines) ? order.shipping_lines : [];
  const firstShippingLine = shippingLines[0] || null;
  const deliveryMethod = order?.delivery_method || null;

  return {
    shipone_delivery_raw: getShipOneChoiceRaw(order),
    shipping_lines: safeJsonClone(shippingLines),
    first_shipping_line: firstShippingLine
      ? {
          code: firstShippingLine.code || null,
          title: firstShippingLine.title || null,
          source: firstShippingLine.source || null,
          carrier_identifier: firstShippingLine.carrier_identifier || null,
          requested_fulfillment_service_id:
            firstShippingLine.requested_fulfillment_service_id || null,
          phone: firstShippingLine.phone || null,
          price: firstShippingLine.price || null,
          discounted_price: firstShippingLine.discounted_price || null,
          original_shop_price:
            firstShippingLine.original_shop_price !== undefined
              ? firstShippingLine.original_shop_price
              : null,
          original_rate_price:
            firstShippingLine.original_rate_price !== undefined
              ? firstShippingLine.original_rate_price
              : null,
          tax_lines: safeJsonClone(firstShippingLine.tax_lines),
          discount_allocations: safeJsonClone(firstShippingLine.discount_allocations)
        }
      : null,
    delivery_method: deliveryMethod
      ? {
          id: deliveryMethod.id || null,
          method_type: deliveryMethod.method_type || null,
          service_code: deliveryMethod.service_code || null,
          presented_name: deliveryMethod.presented_name || null,
          min_delivery_date_time: deliveryMethod.min_delivery_date_time || null,
          max_delivery_date_time: deliveryMethod.max_delivery_date_time || null,
          branded_promise: safeJsonClone(deliveryMethod.branded_promise),
          source_reference: deliveryMethod.source_reference || null,
          additional_information: safeJsonClone(deliveryMethod.additional_information)
        }
      : null
  };
}

function buildShipmentAuditPayload(order, outcome = {}) {
  return {
    order_summary: {
      id: order?.id || null,
      name: order?.name || null,
      order_number: normalizeOrderNumber(order),
      email: order?.email || null
    },
    customer_summary: {
      customer_name: buildCustomerName(order),
      shipping_address: safeJsonClone(buildShippingAddress(order))
    },
    checkout_shipping_context: buildCheckoutShippingContext(order),
    shipone_decision: {
      normalized_choice: outcome.shipone_choice || null,
      selected_carrier: outcome.selected_carrier || null,
      selected_service: outcome.selected_service || null,
      actual_carrier: outcome.actual_carrier || null,
      fallback_used: normalizeBoolean(outcome.fallback_used),
      fallback_from: outcome.fallback_from || null,
      tracking_number: outcome.tracking_number || null,
      tracking_url: outcome.tracking_url || null
    }
  };
}

function buildShipmentResultPayload(order, outcome = {}) {
  const base = safeJsonClone(outcome.shipment_result) || {};

  return {
    ...base,
    audit: buildShipmentAuditPayload(order, outcome)
  };
}

function buildFulfillmentResultPayload(order, outcome = {}) {
  const base = safeJsonClone(outcome.fulfillment_result) || {};

  return {
    ...base,
    audit: buildShipmentAuditPayload(order, outcome)
  };
}

function buildSelectedOptionPayload(order, outcome = {}) {
  const base = safeJsonClone(outcome.selected_option) || null;

  if (!base) {
    return null;
  }

  return {
    ...base,
    shipone_meta: {
      normalized_choice: outcome.shipone_choice || null,
      raw_checkout_choice: getShipOneChoiceRaw(order),
      checkout_shipping_context: buildCheckoutShippingContext(order)
    }
  };
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
       
