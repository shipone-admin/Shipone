const axios = require("axios");

const MOCK_MODE = process.env.MOCK_MODE !== "false"; 
// Default = true. Sätt MOCK_MODE=false i Railway när vi vill köra live.

// ==============================
// MOCK (fallback safety)
// ==============================
function mockShipment(order) {
  console.log("🧪 MOCK MODE ACTIVE → Shipment NOT sent to PostNord");

  return {
    tracking_number: "MOCK123456",
    service: order.shipone_choice,
  };
}

// ==============================
// REAL POSTNORD CALL
// ==============================
async function createRealShipment(order) {
  console.log("📡 Sending REAL shipment to PostNord...");

  const CLIENT_ID = process.env.POSTNORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.POSTNORD_CLIENT_SECRET;
  const CUSTOMER_NUMBER = process.env.POSTNORD_CUSTOMER_NUMBER;
  const BASE_URL = process.env.POSTNORD_BASE_URL;

  if (!CLIENT_ID || !CLIENT_SECRET || !CUSTOMER_NUMBER || !BASE_URL) {
    throw new Error("Missing PostNord ENV variables");
  }

  // ---- THIS IS THE IMPORTANT PART ----
  // Payload must match PostNord schema EXACTLY
  const payload = {
    shipment: {
      service: {
        productCode: "19" // Service Point test (we change later dynamically)
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

  console.log("📦 PostNord Payload:");
  console.log(JSON.stringify(payload, null, 2));

  const response = await axios.post(
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

  console.log("✅ PostNord RESPONSE:");
  console.log(response.data);

  return response.data;
}

// ==============================
// MAIN EXPORT
// ==============================
async function createShipment(order) {
  if (MOCK_MODE) {
    return mockShipment(order);
  }

  return await createRealShipment(order);
}

module.exports = {
  createShipment
};
