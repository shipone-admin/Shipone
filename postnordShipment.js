// ========================================
// POSTNORD SHIPMENT V3 — CLEAN FULL FILE
// ========================================

const fetch = require("node-fetch");




  // Extension digit (always 3 for shipments)
  const extensionDigit = "3";

  // PostNord expects your customer number inside the SSCC
  const customerBlock = String(customer).padStart(9, "0");

  // Unique running number (7 digits)
  const serial = String(Date.now()).slice(-7);

  const base17 = extensionDigit + customerBlock + serial;

  // MOD10 checksum
  let sum = 0;
  let multiplyByThree = true;

  for (let i = base17.length - 1; i >= 0; i--) {
    const digit = parseInt(base17[i], 10);
    sum += multiplyByThree ? digit * 3 : digit;
    multiplyByThree = !multiplyByThree;
  }

  const checkDigit = (10 - (sum % 10)) % 10;

  const sscc = base17 + checkDigit;

  console.log("✅ Generated SSCC:", sscc);
  console.log("Length:", sscc.length);

  return sscc;
}



// ----------------------------------------
// CREATE SHIPMENT FUNCTION
// ----------------------------------------
async function createPostNordShipment(order) {

  console.log("📦 Creating PostNord shipment V3");

 const { generateSSCC } = require("./utils/ssccGenerator");
const sscc = generateSSCC();


  const payload = {
    messageDate: new Date().toISOString(),
    messageFunction: "Instruction",
    messageId: "SHIPONE_" + Date.now(),

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
                  itemId: sscc,
                  itemIdType: "SSCC"
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
