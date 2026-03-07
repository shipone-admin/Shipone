const fetch = require("node-fetch");

const SHOP = process.env.SHOPIFY_STORE_URL;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

const API_VERSION = "2024-10";

async function fulfillShopifyOrder(orderId, trackingNumber, trackingUrl) {

  try {

    // 1️⃣ Get fulfillment orders
    const fulfillmentOrdersRes = await fetch(
      `https://${SHOP}/admin/api/${API_VERSION}/orders/${orderId}/fulfillment_orders.json`,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json"
        }
      }
    );

    const fulfillmentOrdersData = await fulfillmentOrdersRes.json();

console.log("📡 Shopify fulfillment_orders response:");
console.log(JSON.stringify(fulfillmentOrdersData, null, 2));

if (
  !fulfillmentOrdersData.fulfillment_orders ||
  fulfillmentOrdersData.fulfillment_orders.length === 0
) {
  console.log("❌ No fulfillment orders found for this order");
  return;
}


    const fulfillmentOrderId =
      fulfillmentOrdersData.fulfillment_orders[0].id;

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

    const data = await fulfillmentRes.json();

    console.log("✅ Shopify fulfillment created:");
    console.log(data);

  } catch (error) {

    console.log("❌ Shopify fulfillment error:");
    console.log(error.message);

  }

}

module.exports = { fulfillShopifyOrder };
