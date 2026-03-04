// ========================================
// POSTNORD SHIPMENT V4 — S10 AUTO ID
// ========================================

const fetch = require("node-fetch");

// ----------------------------------------
// CREATE SHIPMENT FUNCTION
// ----------------------------------------
async function createPostNordShipment(order) {

  console.log("📦 Creating PostNord shipment V4 (S10 auto)");

  const payload = {
    messageDate: new Date().toISOString(),
    messageFunction: "Instruction",
    messageId: "SHIPONE_" + Date.now(),

    application: {
  applicationId: 1001,
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
          basicServiceCode: "18"
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
              },
              contact: {
                contactName: order.shipping_address?.name || "Test Person",
                emailAddress: order.email || "test@test.se"
              }
            }
          }
        },

        goodsItem: [
          {
            packageTypeCode: "PC",
            items: [
              {
                itemIdentification: {
                  itemId: "0",
                  itemIdType: "S10"
                },
                grossWeight: {
                  value: 1,
                  unit: "KGM"
                }
              }
            ]
          }
        ]
      }
    ]
  };

  console.log("📡 POST →", process.env.POSTNORD_EDI_URL);

  const response = await fetch(process.env.POSTNORD_EDI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-IBM-Client-Id": process.env.POSTNORD_API_KEY
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  console.log("PostNord status:", response.status);
  console.log("PostNord response:", text);

  if (!response.ok) {
    throw new Error(text);
  }

  return JSON.parse(text);
}

module.exports = { createPostNordShipment };
