import { createShipment } from "./postnordShipment.js";

// ================================
// SHIPONE BACKEND
// ================================
const express = require("express");
const { chooseBestOption } = require("./services/routingEngine");
const { createShipment } = require("./services/postnord");
const { collectRates } = require("./core/rateCollector");
const shipmentStore = require("./services/shipmentStore");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ================================
// HEALTH CHECK
// ================================
app.get("/", (req, res) => {
  res.send("ShipOne backend is running");
});

// ================================
// SHOPIFY WEBHOOK
// ================================
app.post("/webhooks/orders-create", async (req, res) => {
  try {
    const order = req.body;

    console.log("📦 NY ORDER:", order.name);

    if (!order.shipping_address) {
      console.log("❌ Missing shipping address");
      return res.sendStatus(200);
    }

    // ============================
    // 1️⃣ COLLECT ALL RATES
    // ============================
    const shippingOptions = await collectRates(order);

    // ============================
    // 2️⃣ READ CUSTOMER PREFERENCE
    // ============================
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

    // ============================
    // 3️⃣ LET SHIPONE DECIDE
    // ============================
    const selectedOption = chooseBestOption(
      shippingOptions,
      shiponePreference.toUpperCase()
    );

    console.log("---- SHIPONE DECISION ----");
    console.log("Selected:", selectedOption);
    console.log("--------------------------");

    // ✅ THIS IS THE IMPORTANT FIX
    // We attach the FULL selected option to the order
    order.shipone_choice = selectedOption;

    // ============================
    // 4️⃣ CREATE SHIPMENT
    // ============================
    const shipmentResult = await createShipment(order);

    // ============================
    // 5️⃣ SAVE INTERNALLY (ShipOne memory)
    // ============================
    await shipmentStore.save({
      order_id: order.id,
      order_name: order.name,
      carrier: selectedOption.carrier,
      service: selectedOption.name,
      price: selectedOption.price,
      eta_days: selectedOption.eta_days,
      co2: selectedOption.co2,
      tracking_number: shipmentResult.tracking_number,
      created_at: new Date().toISOString()
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ SHIPMENT ERROR:");
    console.error(err.response?.data || err.message);
    res.sendStatus(200);
  }
});

// ================================
// ================================
// ADMIN: View Shipments
// ================================
app.get("/admin/shipments", (req, res) => {
  const data = shipmentStore.getAll();
  res.json(data);
});

// ================================
// ADMIN: Stats
// ================================
app.get("/admin/stats", (req, res) => {
  const stats = shipmentStore.stats();
  res.json(stats);
});

app.listen(PORT, () => {
  console.log(`🚀 ShipOne running on port ${PORT}`);
});
