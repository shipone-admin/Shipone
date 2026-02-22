const { getPostNordRates } = require("./carriers/postnord.mock");
// ================================
// SHIPONE TEST MODE
// ================================
const MOCK_MODE = true; // ← TRUE tills PostNord aktiverar API

// ================================
const express = require("express");
const axios = require("axios");
const { chooseBestOption } = require("./services/routingEngine");
const { createShipment } = require("./services/postnord");

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


  console.log("📦 Sending shipment to PostNord...");

  const payload = {
    shipment: {
      service: {
        productCode: "19"
      },
      parcels: [
        {
          weight: 1000
        }
      ],
      shipper: {
        customerNumber: CUSTOMER_NUMBER
      },
      receiver: {
        name: `${order.customer.first_name} ${order.customer.last_name}`,
        addressLine1: order.shipping_address.address1,
        postalCode: order.shipping_address.zip,
        city: order.shipping_address.city,
        countryCode: order.shipping_address.country_code
      }
    }
  };

  const res = await axios.post(
    `${BASE_URL}/rest/shipment/v1/shipments`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        "X-IBM-Client-Id": CLIENT_ID,
        "X-IBM-Client-Secret": CLIENT_SECRET
      }
    }
  );

  console.log("✅ PostNord Response:", res.data);
}

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

    // 1️⃣ Get available shipping options
    let shippingOptions = getPostNordRates(order);


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
    await createShipment({
  ...order,
  shipone_choice: shiponeChoice,
  selected_service: selectedOption
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
