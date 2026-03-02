// ================================
// SHIPONE BACKEND (COMMONJS ONLY)
// ================================

const express = require("express");
const { chooseBestOption } = require("./services/routingEngine");
const { createShipment } = require("./services/createShipment");

const { collectRates } = require("./core/rateCollector");
const shipmentStore = require("./services/shipmentStore");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("ShipOne backend is running");
});

app.post("/webhooks/orders-create", async (req, res) => {
  try {
    const order = req.body;

    console.log("📦 NY ORDER:", order.name);

    if (!order.shipping_address) {
      console.log("❌ Missing shipping address");
      return res.sendStatus(200);
    }

    const shippingOptions = await collectRates(order);

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

    const selectedOption = chooseBestOption(
      shippingOptions,
      shiponePreference.toUpperCase()
    );

    console.log("Selected:", selectedOption);

    order.shipone_choice = selectedOption;

    const shipmentResult = await createShipment(order);


    await shipmentStore.save({
      order_id: order.id,
      order_name: order.name,
      carrier: selectedOption.carrier,
      service: selectedOption.name,
      postnord: shipmentResult,
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
