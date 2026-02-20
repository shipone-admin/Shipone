const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ================================
// POSTNORD SETTINGS (from Railway)
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
// GET POSTNORD TOKEN
// ================================
async function getToken() {
  console.log("🔐 Requesting PostNord token...");

  const response = await axios.post(
    `${BASE_URL}/oauth2/token`,
    new URLSearchParams({
      grant_type: "client_credentials"
    }),
    {
      auth: {
        username: CLIENT_ID,
        password: CLIENT_SECRET
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  return response.data.access_token;
}

// ================================
// CREATE SHIPMENT
// ================================
async function createShipment(order, token) {
  console.log("📦 Creating PostNord shipment...");

  const shipment = {
    shipment: {
      service: {
        productCode: "19" // MyPack Collect (change later if needed)
      },
      parcels: [{ weight: 1 }],
      shipper: {
        customerNumber: CUSTOMER_NUMBER
      },
      receiver: {
        name: order.customer.first_name + " " + order.customer.last_name,
        addressLine1: order.shipping_address.address1,
        postalCode: order.shipping_address.zip,
        city: order.shipping_address.city,
        countryCode: order.shipping_address.country_code
      }
    }
  };

  const res = await axios.post(
    `${BASE_URL}/rest/shipment/v1/shipments`,
    shipment,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );

  console.log("✅ Shipment created:", res.data);
}

// ================================
// SHOPIFY WEBHOOK
// ================================
app.post("/webhooks/orders-create", async (req, res) => {
  try {
    const order = req.body;

    console.log("📦 NY ORDER MOTTAGEN!");
    console.log("Order:", order.name);

    if (!order.shipping_address) {
      console.log("❌ No shipping address — skipping");
      return res.sendStatus(200);
    }

    const token = await getToken();
    await createShipment(order, token);

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR:", err.response?.data || err.message);
    res.sendStatus(200);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 ShipOne running on port ${PORT}`);
});
