const axios = require("axios");
// ========================================
// ShipOne → PostNord Product Mapping
// ========================================
function mapServiceToPostNord(shiponeId) {
  const mapping = {
    // ShipOne ID        PostNord ProductCode
    PN_SERVICE_POINT: "19", // MyPack Collect
    PN_HOME: "17",          // MyPack Home
    PN_EXPRESS: "15"        // Express / Parcel
  };

  const code = mapping[shiponeId];

  if (!code) {
    throw new Error("Unknown PostNord service: " + shiponeId);
  }

  return code;
}

const MOCK_MODE = process.env.MOCK_MODE !== "false";

// ===================================
// MOCK MODE
// ===================================
function mockShipment(order) {
  console.log("🧪 MOCK MODE ACTIVE → Shipment NOT sent to PostNord");

  return {
    tracking_number: "MOCK123456",
    service: order.shipone_choice,
  };
}

// ===================================
// GET OAUTH TOKEN (Customer API auth)
// ===================================
async function getAccessToken() {
  const BASE_URL = process.env.POSTNORD_BASE_URL;
  const CLIENT_ID = process.env.POSTNORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.POSTNORD_CLIENT_SECRET;

  console.log("🔑 Fetching OAuth token...");

  const response = await axios.post(
    `${BASE_URL}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "shipment"
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    }
  );

  console.log("✅ OAuth token OK");
  return response.data.access_token;
}

// ===================================
// CREATE SHIPMENT (Customer API)
// ===================================
async function createRealShipment(order) {
  const BASE_URL = process.env.POSTNORD_BASE_URL;
  const CLIENT_ID = process.env.POSTNORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.POSTNORD_CLIENT_SECRET;
  const CUSTOMER_NUMBER = process.env.POSTNORD_CUSTOMER_NUMBER;

  const token = await getAccessToken();

  // Convert ShipOne choice → PostNord product
const productCode = mapServiceToPostNord(order.shipone_choice.id);

const payload = {
  shipment: {
    service: {
      productCode: productCode
    },


        // ✅ THIS IS REQUIRED IN CUSTOMER API
        consignor: {
          partyId: CUSTOMER_NUMBER,
          name: "Your Company Name",   // <-- skriv ditt företagsnamn här
          address: {
            street1: "Your Street 1",  // <-- din adress (måste finnas!)
            postalCode: "12345",
            city: "Stockholm",
            countryCode: "SE"
          }
        },

        receiver: {
          name: `${order.customer.first_name} ${order.customer.last_name}`,
          address: {
            street1: order.shipping_address.address1,
            postalCode: order.shipping_address.zip,
            city: order.shipping_address.city,
            countryCode: order.shipping_address.country_code
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
    ]
  };

  console.log("📦 CORRECT CUSTOMER API PAYLOAD:");
  console.log(JSON.stringify(payload, null, 2));

  const response = await axios.post(
    `${BASE_URL}/shipment/v1/shipments`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",

        // ✅ THIS is the correct gateway for your account
        "X-IBM-Client-Id": CLIENT_ID,
        "X-IBM-Client-Secret": CLIENT_SECRET
      }
    }
  );

  console.log("✅ Shipment created:");
  console.log(response.data);

  return response.data;
}

// ===================================
async function createShipment(order) {
  if (MOCK_MODE) return mockShipment(order);
  return await createRealShipment(order);
}

module.exports = { createShipment };
