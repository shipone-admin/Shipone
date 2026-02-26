const axios = require("axios");

// =====================================================
// ShipOne → PostNord EDI Service Mapping
// =====================================================
function mapServiceToBasicCode(shiponeId) {
  const mapping = {
    PN_SERVICE_POINT: "19", // MyPack Collect
    PN_HOME: "17",          // MyPack Home
    PN_EXPRESS: "18"        // Parcel (det PostNord bad dig testa!)
  };

  if (!mapping[shiponeId]) {
    throw new Error("Unknown ShipOne service: " + shiponeId);
  }

  return mapping[shiponeId];
}

// =====================================================
// BUILD EDI PAYLOAD (THIS is the correct API)
// =====================================================
function buildPayload(order, basicServiceCode) {
  const now = new Date().toISOString();

  return {
    messageDate: now,
    messageFunction: "Instruction",
    messageId: `SHIPONE_${Date.now()}`,

    application: {
      applicationId: 9999,
      name: "ShipOne",
      version: "1.0"
    },

    updateIndicator: "Original",

    shipment: [
      {
        shipmentIdentification: {
          shipmentId: order.id.toString()
        },

        dateAndTimes: {
          loadingDate: now
        },

        service: {
          basicServiceCode: basicServiceCode
        },

        numberOfPackages: {
          value: 1
        },

        totalGrossWeight: {
          value: 1,
          unit: "KGM"
        },

        parties: {
          consignor: {
            issuerCode: "Z12",
            partyIdentification: {
              partyId: process.env.POSTNORD_CUSTOMER_NUMBER,
              partyIdType: "160"
            },
            party: {
              nameIdentification: {
                name: "ShipOne"
              },
              address: {
                streets: [process.env.SHIPPER_STREET],
                postalCode: process.env.SHIPPER_ZIP,
                city: process.env.SHIPPER_CITY,
                countryCode: "SE"
              }
            }
          },

          consignee: {
            party: {
              nameIdentification: {
                name: `${order.customer.first_name} ${order.customer.last_name}`
              },
              address: {
                streets: [order.shipping_address.address1],
                postalCode: order.shipping_address.zip.replace(/\s/g, ""),
                city: order.shipping_address.city,
                countryCode: order.shipping_address.country_code
              },
              contact: {
                emailAddress: order.email || "test@test.se"
              }
            }
          }
        },

     goodsItem: [
  {
    packageTypeCode: "PC"
  }
]

  };
}

// =====================================================
// CREATE SHIPMENT (EDI v3)
// =====================================================
async function createShipment(order) {
  const BASE_URL = process.env.POSTNORD_BASE_URL;

  const basicServiceCode = mapServiceToBasicCode(order.shipone_choice.id);

  console.log("📦 Using basicServiceCode:", basicServiceCode);

 const payload = buildPayload(order, basicServiceCode);

// 🔒 Convert to CLEAN JSON STRING (prevents corruption)
const jsonBody = JSON.stringify(payload);

console.log("📡 Sending EDI v3 request to PostNord...");

const response = await axios({
  method: "post",
  url: `${BASE_URL}/rest/shipment/v3/edi`,
  data: jsonBody,
  maxBodyLength: Infinity,
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(jsonBody),
    "X-IBM-Client-Id": process.env.POSTNORD_CLIENT_ID,
    "X-IBM-Client-Secret": process.env.POSTNORD_CLIENT_SECRET
  }
});

  console.log("✅ PostNord accepted EDI shipment");
  return { tracking_number: order.id.toString() };
}

module.exports = { createShipment };
