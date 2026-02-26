const axios = require("axios");

// =====================================================
// ShipOne → PostNord Product Mapping (Customer API)
// =====================================================
function mapServiceToProductCode(shiponeId) {
  const mapping = {
    PN_SERVICE_POINT: "19", // MyPack Collect
    PN_HOME: "17",          // MyPack Home
    PN_EXPRESS: "15"        // Express
  };

  if (!mapping[shiponeId]) {
    throw new Error("Unknown ShipOne service: " + shiponeId);
  }

  return mapping[shiponeId];
}

// =====================================================
// GET OAUTH TOKEN (Customer API)
// =====================================================
async function getAccessToken() {
  const BASE_URL = process.env.POSTNORD_BASE_URL;

  const response = await axios.post(
    `${BASE_URL}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.POSTNORD_CLIENT_ID,
      client_secret: process.env.POSTNORD_CLIENT_SECRET,
      scope: "shipment"
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  return response.data.access_token;
}

// =====================================================
// CREATE SHIPMENT (Customer API REST)
// =====================================================
async function createShipment(order) {
  if (!order.shipone_choice?.id) {
    throw new Error("ShipOne choice missing on order");
  }

  const BASE_URL = process.env.POSTNORD_BASE_URL;
  const productCode = mapServiceToProductCode(order.shipone_choice.id);

  console.log("📦 Using productCode:", productCode);

  const token = await getAccessToken();

 const now = new Date().toISOString();

const payload = {
  shipment: {
    shipmentDate: now,

    product: {
      productCode: productCode
    },

    transportInstruction: "DELIVERY",

    parties: {
      consignor: {
        partyId: process.env.POSTNORD_CUSTOMER_NUMBER,
        name: "ShipOne",
        address: {
          street1: process.env.SHIPPER_STREET,
          postalCode: process.env.SHIPPER_ZIP,
          city: process.env.SHIPPER_CITY,
          countryCode: "SE"
        }
      },

      consignee: {
        name: `${order.customer.first_name} ${order.customer.last_name}`,
        address: {
          street1: order.shipping_address.address1,
          postalCode: order.shipping_address.zip.replace(/\s/g, ""),
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


  console.log("📡 Sending REST shipment to PostNord...");
  console.log(JSON.stringify(payload, null, 2));

  const response = await axios.post(
    `${BASE_URL}/shipment/v1/shipments`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-IBM-Client-Id": process.env.POSTNORD_CLIENT_ID,
        "X-IBM-Client-Secret": process.env.POSTNORD_CLIENT_SECRET
      }
    }
  );

  console.log("✅ Shipment created");
  return response.data;
}

module.exports = { createShipment };
