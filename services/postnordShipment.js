import fetch from "node-fetch";

const BASE_URL = process.env.POSTNORD_BASE_URL;

// --------------------------------------------------
// 1️⃣ HÄMTA TOKEN (OAuth2)
// --------------------------------------------------
async function getAccessToken() {
  const response = await fetch(`${BASE_URL}/oauth2/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.POSTNORD_CLIENT_ID,
      client_secret: process.env.POSTNORD_CLIENT_SECRET
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("Token error: " + text);
  }

  const data = await response.json();
  return data.access_token;
}

// --------------------------------------------------
// 2️⃣ SKAPA SHIPMENT (REN POSTNORD FORMAT)
// --------------------------------------------------
export async function createShipment(order) {
  const token = await getAccessToken();

  const payload = {
    shipment: [
      {
        shipmentIdentification: {
          shipmentId: String(order.orderId)
        },

        service: {
          serviceCode: "19" // MyPack Collect (enklast att få godkänd)
        },

        parties: {
          consignor: {
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
                name: order.name
              },
              address: {
                streets: [order.street],
                postalCode: order.zip,
                city: order.city,
                countryCode: "SE"
              }
            }
          }
        },

        goodsItem: [
          {
            numberOfPackages: { value: 1 },
            totalGrossWeight: { value: 1, unit: "KGM" },
            packageTypeCode: "PC"
          }
        ]
      }
    ]
  };

  const response = await fetch(`${BASE_URL}/rest/shipment/v1/shipments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error("Shipment error: " + text);
  }

  return JSON.parse(text);
}
