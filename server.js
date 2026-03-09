// ================================
// SHIPONE BACKEND
// IDEMPOTENCY VERSION
// ================================

const express = require("express");
const axios = require("axios");

const { chooseBestOption } = require("./services/routingEngine");
const { createShipment } = require("./services/createShipment");
const { fulfillShopifyOrder } = require("./services/shopifyfulfillment");
const { collectRates } = require("./core/rateCollector");
const {
  beginOrderProcessing,
  completeOrderProcessing,
  failOrderProcessing
} = require("./services/shipmentStore");

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
  const order = req.body;

  try {
    console.log("📦 NEW ORDER:", order.name);

    if (!order || !order.id) {
      console.log("❌ Missing order id");
      return res.sendStatus(200);
    }

    const processingState = beginOrderProcessing(order);

    if (!processingState.started) {
      if (processingState.reason === "already_processing") {
        console.log("🛑 Duplicate webhook blocked: order already processing");
        console.log("Order ID:", order.id);
        return res.sendStatus(200);
      }

      if (processingState.reason === "already_completed") {
        console.log("🛑 Duplicate webhook blocked: order already completed");
        console.log("Order ID:", order.id);
        return res.sendStatus(200);
      }
    }

    console.log("🔒 Idempotency lock created for order:", order.id);

    if (!order.shipping_address) {
      console.log("❌ Missing shipping address");

      failOrderProcessing(order.id, {
        order_name: order.name,
        error: "Missing shipping address"
      });

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

      failOrderProcessing(order.id, {
        order_name: order.name,
        shipone_choice: shiponePreference,
        error: "No shipping option selected"
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

    completeOrderProcessing(order.id, {
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
      completed_at: new Date().toISOString()
    });

    console.log("💾 Shipment stored with completed status");

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ SHIPMENT ERROR:");
    console.error(err.response?.data || err.message);

    if (order && order.id) {
      failOrderProcessing(order.id, {
        order_name: order.name,
        error: err.response?.data || err.message,
        failed_at: new Date().toISOString()
      });
    }

    res.sendStatus(200);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 ShipOne running on port ${PORT}`);
});
