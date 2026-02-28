const fetch = require("node-fetch");

async function createPostNordShipment(order) {
  console.log("📡 Sending PostNord EDI request...");

  const body = {
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
            partyIdentification: {
              partyId: process.env.POSTNORD_CUSTOMER_NUMBER,
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

  console.log(JSON.stringify(body, null, 2));

  const response = await fetch(process.env.POSTNORD_EDI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-IBM-Client-Id": process.env.POSTNORD_API_KEY
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();

  console.log("PostNord status:", response.status);
  console.log("PostNord body:", text);

  if (!response.ok) throw new Error(text);

  return JSON.parse(text);
}

module.exports = { createPostNordShipment };
