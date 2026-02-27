// =====================================================
// SHIPONE BACKEND (ES MODULE VERSION - CLEAN BUILD)
// =====================================================

import express from "express";
import { chooseBestOption } from "./services/routingEngine.js";
import { createPostNordShipment } from "./postnordShipment.js";
import { collectRates } from "./core/rateCollector.js";
import shipmentStore from "./services/shipmentStore.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// =====================================================
// HEALTH CHECK
// =====================================================
app.get("/", (req, res) => {
  res.send("ShipOne backend is running");
});

// =====================================================
// SHOPIFY WEBHOOK
// =====================================================
app.post("/webhooks/orders-create", async (req, res) => {
  try {
    const order = req.body;

    console.log("📦 NY ORDER:", order.name);

    if (!order.shipping_address) {
      console.log("❌ Missing shipping address");
      return res.sendStatus(200);
    }

    // =================================================
    // 1️⃣ COLLECT RATES (MOCK / FUTURE REAL)
    // =================================================
    const shippingOptions = await collectRates(order);

    // =================================================
    // 2️⃣ CUSTOMER PREFERENCE
    // =================================================
    let shiponePreference = "SMART";

    if (order.note_attributes) {
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

    // =================================================
    // 3️⃣ SHIPONE DECISION ENGINE
    // =================================================
    const selectedOption = chooseBestOption(
      shippingOptions,
      shiponePreference.toUpperCase()
    );

    console.log("---- SHIPONE DECISION ----");
    console.log("Selected:", selectedOption);
    console.log("--------------------------");

    // attach decision to order
    order.shipone_choice = selectedOption;

    // =================================================
    // 4️⃣ CREATE POSTNORD SHIPMENT (REAL API)
    // =================================================
    const shipmentResult = await createPostNordShipment(order);

    // =================================================
    // 5️⃣ STORE INTERNALLY
    // =================================================
    await shipmentStore.save({
      order_id: order.id,
      order_name: order.name,
      carrier: selectedOption.carrier,
      service: selectedOption.name,
      price: selectedOption.price,
      eta_days: selectedOption.eta_days,
      co2: selectedOption.co2,
      postnord_response: shipmentResult,
      created_at: new Date().toISOString()
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ SHIPMENT ERROR:");
    console.error(err.response?.data || err.message);
    res.sendStatus(200);
  }
});

// =====================================================
// ADMIN: VIEW SHIPMENTS
// =====================================================
app.get("/admin/shipments", (req, res) => {
  const data = shipmentStore.getAll();
  res.json(data);
});

// =====================================================
// ADMIN: STATS
// =====================================================
app.get("/admin/stats", (req, res) => {
  const stats = shipmentStore.stats();
  res.json(stats);
});

// =====================================================
// START SERVER
// =====================================================
app.listen(PORT, () => {
  console.log(`🚀 ShipOne running on port ${PORT}`);
});
