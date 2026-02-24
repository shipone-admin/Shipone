const axios = require("axios");

const MOCK_MODE = process.env.MOCK_MODE !== "false";

// =====================================================
// ShipOne → PostNord Product Mapping (CRITICAL)
// =====================================================
function mapServiceToPostNord(shiponeId) {
  const mapping = {
    PN_SERVICE_POINT: "19", // MyPack Collect
    PN_HOME: "17",          // MyPack Home
    PN_EXPRESS: "15"        // Express
  };

  if (!mapping[shiponeId]) {
    throw new Error("❌ Unknown ShipOne service: " + shiponeId);
  }

  return mapping[shiponeId];
}

// =====================================================
// MOCK MODE (used while debugging)
// =====================================================
function mockShipment(order) {
  console.log("🧪 MOCK SHIPMENT (nothing sent to PostNord)");

  return {
    tracking_number: "MOCK123456",
    service: order.shipone_choice
  };
}

// =====================================================
// STEP 1 — GET OAUTH TOKEN (Customer API requires this)
// =====================================================
async function getAccessToken() {
  const BASE_URL = process.env.POSTNORD_BASE_URL;
  const CLIENT_ID = process.env.POSTNORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.POSTNORD_CLIENT_SECRET;

  console.log("🔑 Requesting OAuth token...");

  const response = await axios.post(
    `${BASE_URL}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "shipment"
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  console.log("✅ OAuth token received");
  return response.data.access_token;
}

// =====================================================
// STEP 2 — CREATE SHIPMENT (Customer API)
// =====================================================
async function createRealShipment(order) {
  const BASE_URL = process.env.POSTNORD_BASE_URL;
  const CLIENT_ID = process.env.POSTNORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.POSTNORD_CLIENT_SECRET;
  const CUSTOMER_NUMBER = process.env.POSTNORD_CUSTOMER_NUMBER;

  if (!order.shipone_choice || !order.shipone_choice.id) {
    throw new Error("ShipOne choice missing on order");
  }

  // 🔥 Translate ShipOne → PostNord
  const productCode = mapServiceToPostNord(order.shipone_choice.id);

  console.log("📦 Using PostNord productCode:", productCode);

  const token = await getAccessToken();

  // =====================================================
  // THIS STRUCTURE MATCHES CUSTOMER API (NOT OLD API)
  // =====================================================
  const payload = {
    shipment: {
      product: {
        productCode: productCode
      },

      parties: {
        consignor: {
          partyId: CUSTOMER_NUMBER
        },

        consignee: {
          name: `${order.customer.first_name} ${order.customer.last_name}`,
          address: {
            street1: order.shipping_address.address1,
            postalCode: order.shipping_address.zip,
            city: order.shipping_address.city,
            countryCode: order.shipping_address.country_code
          }
        }
      },

      parcels: [
        {
          weight: {
            value: 1,
            unit: "kg"
          }
        }
      ]
    }
  };

  console.log("📡 Sending shipment to PostNord...");
  console.log(JSON.stringify(payload, null, 2));

  const response = await axios.post(
    `${BASE_URL}/shipment/v1/shipments`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-IBM-Client-Id": CLIENT_ID,
        "X-IBM-Client-Secret": CLIENT_SECRET
      }
    }
  );

  console.log("✅ Shipment created successfully");
  return response.data;
}

// =====================================================
async function createShipment(order) {
  if (MOCK_MODE) return mockShipment(order);
  return await createRealShipment(order);
}

module.exports = { createShipment };
