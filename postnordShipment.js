// ============================================
// POSTNORD SHIPMENT V3 — CLEAN WORKING VERSION
// NO PATCHES — FULL REPLACEMENT
// ============================================

const fetch = require("node-fetch");


// ------------------------------------------------
// SIMPLE SSCC GENERATOR (ALWAYS 18 DIGITS)
// ------------------------------------------------
function generateSSCC() {
  const prefix = "373599999"; // test prefix from PostNord examples

  // create 8-digit running number
  const serial = String(Date.now()).slice(-8);

  const base = prefix + serial;

  // GS1 checksum calculation
  let sum = 0;
  let multiplyByThree = true;

  for (let i = base.length - 1; i >= 0; i--) {
    const digit = parseInt(base[i]);
    sum += multiplyByThree ? digit * 3 : digit;
    multiplyByThree = !multiplyByThree;
  }

  const checkDigit = (10 - (sum % 10)) % 10;

  const sscc = base + checkDigit;

  console.log("✅ Generated SSCC:", sscc);
  console.log("Length:", sscc.length);

  return sscc;
}



// ------------------------------------------------
// CREATE POSTNORD SHIPMENT
// ------------------------------------------------
async function createPostNordShipment(order) {

  console.log("📦 Creating PostNord shipment V3");

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
          shipmentId: String(order.id) // order reference only
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
                name: order.shipping_address.name
              },
              address: {
                streets: [order.shipping_address.address1],
                postalCode: order.shipping_address.zip,
                city: order.shipping_address.city,
                countryCode: order.shipping_address.country_code || "SE"
              },
              contact: {
                contactName: order.shipping_address.name,
                emailAddress: order.email
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
                  itemId: sscc,        // THIS is the important one
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
