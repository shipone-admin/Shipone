// ShipOne → PostNord Shipment V3 (EDI)


async function createPostNordShipment(order) {
  console.log("📡 Creating REAL PostNord shipment…");

  const url = process.env.POSTNORD_API_URL; 
  // ska vara: https://api2.postnord.com/rest/shipment/v3/edi

  if (!url) {
    throw new Error("POSTNORD_API_URL missing in environment variables");
  }

  const payload = {
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
          basicServiceCode: "18" // Parcel
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
                name: order.shipping_address.name
              },
              address: {
                streets: [order.shipping_address.address1],
                postalCode: order.shipping_address.zip.replace(" ", ""),
                city: order.shipping_address.city,
                countryCode: order.shipping_address.country_code
              },
              contact: {
                contactName: order.shipping_address.name,
                emailAddress: order.email || "test@test.se",
                smsNo: order.phone || "+46700000000"
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

  const response = await fetch(url, {
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
