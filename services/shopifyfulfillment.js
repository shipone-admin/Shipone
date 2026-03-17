const fetch = require("node-fetch");
const { getShopifyCredentialsByShopDomain } = require("./shopifyStoreCredentials");

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
  if (!parsed) return fallbackMessage;

  if (parsed.type === "json") {
    const data = parsed.data;
    if (data?.errors) {
      return typeof data.errors === "string"
        ? data.errors
        : JSON.stringify(data.errors);
    }
    if (data?.error) return data.error;
  }

  if (parsed.type === "text") return parsed.data || fallbackMessage;

  return fallbackMessage;
}

async function createFulfillmentWithRetry(shop, token, fulfillmentOrderId, trackingNumber, trackingUrl) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`📡 Shopify fulfillment create attempt ${attempt}/${maxAttempts}`);

    const res = await fetch(
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
              { fulfillment_order_id: fulfillmentOrderId }
            ]
          }
        })
      }
    );

    const parsed = await parseResponse(res);

    console.log("📡 Shopify fulfillment create status:", res.status);

    if (res.ok) {
      return {
        success: true,
        status: res.status,
        data: parsed.data,
        attempts: attempt
      };
    }

    if (!isRetryableStatus(res.status)) {
      return {
        success: false,
        error: getErrorMessage(parsed, "Failed to create fulfillment"),
        status: res.status
      };
    }

    await sleep(1000 * attempt);
  }

  return {
    success: false,
    error: "Failed after retries"
  };
}

async function fulfillShopifyOrder(orderId, trackingNumber, trackingUrl, merchantContext = {}) {
  try {
    const shopDomain = merchantContext.shop_domain;

    // 🔥 Hämta credentials från DB
    const creds = await getShopifyCredentialsByShopDomain(shopDomain);

    let SHOP = process.env.SHOPIFY_STORE_URL;
    let TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

    if (creds && creds.access_token && creds.is_active) {
      SHOP = creds.shop_domain;
      TOKEN = creds.access_token;
      console.log("🏪 Using merchant-specific Shopify credentials");
    } else {
      console.log("⚠️ Using fallback ENV Shopify credentials");
    }

    if (!SHOP || !TOKEN) {
      return {
        success: false,
        error: "Missing Shopify credentials"
      };
    }

    const fulfillmentOrdersRes = await fetch(
      `https://${SHOP}/admin/api/${API_VERSION}/orders/${orderId}/fulfillment_orders.json`,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN
        }
      }
    );

    const parsed = await parseResponse(fulfillmentOrdersRes);

    if (!fulfillmentOrdersRes.ok) {
      return {
        success: false,
        error: "Failed to fetch fulfillment orders",
        raw: parsed.data
      };
    }

    const fulfillmentOrderId =
      parsed.data?.fulfillment_orders?.[0]?.id;

    if (!fulfillmentOrderId) {
      return {
        success: false,
        error: "No fulfillment order found"
      };
    }

    console.log("✅ Fulfillment order found:", fulfillmentOrderId);

    return await createFulfillmentWithRetry(
      SHOP,
      TOKEN,
      fulfillmentOrderId,
      trackingNumber,
      trackingUrl
    );
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { fulfillShopifyOrder };
