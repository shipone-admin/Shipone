const fetch = require("node-fetch");
const { resolveShopifyStoreCredentials } = require("./merchantStore");

const API_VERSION = "2024-10";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  try {
    if (isJson) {
      const json = await response.json();
      return {
        type: "json",
        data: json
      };
    }

    const text = await response.text();
    return {
      type: "text",
      data: text
    };
  } catch (error) {
    return {
      type: "empty",
      data: null
    };
  }
}

function isRetryableStatus(status) {
  return status === 502 || status === 503 || status === 504;
}

function getErrorMessage(parsed, fallbackMessage) {
  if (!parsed) {
    return fallbackMessage;
  }

  if (parsed.type === "json") {
    const data = parsed.data;

    if (data?.errors) {
      if (typeof data.errors === "string") {
        return data.errors;
      }

      return JSON.stringify(data.errors);
    }

    if (data?.error) {
      return data.error;
    }

    return fallbackMessage;
  }

  if (parsed.type === "text") {
    return parsed.data || fallbackMessage;
  }

  return fallbackMessage;
}

async function createFulfillmentWithRetry({
  shop,
  token,
  fulfillmentOrderId,
  trackingNumber,
  trackingUrl
}) {
  const maxAttempts = 3;
  let lastParsed = null;
  let lastStatus = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`📡 Shopify fulfillment create attempt ${attempt}/${maxAttempts}`);

    const fulfillmentRes = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/fulfillments.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fulfillment: {
            message: "Shipment created by ShipOne",
            tracking_info: {
              number: trackingNumber,
              url: trackingUrl
            },
            line_items_by_fulfillment_order: [
              {
                fulfillment_order_id: fulfillmentOrderId
              }
            ]
          }
        })
      }
    );

    const parsed = await parseResponse(fulfillmentRes);

    lastParsed = parsed;
    lastStatus = fulfillmentRes.status;

    console.log("📡 Shopify fulfillment create status:", fulfillmentRes.status);
    console.log("📡 Shopify fulfillment create response:");
    console.log(
      parsed.type === "json"
        ? JSON.stringify(parsed.data, null, 2)
        : parsed.data
    );

    if (fulfillmentRes.ok) {
      return {
        success: true,
        step: "done",
        status: fulfillmentRes.status,
        fulfillmentOrderId,
        data: parsed.data,
        attempts: attempt
      };
    }

    if (!isRetryableStatus(fulfillmentRes.status)) {
      return {
        success: false,
        step: "create_fulfillment",
        status: fulfillmentRes.status,
        error: getErrorMessage(parsed, "Failed to create fulfillment"),
        raw: parsed.data,
        attempts: attempt
      };
    }

    if (attempt < maxAttempts) {
      console.log(`⏳ Retry after temporary Shopify error ${fulfillmentRes.status}`);
      await sleep(1200 * attempt);
    }
  }

  return {
    success: false,
    step: "create_fulfillment",
    status: lastStatus,
    error: getErrorMessage(lastParsed, "Failed to create fulfillment after retries"),
    raw: lastParsed?.data || null,
    attempts: maxAttempts
  };
}

async function fulfillShopifyOrder(
  orderId,
  trackingNumber,
  trackingUrl,
  merchantContext = {}
) {
  try {
    console.log("📦 Starting Shopify fulfillment for order:", orderId);

    const credentials = await resolveShopifyStoreCredentials({
      shopDomain: merchantContext.shop_domain,
      merchantId: merchantContext.merchant_id
    });

    const shop = credentials.shop_domain;
    const token = credentials.access_token;

    console.log("🏪 Shopify fulfillment credential source:", credentials.source);
    console.log("🏪 Shopify fulfillment shop:", shop || "missing");
    console.log(
      "🏪 Shopify fulfillment merchant:",
      credentials.merchant_id || merchantContext.merchant_id || "default"
    );

    if (!shop || !token) {
      return {
        success: false,
        step: "config",
        error: "Missing Shopify store credentials for this merchant/store"
      };
    }

    if (!orderId) {
      return {
        success: false,
        step: "input",
        error: "Missing orderId"
      };
    }

    if (!trackingNumber) {
      return {
        success: false,
        step: "input",
        error: "Missing trackingNumber"
      };
    }

    const fulfillmentOrdersRes = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/orders/${orderId}/fulfillment_orders.json`,
      {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json"
        }
      }
    );

    const fulfillmentOrdersParsed = await parseResponse(fulfillmentOrdersRes);

    console.log("📡 Shopify fulfillment_orders status:", fulfillmentOrdersRes.status);
    console.log("📡 Shopify fulfillment_orders response:");
    console.log(
      fulfillmentOrdersParsed.type === "json"
        ? JSON.stringify(fulfillmentOrdersParsed.data, null, 2)
        : fulfillmentOrdersParsed.data
    );

    if (!fulfillmentOrdersRes.ok) {
      return {
        success: false,
        step: "get_fulfillment_orders",
        status: fulfillmentOrdersRes.status,
        error: getErrorMessage(
          fulfillmentOrdersParsed,
          "Failed to fetch fulfillment orders"
        ),
        raw: fulfillmentOrdersParsed.data
      };
    }

    const fulfillmentOrdersData = fulfillmentOrdersParsed.data;

    if (
      !fulfillmentOrdersData ||
      !Array.isArray(fulfillmentOrdersData.fulfillment_orders) ||
      fulfillmentOrdersData.fulfillment_orders.length === 0
    ) {
      return {
        success: false,
        step: "get_fulfillment_orders",
        status: fulfillmentOrdersRes.status,
        error: "No fulfillment orders found for this order",
        raw: fulfillmentOrdersData
      };
    }

    const fulfillmentOrderId = fulfillmentOrdersData.fulfillment_orders[0].id;

    console.log("✅ Fulfillment order found:", fulfillmentOrderId);

    return await createFulfillmentWithRetry({
      shop,
      token,
      fulfillmentOrderId,
      trackingNumber,
      trackingUrl
    });
  } catch (error) {
    return {
      success: false,
      step: "exception",
      error: error.message
    };
  }
}

module.exports = { fulfillShopifyOrder };
