const express = require("express");
const axios = require("axios");

const { initDatabase, query } = require("./services/db");
const { chooseBestOption } = require("./services/routingEngine");
const { createShipment } = require("./services/createShipment");
const { fulfillShopifyOrder } = require("./services/shopifyfulfillment");
const { collectRates } = require("./core/rateCollector");
const {
  beginOrderProcessing,
  failOrderProcessing,
  saveShipmentOutcome,
  readShipments,
  findShipmentByOrderId,
  getRecentShipments
} = require("./services/shipmentStore");
const {
  renderTrackingPage,
  renderTrackingNotFoundPage,
  renderTrackingErrorPage
} = require("./views/trackingPage");
const { renderHomePage } = require("./views/homePage");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  return res.status(200).send(renderHomePage());
});

app.get("/shipments", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 20);
    const shipments = await getRecentShipments(limit);

    return res.status(200).json({
      success: true,
      total: shipments.length,
      shipments
    });
  } catch (error) {
    console.error("❌ Failed to read shipments:");
    console.error(error.message);

    return res.status(500).json({
      success: false,
      error: "Failed to read shipments"
    });
  }
});

app.get("/shipments/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const shipment = await findShipmentByOrderId(orderId);

    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: "Shipment not found"
      });
    }

    return res.status(200).json({
      success: true,
      shipment
    });
  } catch (error) {
    console.error("❌ Failed to read shipment by order id:");
    console.error(error.message);

    return res.status(500).json({
      success: false,
      error: "Failed to read shipment"
    });
  }
});

app.get("/shipments-debug", async (req, res) => {
  try {
    const shipments = await readShipments();

    return res.status(200).json({
      success: true,
      total: shipments.length,
      shipments
    });
  } catch (error) {
    console.error("❌ Failed to debug shipments:");
    console.error(error.message);

    return res.status(500).json({
      success: false,
      error: "Failed to debug shipments"
    });
  }
});

app.get("/track/:trackingNumber", async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    const result = await query(
      `SELECT * FROM shipments WHERE tracking_number = $1 LIMIT 1`,
      [trackingNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(renderTrackingNotFoundPage());
    }

    const shipment = result.rows[0];

    return res.status(200).send(renderTrackingPage(shipment));
  } catch (error) {
    console.error("❌ Tracking lookup failed:");
    console.error(error.message);

    return res.status(500).send(renderTrackingErrorPage());
  }
});

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

    return res.send("TOKEN GENERATED. CHECK RAILWAY LOGS.");
  } catch (error) {
    console.error("❌ OAuth error:");
    console.error(error.response?.data || error.message);

    return res.send("OAuth failed");
  }
});

app.post("/webhooks/orders-create", async (req, res) => {
  const order = req.body;

  try {
    console.log("📦 NEW ORDER:", order?.name);

    if (!order || !order.id) {
      console.log("❌ Missing order id");
      return res.sendStatus(200);
    }

    const processingState = await beginOrderProcessing(order);

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

      await failOrderProcessing(order.id, {
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

      await failOrderProcessing(order.id, {
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

    let trackingNumber = null;
    let trackingUrl = null;

    if (shipmentResult.success && shipmentResult.data) {
      trackingNumber = shipmentResult.data.trackingNumber || null;
      trackingUrl = shipmentResult.data.trackingUrl || null;

      fulfillmentResult = await fulfillShopifyOrder(
        order.id,
        trackingNumber,
        trackingUrl
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
              error: fulfillmentResult.error,
              attempts: fulfillmentResult.attempts || 1
            },
            null,
            2
          )
        );
      }
    } else {
      console.log("❌ Shipment creation failed, skipping Shopify fulfillment");
    }

    const storedRecord = await saveShipmentOutcome(order, {
      shipone_choice: shiponePreference,
      selected_option: selectedOption,
      selected_carrier: selectedOption.carrier || null,
      selected_service: selectedOption.name || null,
      actual_carrier: shipmentResult.carrier || null,
      fallback_used: shipmentResult.fallbackUsed || false,
      fallback_from: shipmentResult.fallbackFrom || null,
      tracking_number: trackingNumber,
      tracking_url: trackingUrl,
      shipment_success: shipmentResult.success,
      fulfillment_success: fulfillmentResult.success || false,
      shipment_result: shipmentResult,
      fulfillment_result: fulfillmentResult,
      error:
        shipmentResult.success
          ? fulfillmentResult.success
            ? null
            : fulfillmentResult.error || "Shopify fulfillment failed"
          : shipmentResult.error || "Shipment creation failed"
    });

    console.log("💾 Shipment stored with completed status");
    console.log("🧾 Stored record summary:");
    console.log(
      JSON.stringify(
        {
          order_id: storedRecord.order_id,
          order_name: storedRecord.order_name,
          status: storedRecord.status,
          selected_carrier: storedRecord.selected_carrier,
          actual_carrier: storedRecord.actual_carrier,
          tracking_number: storedRecord.tracking_number,
          fulfillment_success: storedRecord.fulfillment_success
        },
        null,
        2
      )
    );

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ SHIPMENT ERROR:");
    console.error(err.response?.data || err.message);

    if (order && order.id) {
      await failOrderProcessing(order.id, {
        order_name: order.name,
        error: err.response?.data || err.message,
        failed_at: new Date().toISOString()
      });
    }

    return res.sendStatus(200);
  }
});

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`🚀 ShipOne running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();
