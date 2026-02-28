// ===============================
// POSTNORD EDI v3 INTEGRATION
// CommonJS version (Railway-safe)
// ===============================

const fetch = require("node-fetch");

// ====== LOAD ENV VARIABLES ======
const POSTNORD_URL = process.env.POSTNORD_EDI_URL;
const CLIENT_ID = process.env.POSTNORD_API_KEY;
const CUSTOMER_NUMBER = process.env.POSTNORD_CUSTOMER_NUMBER;

// ====== HARD FAIL IF ENV IS MISSING ======
if (!POSTNORD_URL) {
  throw new Error("❌ POSTNORD_EDI_URL is missing in Railway variables");
}

if (!CLIENT_ID) {
  throw new Error("❌ POSTNORD_API_KEY is missing in Railway variables");
}

if (!CUSTOMER_NUMBER) {
  throw new Error("❌ POSTNORD_CUSTOMER_NUMBER is missing in Railway variables");
}

console.log("✅ PostNord config loaded");
console.log("URL:", POSTNORD_URL);

// =========================================

async function createPostNordShipment(order) {
  console.log("📡 Creating REAL PostNord shipment…");

  const payload = {
    messageDate: new Date().toISOString(),
    messageFunction: "Instruction",
    messageId: "SHIPONE_" + Date.now(),

    application: {
      applicationId: "1",
      name: "ShipOne",
      version: "1.0"
    },

    updateIndicator: "Original",

    shipment: [
      {
        shipmentIdentification: {
          shipmentId: String(order.id)
        },

        dateAndTimes: {
          loadingDate: new Date().toISOString()
        },

        service: {
          basicServiceCode: "18" // MyPack / Express test
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
            partyIdentification: {
              partyId: CUSTOMER_NUMBER,
              partyIdType: "160"
            }
          },

          consignee: {
            party: {
              nameIdentification: {
                name: order.shipping_address.name
              },
              address: {
                streets: [order.shipping_address.address1],
                postalCode: order.shipping_address.zip,
                city: order.shipping_address.city,
                countryCode: order.shipping_address.country_code
              }
            }
          }
        },

        goodsItem: [
          {
            packageTypeCode: "PC",
            grossWeight: {
              value: 1,
              unit: "KGM"
            }
          }
        ]
      }
    ]
  };

  console.log("📦 Sending payload to PostNord…");

  const response = await fetch(POSTNORD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-IBM-Client-Id": CLIENT_ID
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  console.log("PostNord status:", response.status);
  console.log("PostNord response:", text);

  if (!response.ok) {
    throw new Error("PostNord API Error: " + text);
  }

  return JSON.parse(text);
}

module.exports = { createPostNordShipment };
