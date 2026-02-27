// =====================================================
// ShipOne → PostNord EDI V3 (CORRECT IMPLEMENTATION)
// Endpoint: /rest/shipment/v3/edi
// Auth: API KEY (Customer Plan)
// =====================================================

import axios from "axios";

// Hard-set service from Tobias example (Parcel = 18)
// (du kan göra mapping senare)
const SERVICE_CODE = "18";

export async function createPostNordShipment(order) {
  const now = new Date().toISOString();

  const payload = {
    messageDate: now,
    messageFunction: "Instruction",
    messageId: `SHIPONE_${Date.now()}`,

    // REQUIRED in EDI (du saknade denna tidigare)
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
          basicServiceCode: SERVICE_CODE
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

            // THIS is your customer number
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
                name: `${order.customer.first_name} ${order.customer.last_name}`
              },
              address: {
                streets: [order.shipping_address.address1],
                postalCode: order.shipping_address.zip.replace(/\s/g, ""),
                city: order.shipping_address.city,
                countryCode: order.shipping_address.country_code
              },
              contact: {
                contactName: `${order.customer.first_name} ${order.customer.last_name}`,
                emailAddress: order.email || "test@test.com",
                smsNo: order.shipping_address.phone || "+46111111111"
              }
            }
          }
        },

        // REQUIRED for EDI (du tog bort detta felaktigt tidigare)
        goodsItem: [
          {
            packageTypeCode: "PC",
            items: [
              {
                itemIdentification: {
                  itemId: String(order.id).padStart(18, "0"),
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

  try {
    const url = `${process.env.POSTNORD_BASE_URL}/rest/shipment/v3/edi`;

    console.log("📡 Sending PostNord EDI request...");
    console.log(JSON.stringify(payload, null, 2));

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: process.env.POSTNORD_API_KEY
      }
    });

    console.log("✅ POSTNORD OK");

    return response.data;

  } catch (error) {
    console.error("❌ POSTNORD ERROR");
    console.error(error.response?.data || error.message);
    throw error;
  }
}
