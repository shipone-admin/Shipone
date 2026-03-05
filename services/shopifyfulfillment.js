const fetch = require("node-fetch");

async function fulfillShopifyOrder(orderId, trackingNumber, trackingUrl) {
  const shop = process.env.SHOPIFY_STORE_URL;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;

  const response = await fetch(
    `https://${shop}/admin/api/2023-10/orders/${orderId}/fulfillments.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token
      },
      body: JSON.stringify({
        fulfillment: {
          tracking_info: {
            number: trackingNumber,
            url: trackingUrl,
            company: "PostNord"
          },
          notify_customer: true
        }
      })
    }
  );

  const data = await response.json();
  console.log("📦 Shopify fulfillment:", data);
  return data;
}

module.exports = { fulfillShopifyOrder };

