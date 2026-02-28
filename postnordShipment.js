async function createPostNordShipment(order) {
  console.log("📦 Creating REAL PostNord shipment…");

  const consigneeName = String(order.shipping_address.name || "");
  const consigneeStreet = String(order.shipping_address.address1 || "");
  const consigneeZip = String(order.shipping_address.zip || "");
  const consigneeCity = String(order.shipping_address.city || "");
  const consigneeCountry = String(order.shipping_address.country_code || "SE");
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
              nameIdentification: {
                name: "ShipOne"
              },
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
                name: consigneeName
              },

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
                  itemId: String(order.id),
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

  console.log("📦 Sending payload to PostNord…");
  console.log(JSON.stringify(payload, null, 2));

  const response = await fetch(process.env.POSTNORD_API_URL, {
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
