const axios = require("axios");

async function createPostNordShipment(order) {
  console.log("📡 Sending PostNord EDI request...");

  const now = new Date().toISOString();

  // SSCC måste vara 18 siffror
  const sscc = String(Date.now()).padStart(18, "0");

  // POSTNORD EDI BODY — STATISK STRUKTUR (INGEN DYNAMIK SOM KAN GÅ SÖNDER)
  const ediInstruction = {
    messageDate: now,
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
          loadingDate: now
        },

        service: {
          basicServiceCode: "18" // MyPack Home (ändra senare om du vill)
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
                streets: ["Hästhagsvägen 38"],
                postalCode: "29175",
                city: "Färlöv",
                countryCode: "SE"
              }
            }
          },

          consignee: {
            party: {
              nameIdentification: {
                name: order.shipping_name || "Customer"
              },

              address: {
                streets: [order.shipping_address1 || "Unknown"],
                postalCode: order.shipping_zip || "00000",
                city: order.shipping_city || "Unknown",
                countryCode: order.shipping_country || "SE"
              },

              contact: {
                contactName: order.shipping_name || "Customer",
                emailAddress: order.email || "test@test.se",
                smsNo: order.phone || "+46111111111"
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

  console.log("📦 CLEAN EDI STRUCTURE:");
  console.log(JSON.stringify(ediInstruction, null, 2));

  try {
    const response = await axios.post(
      process.env.POSTNORD_EDI_URL,
      ediInstruction,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " +
            Buffer.from(
              process.env.POSTNORD_API_KEY + ":" + process.env.POSTNORD_API_SECRET
            ).toString("base64")
        }
      }
    );

    console.log("✅ POSTNORD SUCCESS");
    console.log(response.data);

    return response.data;
  } catch (error) {
    console.error("❌ POSTNORD ERROR");
    console.error(error.response?.data || error.message);
    throw error;
  }
}

module.exports = { createPostNordShipment };
