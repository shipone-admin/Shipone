const axios = require("axios");

async function createPostNordShipment(order) {
  const now = new Date().toISOString();

  const payload = {
    messageDate: now,
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
          loadingDate: now
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
                name:
                  order.shipping_address.first_name +
                  " " +
                  order.shipping_address.last_name
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

        goodsItem: [
          {
            packageTypeCode: "PC",
            items: [
              {
                itemIdentification: {
                  itemId: String(Date.now()).padStart(18, "0"),
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

  console.log("📡 Sending PostNord V3 EDI...");
  console.log(JSON.stringify(payload, null, 2));

  const response = await axios.post(
    process.env.POSTNORD_BASE_URL + "/rest/shipment/v3/edi",
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        "X-IBM-Client-Id": process.env.POSTNORD_CLIENT_ID,
        "X-IBM-Client-Secret": process.env.POSTNORD_CLIENT_SECRET
      }
    }
  );

  console.log("✅ PostNord response OK");
  return response.data;
}

module.exports = { createPostNordShipment };
