const axios = require("axios");

// =====================================================
// ShipOne → PostNord Service Mapping (EDI)
// =====================================================
function mapServiceToBasicCode(shiponeId) {
  const mapping = {
    PN_SERVICE_POINT: "19", // Collect
    PN_HOME: "17",          // Home
    PN_EXPRESS: "18"        // Parcel (PostNord recommended)
  };

  if (!mapping[shiponeId]) {
    throw new Error("Unknown ShipOne service: " + shiponeId);
  }

  return mapping[shiponeId];
}

// =====================================================
// BUILD MINIMAL VALID EDI PAYLOAD (for SaaS / Webshop)
// =====================================================
function buildPayload(order, basicServiceCode) {
  const now = new Date().toISOString();

  return {
    messageDate: now,
    messageFunction: "Instruction",
    messageId: `SHIPONE_${Date.now()}`,

    application: {
      applicationId: 1,
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
              }
            }
          }
        },

        // ✅ MINIMAL goodsItem — NO SSCC, NO items
        goodsItem: [
          {
            packageTypeCode: "PC"
          }
        ]
      }
    ]
  };
}

// =====================================================
// CREATE SHIPMENT (EDI v3)
// =====================================================
async function createShipment(order) {
  if (!order.shipone_choice?.id) {
    throw new Error("ShipOne choice missing");
  }

  const BASE_URL = process.env.POSTNORD_BASE_URL;
  const CLIENT_ID = process.env.POSTNORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.POSTNORD_CLIENT_SECRET;

  const basicServiceCode = mapServiceToBasicCode(order.shipone_choice.id);

  console.log("📦 Using basicServiceCode:", basicServiceCode);

  const payload = buildPayload(order, basicServiceCode);

  console.log("📡 Sending EDI v3 request to PostNord...");
  console.log(JSON.stringify(payload, null, 2));

  const response = await axios.post(
    `${BASE_URL}/rest/shipment/v3/edi`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        "X-IBM-Client-Id": CLIENT_ID,
        "X-IBM-Client-Secret": CLIENT_SECRET
      },
      maxBodyLength: Infinity
    }
  );

  console.log("✅ PostNord accepted shipment");

  return {
    tracking_number: response.data?.shipmentId || String(order.id)
  };
}

module.exports = { createShipment };
