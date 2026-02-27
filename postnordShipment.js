// =====================================================
// ShipOne → PostNord Shipment V3 (API-KEY AUTH VERSION)
// This version is for "Customer Plan / API Application"
// NO OAuth. NO Bearer token. ONLY API KEY.
// =====================================================

import axios from "axios";

// =====================================================
// Build clean PostNord V3 payload (MINIMUM REQUIRED)
// IMPORTANT: No SSCC, no goods items, no advanced fields.
// PostNord V3 accepts this minimal structure.
// =====================================================
function buildShipmentPayload(order) {
  const now = new Date().toISOString();

  return {
    messageDate: now,
    messageFunction: "Instruction",
    messageId: `SHIPONE_${Date.now()}`,
    updateIndicator: "Original",

    shipment: [
      {
        shipmentIdentification: {
          shipmentId: String(order.id)
        },

        dateAndTimes: {
          loadingDate: now
        },

        // ⚠️ NO basicServiceCode (PostNord selects from agreement)
        service: {
  basicServiceCode: order.shipone_choice.id
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
              }
            }
          }
        }
      }
    ]
  };
}

// =====================================================
// Create Shipment (V3 API KEY AUTH — NOT OAuth)
// =====================================================
export async function createPostNordShipment(order) {
  try {
    const url = `${process.env.POSTNORD_BASE_URL}/rest/shipment/v3/shipments`;

    const payload = buildShipmentPayload(order);

    console.log("📡 Sending PostNord V3 shipment...");
    console.log(JSON.stringify(payload, null, 2));

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",

        // ✅ THIS is the only authentication your plan uses
        apikey: process.env.POSTNORD_API_KEY
      },
      timeout: 15000
    });

    console.log("✅ PostNord shipment created");

    return {
      success: true,
      data: response.data
    };

  } catch (error) {
    console.error("❌ SHIPMENT ERROR:");

    if (error.response) {
      console.error(error.response.data);
      return { success: false, error: error.response.data };
    }

    console.error(error.message);
    return { success: false, error: error.message };
  }
}
