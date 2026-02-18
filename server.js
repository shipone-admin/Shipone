const express = require("express");
const app = express();

const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("ShipOne backend is running");
});

app.post("/webhooks/orders-create", async (req, res) => {
  try {
    const order = req.body;

    console.log("📦 NY ORDER MOTTAGEN!");
    console.log("Ordernummer:", order.name);
    console.log("Kund:", order.customer?.first_name);
    console.log("Stad:", order.shipping_address?.city);

    const deliveryChoice = order.note_attributes?.find(
      attr => attr.name === "shipone_delivery"
    );

    console.log(
      "🚚 ShipOne val:",
      deliveryChoice ? deliveryChoice.value : "INGET VALT"
    );

    res.status(200).send("Webhook received");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 ShipOne running on port ${PORT}`);
});
