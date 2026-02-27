export async function createPostNordShipment(order) {
  console.log("📡 Sending PostNord V3 EDI...");

  const body = {
    messageDate: new Date().toISOString(),
    messageFunction: "Instruction",
    messageId: `SHIPONE_${Date.now()}`,

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

        totalGrossWeight: {
          value: 1,
          unit: "KGM"
        },

        numberOfPackages: {
          value: 1
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
                name: order.name
              },
              address: {
                streets: [order.street],
                postalCode: order.postcode,
                city: order.city,
                countryCode: "SE"
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

  console.log("PostNord response status:", response.status);
  console.log("PostNord response body:", text);

  if (!response.ok) {
    throw new Error("PostNord booking failed");
  }

  return JSON.parse(text);
}
