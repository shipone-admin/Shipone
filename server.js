const express = require("express");
const axios = require("axios");

const { initDatabase, query } = require("./services/db");
const { chooseBestOption } = require("./services/routingEngine");
const { createShipment } = require("./services/createShipment");
const { fulfillShopifyOrder } = require("./services/shopifyfulfillment");
const { collectRates } = require("./core/rateCollector");
const {
  beginOrderProcessing,
  failOrderProcessing,
  saveShipmentOutcome,
  readShipments,
  findShipmentByOrderId,
  getRecentShipments
} = require("./services/shipmentStore");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

function formatCarrierName(carrier) {
  if (!carrier) return "Okänd transportör";

  const normalized = String(carrier).toLowerCase();

  if (normalized === "postnord") return "PostNord";
  if (normalized === "dhl") return "DHL";
  if (normalized === "budbee") return "Budbee";

  return carrier;
}

function formatShipmentStatus(status) {
  if (!status) return "Okänd status";

  const normalized = String(status).toLowerCase();

  if (normalized === "completed") return "Skickad";
  if (normalized === "processing") return "Behandlas";
  if (normalized === "failed") return "Misslyckades";

  return status;
}

function formatDateSv(dateValue) {
  if (!dateValue) return "-";

  try {
    return new Date(dateValue).toLocaleString("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (error) {
    return String(dateValue);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTrackingPage(shipment) {
  const orderName = escapeHtml(shipment.order_name || "-");
  const carrier = escapeHtml(formatCarrierName(shipment.actual_carrier));
  const status = escapeHtml(formatShipmentStatus(shipment.status));
  const trackingNumber = escapeHtml(shipment.tracking_number || "-");
  const trackingUrl = escapeHtml(shipment.tracking_url || "#");
  const createdAt = escapeHtml(formatDateSv(shipment.created_at));
  const completedAt = escapeHtml(formatDateSv(shipment.completed_at));
  const headingText =
    shipment.status === "completed"
      ? "Ditt paket är skickat"
      : shipment.status === "processing"
      ? "Din leverans behandlas"
      : shipment.status === "failed"
      ? "Ett problem uppstod med leveransen"
      : "Leveransstatus";

  return `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>ShipOne Tracking</title>
      <style>
        :root {
          --bg: #f4f6fb;
          --card: #ffffff;
          --text: #14213d;
          --muted: #64748b;
          --line: #e5e7eb;
          --brand: #2563eb;
          --brand-dark: #1d4ed8;
          --soft: #eef4ff;
          --success: #0f766e;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: var(--bg);
          color: var(--text);
        }

        .wrap {
          max-width: 980px;
          margin: 0 auto;
          padding: 36px 18px 60px;
        }

        .card {
          background: var(--card);
          border-radius: 24px;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }

        .hero {
          padding: 34px 34px 18px;
          background:
            radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 35%),
            linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          border-bottom: 1px solid var(--line);
        }

        .brand {
          color: var(--brand);
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 1.6px;
          margin-bottom: 12px;
        }

        h1 {
          margin: 0;
          font-size: 46px;
          line-height: 1.05;
        }

        .subtitle {
          margin: 12px 0 0;
          color: var(--muted);
          font-size: 18px;
          line-height: 1.5;
          max-width: 640px;
        }

        .content {
          padding: 28px 34px 34px;
        }

        .status-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--soft);
          border: 1px solid #dbeafe;
          color: var(--brand-dark);
          border-radius: 16px;
          padding: 16px 18px;
          margin-bottom: 24px;
        }

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: var(--success);
          flex: 0 0 auto;
        }

        .status-text strong {
          display: block;
          font-size: 16px;
          margin-bottom: 4px;
        }

        .status-text span {
          color: var(--muted);
          font-size: 14px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .item {
          background: #f8fafc;
          border: 1px solid #eef2f7;
          border-radius: 18px;
          padding: 20px;
        }

        .label {
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.7px;
          margin-bottom: 8px;
        }

        .value {
          font-size: 18px;
          font-weight: 700;
          line-height: 1.45;
          word-break: break-word;
        }

        .actions {
          margin-top: 28px;
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
        }

        .button {
          display: inline-block;
          text-decoration: none;
          background: var(--brand);
          color: white;
          font-weight: 700;
          padding: 15px 22px;
          border-radius: 14px;
          transition: background 0.2s ease;
        }

        .button:hover {
          background: var(--brand-dark);
        }

        .secondary {
          display: inline-block;
          text-decoration: none;
          color: var(--brand);
          font-weight: 700;
          padding: 15px 4px;
        }

        .footer {
          margin-top: 26px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.6;
        }

        @media (max-width: 760px) {
          h1 {
            font-size: 36px;
          }

          .hero,
          .content {
            padding-left: 20px;
            padding-right: 20px;
          }

          .grid {
            grid-template-columns: 1fr;
          }

          .subtitle {
            font-size: 16px;
          }
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <div class="hero">
            <div class="brand">SHIPONE</div>
            <h1>Tracking</h1>
            <p class="subtitle">${headingText}. Här kan du följa din leverans och öppna spårningen hos transportören.</p>
          </div>

          <div class="content">
            <div class="status-banner">
              <div class="status-dot"></div>
              <div class="status-text">
                <strong>Status: ${status}</strong>
                <span>Order ${orderName} hanteras via ${carrier}.</span>
              </div>
            </div>

            <div class="grid">
              <div class="item">
                <div class="label">Order</div>
                <div class="value">${orderName}</div>
              </div>

              <div class="item">
                <div class="label">Transportör</div>
                <div class="value">${carrier}</div>
              </div>

              <div class="item">
                <div class="label">Status</div>
                <div class="value">${status}</div>
              </div>

              <div class="item">
                <div class="label">Trackingnummer</div>
                <div class="value">${trackingNumber}</div>
              </div>

              <div class="item">
                <div class="label">Skapad</div>
                <div class="value">${createdAt}</div>
              </div>

              <div class="item">
                <div class="label">Slutförd</div>
                <div class="value">${completedAt}</div>
              </div>
            </div>

            <div class="actions">
              <a class="button" href="${trackingUrl}" target="_blank" rel="noopener noreferrer">
                Öppna spårning hos transportör
              </a>
            </div>

            <div class="footer">
              ShipOne hjälper butiker att välja rätt fraktalternativ och ge kunder enkel spårning.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function renderTrackingNotFoundPage() {
  return `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>ShipOne Tracking</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #f4f6fb;
          color: #14213d;
          padding: 40px 20px;
        }
        .card {
          max-width: 760px;
          margin: 0 auto;
          background: white;
          border-radius: 22px;
          padding: 34px;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
        }
        .brand {
          color: #2563eb;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 1.6px;
          margin-bottom: 12px;
        }
        h1 {
          margin: 0 0 12px;
          font-size: 40px;
        }
        p {
          margin: 0;
          color: #64748b;
          font-size: 17px;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="brand">SHIPONE</div>
        <h1>Tracking</h1>
        <p>Vi kunde inte hitta något paket med det här trackingnumret.</p>
      </div>
    </body>
    </html>
  `;
}

function renderTrackingErrorPage() {
  return `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>ShipOne Tracking</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #f4f6fb;
          color: #14213d;
          padding: 40px 20px;
        }
        .card {
          max-width: 760px;
          margin: 0 auto;
          background: white;
          border-radius: 22px;
          padding: 34px;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
        }
        .brand {
          color: #2563eb;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 1.6px;
          margin-bottom: 12px;
        }
        h1 {
          margin: 0 0 12px;
          font-size: 40px;
        }
        p {
          margin: 0;
          color: #64748b;
          font-size: 17px;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="brand">SHIPONE</div>
        <h1>Tracking</h1>
        <p>Det gick inte att hämta spårningen just nu. Försök igen om en liten stund.</p>
      </div>
    </body>
    </html>
  `;
}

app.get("/", (req, res) => {
  res.send("ShipOne backend is running");
});

app.get("/shipments", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 20);
    const shipments = await getRecentShipments(limit);

    return res.status(200).json({
      success: true,
      total: shipments.length,
      shipments
    });
  } catch (error) {
    console.error("❌ Failed to read shipments:");
    console.error(error.message);

    return res.status(500).json({
      success: false,
      error: "Failed to read shipments"
    });
  }
});

app.get("/shipments/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const shipment = await findShipmentByOrderId(orderId);

    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: "Shipment not found"
      });
    }

    return res.status(200).json({
      success: true,
      shipment
    });
  } catch (error) {
    console.error("❌ Failed to read shipment by order id:");
    console.error(error.message);

    return res.status(500).json({
      success: false,
      error: "Failed to read shipment"
    });
  }
});

app.get("/shipments-debug", async (req, res) => {
  try {
    const shipments = await readShipments();

    return res.status(200).json({
      success: true,
      total: shipments.length,
      shipments
    });
  } catch (error) {
    console.error("❌ Failed to debug shipments:");
    console.error(error.message);

    return res.status(500).json({
      success: false,
      error: "Failed to debug shipments"
    });
  }
});

app.get("/track/:trackingNumber", async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    const result = await query(
      `SELECT * FROM shipments WHERE tracking_number = $1 LIMIT 1`,
      [trackingNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(renderTrackingNotFoundPage());
    }

    const shipment = result.rows[0];

    return res.status(200).send(renderTrackingPage(shipment));
  } catch (error) {
    console.error("❌ Tracking lookup failed:");
    console.error(error.message);

    return res.status(500).send(renderTrackingErrorPage());
  }
});

app.get("/oauth/callback", async (req, res) => {
  try {
    const { code, shop } = req.query;

    console.log("SHOP:", shop);
    console.log("CODE:", code);

    if (!code) {
      return res.send("No OAuth code received");
    }

    const response = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code: code
      }
    );

    const accessToken = response.data.access_token;

    console.log("✅ SHOPIFY ACCESS TOKEN:");
    console.log(accessToken);

    return res.send("TOKEN GENERATED. CHECK RAILWAY LOGS.");
  } catch (error) {
    console.error("❌ OAuth error:");
    console.error(error.response?.data || error.message);

    return res.send("OAuth failed");
  }
});

app.post("/webhooks/orders-create", async (req, res) => {
  const order = req.body;

  try {
    console.log("📦 NEW ORDER:", order?.name);

    if (!order || !order.id) {
      console.log("❌ Missing order id");
      return res.sendStatus(200);
    }

    const processingState = await beginOrderProcessing(order);

    if (!processingState.started) {
      if (processingState.reason === "already_processing") {
        console.log("🛑 Duplicate webhook blocked: order already processing");
        console.log("Order ID:", order.id);
        return res.sendStatus(200);
      }

      if (processingState.reason === "already_completed") {
        console.log("🛑 Duplicate webhook blocked: order already completed");
        console.log("Order ID:", order.id);
        return res.sendStatus(200);
      }
    }

    console.log("🔒 Idempotency lock created for order:", order.id);

    if (!order.shipping_address) {
      console.log("❌ Missing shipping address");

      await failOrderProcessing(order.id, {
        order_name: order.name,
        error: "Missing shipping address"
      });

      return res.sendStatus(200);
    }

    const shippingOptions = await collectRates(order);

    let shiponePreference = "SMART";

    if (Array.isArray(order.note_attributes)) {
      const attr = order.note_attributes.find(
        (a) => a.name === "shipone_delivery"
      );

      if (attr && attr.value) {
        shiponePreference = attr.value;
      }
    }

    if (shiponePreference === "FASTEST") shiponePreference = "FAST";
    if (shiponePreference === "CHEAPEST") shiponePreference = "CHEAP";
    if (shiponePreference === "GREEN") shiponePreference = "SMART";

    console.log("🚚 ShipOne Choice:", shiponePreference);

    const selectedOption = chooseBestOption(
      shippingOptions,
      shiponePreference.toUpperCase()
    );

    if (!selectedOption) {
      console.log("❌ No shipping option could be selected");

      await failOrderProcessing(order.id, {
        order_name: order.name,
        shipone_choice: shiponePreference,
        error: "No shipping option selected"
      });

      return res.sendStatus(200);
    }

    console.log("✅ Selected option:");
    console.log(selectedOption);

    order.shipone_choice = selectedOption;

    const shipmentResult = await createShipment(order, selectedOption);

    let fulfillmentResult = {
      success: false,
      skipped: true,
      reason: "Shipment was not created"
    };

    let trackingNumber = null;
    let trackingUrl = null;

    if (shipmentResult.success && shipmentResult.data) {
      trackingNumber = shipmentResult.data.trackingNumber || null;
      trackingUrl = shipmentResult.data.trackingUrl || null;

      fulfillmentResult = await fulfillShopifyOrder(
        order.id,
        trackingNumber,
        trackingUrl
      );

      if (fulfillmentResult.success) {
        console.log("✅ Shopify fulfillment completed");
      } else {
        console.log("❌ Shopify fulfillment failed");
        console.log(
          JSON.stringify(
            {
              step: fulfillmentResult.step,
              status: fulfillmentResult.status,
              error: fulfillmentResult.error,
              attempts: fulfillmentResult.attempts || 1
            },
            null,
            2
          )
        );
      }
    } else {
      console.log("❌ Shipment creation failed, skipping Shopify fulfillment");
    }

    const storedRecord = await saveShipmentOutcome(order, {
      shipone_choice: shiponePreference,
      selected_option: selectedOption,
      selected_carrier: selectedOption.carrier || null,
      selected_service: selectedOption.name || null,
      actual_carrier: shipmentResult.carrier || null,
      fallback_used: shipmentResult.fallbackUsed || false,
      fallback_from: shipmentResult.fallbackFrom || null,
      tracking_number: trackingNumber,
      tracking_url: trackingUrl,
      shipment_success: shipmentResult.success,
      fulfillment_success: fulfillmentResult.success || false,
      shipment_result: shipmentResult,
      fulfillment_result: fulfillmentResult,
      error:
        shipmentResult.success
          ? fulfillmentResult.success
            ? null
            : fulfillmentResult.error || "Shopify fulfillment failed"
          : shipmentResult.error || "Shipment creation failed"
    });

    console.log("💾 Shipment stored with completed status");
    console.log("🧾 Stored record summary:");
    console.log(
      JSON.stringify(
        {
          order_id: storedRecord.order_id,
          order_name: storedRecord.order_name,
          status: storedRecord.status,
          selected_carrier: storedRecord.selected_carrier,
          actual_carrier: storedRecord.actual_carrier,
          tracking_number: storedRecord.tracking_number,
          fulfillment_success: storedRecord.fulfillment_success
        },
        null,
        2
      )
    );

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ SHIPMENT ERROR:");
    console.error(err.response?.data || err.message);

    if (order && order.id) {
      await failOrderProcessing(order.id, {
        order_name: order.name,
        error: err.response?.data || err.message,
        failed_at: new Date().toISOString()
      });
    }

    return res.sendStatus(200);
  }
});

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`🚀 ShipOne running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();
