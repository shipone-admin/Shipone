// ========================================
// POSTNORD SHIPMENT V5 — S10 + TRACKING
// ========================================

const fetch = require("node-fetch");
const { getPostNordLabel } = require("./carriers/postnord.label");

async function postnordShipment(order) {

  console.log("📦 Creating PostNord shipment V5");

  const payload = {
    messageDate: new Date().toISOString(),
    messageFunction: "Instruction",
    messageId: "SHIPONE_" + Date.now(),

    application: {
      applicationId: parseInt(process.env.POSTNORD_APPLICATION_ID || "1001"),
      name: "ShipOne",
      version: "1.0"
    },

    updateIndicator: "Original",

    shipment: [{
      shipmentIdentification: {
        shipmentId: String(order.id)
      },

      dateAndTimes: {
        loadingDate: new Date().toISOString()
      },

      service: {
        basicServiceCode: "18"
      },

      numberOfPackages: { value: 1 },

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
            nameIdentification: { name: "ShipOne" },
            address: {
              streets: ["Terminalvägen 24"],
              postalCode: "17173",
              city: "Solna",
              countryCode: "SE"
            }
          }
        },

        consignee: {
          party: {
            nameIdentification: {
              name: order.shipping_address?.name || "Test Person"
            },
            address: {
              streets: [order.shipping_address?.address1 || "Testgatan 1"],
              postalCode: order.shipping_address?.zip || "11122",
              city: order.shipping_address?.city || "Stockholm",
              countryCode: order.shipping_address?.country_code || "SE"
            }
          }
        }
      },

      goodsItem: [{
        packageTypeCode: "PC",
        items: [{
          itemIdentification: {
            itemId: "0",
            itemIdType: "S10"
          },
          grossWeight: {
            value: 1,
            unit: "KGM"
          }
        }]
      }]
    }]
  };

  const response = await fetch(process.env.POSTNORD_EDI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-IBM-Client-Id": process.env.POSTNORD_API_KEY
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text);
  }

  const data = JSON.parse(text);

  const idInfo = data.idInformation[0];

  const trackingNumber = idInfo.ids[0].value;
  const printId = idInfo.ids[0].printId;
  const trackingUrl = idInfo.urls[0].url;

  console.log("📦 Tracking:", trackingNumber);
  console.log("🖨 PrintId:", printId);

  return {
    trackingNumber,
    trackingUrl,
    printId
  };
}

module.exports = { postnordShipment };
