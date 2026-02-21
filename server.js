// ===== SHIPONE TEST MODE =====
const MOCK_MODE = true;

const express = require("express");
const axios = require("axios");
const { chooseBestOption } = require("./services/routingEngine");
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ================================
// ENV (Railway)
/// ===============================
const CLIENT_ID = process.env.POSTNORD_CLIENT_ID;
const CLIENT_SECRET = process.env.POSTNORD_CLIENT_SECRET;
const CUSTOMER_NUMBER = process.env.POSTNORD_CUSTOMER_NUMBER;
const BASE_URL = process.env.POSTNORD_BASE_URL;

// ================================
app.get("/", (req, res) => {
  res.send("ShipOne backend is running");
});

// ================================
// CREATE SHIPMENT (PostNord)
// ================================
async function createShipment(order) {
 if (!MOCK_MODE) {
  console.log("📦 Sending shipment to PostNord...");
  await sendToPostNord(order, selectedOption);
} else {
  console.log("🧪 MOCK MODE ACTIVE → Shipment NOT sent to PostNord");
}


  const payload = {
    shipment: {
      service: { productCode: "19" },
      parcels: [{ weight: 1000 }],
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

        // 🔴 THIS is what PostNord requires:
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
let shippingOptions;

if (MOCK_MODE) {
  shippingOptions = getMockShippingOptions(order);
}
const selectedOption = chooseBestOption(
  shippingOptions,
  order.note_attributes?.shipone_choice || "SMART"
);
console.log("---- SHIPONE DECISION ----");
console.log("Available:", shippingOptions);
console.log("Selected:", selectedOption);
console.log("--------------------------");

    console.log("📦 NY ORDER:", order.name);

    if (!order.shipping_address) {
      console.log("❌ Missing address");
      return res.sendStatus(200);
    }

    await createShipment(order);

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ POSTNORD ERROR:");
    console.error(err.response?.data || err.message);
    res.sendStatus(200);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 ShipOne running on port ${PORT}`);
});
function getMockShippingOptions(order) {
  console.log("📦 Using MOCK shipping (PostNord not active)");

  return [
    {
      id: "PN_SERVICE_POINT",
      name: "Service Point",
      price: 59,
      eta_days: 2
    },
    {
      id: "PN_HOME",
      name: "Home Delivery",
      price: 79,
      eta_days: 2
    },
    {
      id: "PN_EXPRESS",
      name: "Express",
      price: 109,
      eta_days: 1
    }
  ];
}
