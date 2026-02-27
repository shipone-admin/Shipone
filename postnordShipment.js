const axios = require("axios");

const BASE_URL = process.env.POSTNORD_BASE_URL;
const CLIENT_ID = process.env.POSTNORD_CLIENT_ID;
const CLIENT_SECRET = process.env.POSTNORD_CLIENT_SECRET;
const CUSTOMER_NUMBER = process.env.POSTNORD_CUSTOMER_NUMBER;

let cachedToken = null;
let tokenExpires = 0;

// ============================
// AUTH
// ============================
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpires) {
    return cachedToken;
  }

  const res = await axios.post(
    `${BASE_URL}/oauth2/v2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      auth: {
        username: CLIENT_ID,
        password: CLIENT_SECRET
      }
    }
  );

  cachedToken = res.data.access_token;
  tokenExpires = Date.now() + (res.data.expires_in - 60) * 1000;

  return cachedToken;
}

// ============================
// CREATE SHIPMENT
// ============================
async function createShipment(order) {
  const token = await getAccessToken();
  const addr = order.shipping_address;

  const payload = {
    shipments: [
      {
        product: { productCode: "19" },
        parties: {
          shipper: {
            name: "ShipOne",
            customerNumber: CUSTOMER_NUMBER,
            address: {
              street1: process.env.SHIPPER_STREET,
              postalCode: process.env.SHIPPER_ZIP,
              city: process.env.SHIPPER_CITY,
              countryCode: "SE"
            }
          },
          receiver: {
            name: `${addr.first_name} ${addr.last_name}`,
            address: {
              street1: addr.address1,
              postalCode: addr.zip,
              city: addr.city,
              countryCode: addr.country_code || "SE"
            }
          }
        },
        parcels: [
          {
            weight: { value: 1, unit: "kg" }
          }
        ]
      }
    ]
  };

  console.log("📡 Sending shipment to PostNord...");

  const res = await axios.post(`${BASE_URL}/rest/shipment/v1/shipments`, payload, {
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "x-api-key": process.env.POSTNORD_API_KEY
  }
});


  console.log("✅ PostNord OK");

  return {
    tracking_number:
      res.data.shipments?.[0]?.trackingNumbers?.[0] || "pending"
  };
}

module.exports = { createShipment };
