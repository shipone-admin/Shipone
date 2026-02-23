
// ================================
// SHIPONE TEST MODE
// ================================
const MOCK_MODE = true; // ← TRUE tills PostNord aktiverar API

// ================================
const express = require("express");
const axios = require("axios");
const { chooseBestOption } = require("./services/routingEngine");
const { createShipment } = require("./services/postnord");
const { collectRates } = require("./core/rateCollector");
const shipmentStore = require("./services/shipmentStore");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ================================
// ENV (Railway Variables)
// ================================
const CLIENT_ID = process.env.POSTNORD_CLIENT_ID;
const CLIENT_SECRET = process.env.POSTNORD_CLIENT_SECRET;
const CUSTOMER_NUMBER = process.env.POSTNORD_CUSTOMER_NUMBER;
const BASE_URL = process.env.POSTNORD_BASE_URL;

// ================================
// HEALTH CHECK
// ================================
app.get("/", (req, res) => {
  res.send("ShipOne backend is running");
});


// ================================
// CREATE SHIPMENT (REAL POSTNORD)
// ================================

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

   
   // 1️⃣ Collect rates from all carriers
let shippingOptions = await collectRates(order);



    // 2️⃣ Let ShipOne decide
   // Shopify Dawn skickar valet i order.attributes
// --- READ CUSTOMER DELIVERY PREFERENCE FROM SHOPIFY ---
let shiponeChoice = "SMART";

if (order.note_attributes) {
  const attr = order.note_attributes.find(
    (a) => a.name === "shipone_delivery"
  );

  if (attr && attr.value) {
    shiponeChoice = attr.value;
  }
}

// Normalize values coming from theme
if (shiponeChoice === "FASTEST") shiponeChoice = "FAST";
if (shiponeChoice === "CHEAPEST") shiponeChoice = "CHEAP";
if (shiponeChoice === "GREEN") shiponeChoice = "SMART";

console.log("🚚 ShipOne Choice:", shiponeChoice);


console.log("🚚 ShipOne Choice:", shiponeChoice);

const selectedOption = chooseBestOption(
  shippingOptions,
  shiponeChoice.toUpperCase()
);


    console.log("---- SHIPONE DECISION ----");
    console.log("Available:", shippingOptions);
    console.log("Selected:", selectedOption);
    console.log("--------------------------");

    // 3️⃣ Create shipment (or simulate)
    const shipmentResult = await createShipment({
  ...order,
  shipone_choice: shiponeChoice,
  selected_service: selectedOption
});

// Save shipment locally (ShipOne memory)
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
app.listen(PORT, () => {
  console.log(`🚀 ShipOne running on port ${PORT}`);
});
