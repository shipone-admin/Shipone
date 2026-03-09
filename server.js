// ================================
// SHIPONE BACKEND (CLEAN VERSION)
// CARRIER-AWARE FLOW
// ================================

const express = require("express");
const axios = require("axios");

const { chooseBestOption } = require("./services/routingEngine");
const { createShipment } = require("./services/createShipment");
const { fulfillShopifyOrder } = require("./services/shopifyfulfillment");
const { collectRates } = require("./core/rateCollector");
const { saveShipment } = require("./services/shipmentStore");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ================================
// ROOT TEST
// ================================
app.get("/", (req, res) => {
  res.send("ShipOne backend is running");
});

// ================================
// SHOPIFY OAUTH CALLBACK
// ================================
app.get("/oauth/callback", async (req, res) => {
  try {
    const { code, shop } = req.query;

    console.log("SHOP:", shop);
    console.log("CODE:", code);

    if (!code) {
      return res.send("No OAuth code received");
    }

    const response = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code: code
      }
    );

    const accessToken = response.data.access_token;

    console.log("✅ SHOPIFY ACCESS TOKEN:");
    console.log(accessToken);

    res.send("TOKEN GENERATED. CHECK RAILWAY LOGS.");
  } catch (error) {
    console.error("❌ OAuth error:");
    console.error(error.response?.data || error.message);

    res.send("OAuth failed");
  }
});

// ================================
// SHOPIFY ORDER WEBHOOK
// ================================
app.post("/webhooks/orders-create", async (req, res) => {
  try {
    const order = req.body;

    console.log("📦 NEW ORDER:", order.name);

    if (!order.shipping_address) {
      console.log("❌ Missing shipping address");
      return res.sendStatus(200);
    }

    const shippingOptions = await collectRates(order);

    let shiponePreference = "SMART";

    if (Array.isArray(order.note_attributes)) {
      const attr = order.note_attributes.find(
        (a) => a.name === "shipone_delivery"
      );

      if (attr && attr.value) {
        shiponePreference = attr.value;
      }
    }

    if (shiponePreference === "FASTEST") shiponePreference = "FAST";
    if (shiponePreference === "CHEAPEST") shiponePreference = "CHEAP";
    if (shiponePreference === "GREEN") shiponePreference = "SMART";

    console.log("🚚 ShipOne Choice:", shiponePreference);

    const selectedOption = chooseBestOption(
      shippingOptions,
      shiponePreference.toUpperCase()
    );

    if (!selectedOption) {
      console.log("❌ No shipping option could be selected");

      await saveShipment({
        order_id: order.id,
        order_name: order.name,
        shipone_choice: shiponePreference,
        shipment_success: false,
        fulfillment_success: false,
        error: "No shipping option selected",
        created_at: new Date().toISOString()
      });

      return res.sendStatus(200);
    }

    console.log("✅ Selected option:");
    console.log(selectedOption);

    order.shipone_choice = selectedOption;

    const shipmentResult = await createShipment(order, selectedOption);

    let fulfillmentResult = {
      success: false,
      skipped: true,
      reason: "Shipment was not created"
    };

    if (shipmentResult.success && shipmentResult.data) {
      fulfillmentResult = await fulfillShopifyOrder(
        order.id,
        shipmentResult.data.trackingNumber,
        shipmentResult.data.trackingUrl
      );

      if (fulfillmentResult.success) {
        console.log("✅ Shopify fulfillment completed");
      } else {
        console.log("❌ Shopify fulfillment failed");
        console.log(
          JSON.stringify(
            {
              step: fulfillmentResult.step,
              status: fulfillmentResult.status,
              error: fulfillmentResult.error
            },
            null,
            2
          )
        );
      }
    } else {
      console.log("❌ Shipment creation failed, skipping Shopify fulfillment");
    }

    await saveShipment({
      order_id: order.id,
      order_name: order.name,
      shipone_choice: shiponePreference,
      selected_option: selectedOption,
      selected_carrier: selectedOption.carrier || null,
      selected_service: selectedOption.name || null,
      actual_carrier: shipmentResult.carrier || null,
      fallback_used: shipmentResult.fallbackUsed || false,
      fallback_from: shipmentResult.fallbackFrom || null,
      shipment_success: shipmentResult.success,
      shipment_result: shipmentResult,
      fulfillment_success: fulfillmentResult.success || false,
      fulfillment_result: fulfillmentResult,
      created_at: new Date().toISOString()
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ SHIPMENT ERROR:");
    console.error(err.response?.data || err.message);

    res.sendStatus(200);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 ShipOne running on port ${PORT}`);
});
