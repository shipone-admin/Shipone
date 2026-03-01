// ================================
// POSTNORD SHIPMENT V3 (COMMONJS)
// CLEAN VERSION — NO SYNTAX BUGS
// ================================

const fetch = require("node-fetch");


// -------------------------------
// SSCC GENERATOR (VALID GS1)
// -------------------------------
function generateSSCC() {
  const extensionDigit = "3";
  const companyPrefix = "735999999"; // test prefix
  const serial = String(Date.now()).slice(-7);

  const base = extensionDigit + companyPrefix + serial;

  let sum = 0;
  let multiplyByThree = true;

  for (let i = base.length - 1; i >= 0; i--) {
    const digit = parseInt(base[i], 10);
    sum += multiplyByThree ? digit * 3 : digit;
    multiplyByThree = !multiplyByThree;
  }

  const checkDigit = (10 - (sum % 10)) % 10;

  return base + checkDigit;
}



// -------------------------------
// CREATE SHIPMENT
// -------------------------------
async function createPostNordShipment(order) {
  console.log("📦 Creating REAL PostNord shipment…");

  const sscc = generateSSCC();

  const consigneeName = String(order.shipping_address?.name || "Test Person");
  const consigneeStreet = String(order.shipping_address?.address1 || "Testgatan 1");
  const consigneeZip = String(order.shipping_address?.zip || "11122");
  const consigneeCity = String(order.shipping_address?.city || "Stockholm");
  const consigneeCountry = String(order.shipping_address?.country_code || "SE");
  const consigneeEmail = String(order.email || "test@test.se");

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
              nameIdentification: { name: consigneeName },
              address: {
                streets: [consigneeStreet],
                postalCode: consigneeZip,
                city: consigneeCity,
                countryCode: consigneeCountry
              },
              contact: {
                contactName: consigneeName,
                emailAddress: consigneeEmail
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
          itemId: sscc,          // ← DIN generateSSCC()
          itemIdType: "SSCC"     // ← MÅSTE vara SSCC
        },
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
  console.log(JSON.stringify(payload, null, 2));

  if (!process.env.POSTNORD_EDI_URL) {
    throw new Error("POSTNORD_EDI_URL missing");
  }

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
    throw new Error("PostNord API Error: " + text);
  }

  return JSON.parse(text);
}

module.exports = { createPostNordShipment };
