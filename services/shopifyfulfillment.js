const fetch = require("node-fetch");

const SHOP = process.env.SHOPIFY_STORE_URL;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = "2024-10";

async function safeJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function fulfillShopifyOrder(orderId, trackingNumber, trackingUrl) {
  try {
    console.log("📦 Starting Shopify fulfillment for order:", orderId);

    if (!SHOP || !TOKEN) {
      return {
        success: false,
        step: "config",
        error: "Missing SHOPIFY_STORE_URL or SHOPIFY_ACCESS_TOKEN"
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

    // 1️⃣ Get fulfillment orders
    const fulfillmentOrdersRes = await fetch(
      `https://${SHOP}/admin/api/${API_VERSION}/orders/${orderId}/fulfillment_orders.json`,
      {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json"
        }
      }
    );

    const fulfillmentOrdersData = await safeJson(fulfillmentOrdersRes);

    console.log("📡 Shopify fulfillment_orders status:", fulfillmentOrdersRes.status);
    console.log("📡 Shopify fulfillment_orders response:");
    console.log(JSON.stringify(fulfillmentOrdersData, null, 2));

    if (!fulfillmentOrdersRes.ok) {
      return {
        success: false,
        step: "get_fulfillment_orders",
        status: fulfillmentOrdersRes.status,
        error:
          fulfillmentOrdersData?.errors ||
          fulfillmentOrdersData?.error ||
          "Failed to fetch fulfillment orders",
        raw: fulfillmentOrdersData
      };
    }

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

    // 2️⃣ Create fulfillment
    const fulfillmentRes = await fetch(
      `https://${SHOP}/admin/api/${API_VERSION}/fulfillments.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": TOKEN,
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

    const fulfillmentData = await safeJson(fulfillmentRes);

    console.log("📡 Shopify fulfillment create status:", fulfillmentRes.status);
    console.log("📡 Shopify fulfillment create response:");
    console.log(JSON.stringify(fulfillmentData, null, 2));

    if (!fulfillmentRes.ok) {
      return {
        success: false,
        step: "create_fulfillment",
        status: fulfillmentRes.status,
        error:
          fulfillmentData?.errors ||
          fulfillmentData?.error ||
          "Failed to create fulfillment",
        raw: fulfillmentData
      };
    }

    return {
      success: true,
      step: "done",
      status: fulfillmentRes.status,
      fulfillmentOrderId,
      data: fulfillmentData
    };
  } catch (error) {
    return {
      success: false,
      step: "exception",
      error: error.message
    };
  }
}

module.exports = { fulfillShopifyOrder };
