const express = require("express");
const axios = require("axios");

const { initDatabase, query } = require("./services/db");
const { chooseBestOption } = require("./services/routingEngine");
const { createShipment } = require("./services/createShipment");
const { fulfillShopifyOrder } = require("./services/shopifyfulfillment");
const { collectRates } = require("./core/rateCollector");

const { buildTrackingEvents } = require("./services/trackingEvents");
const { fetchPostNordTracking } = require("./services/postnordTracking");
const { fetchDHLTracking } = require("./services/dhlTracking");
const { getDisplayStatus } = require("./services/trackingStatus");
const { saveCarrierTrackingSnapshot } = require("./services/trackingSyncStore");

const {
  syncPostNordTrackingByTrackingNumber,
  syncPostNordTrackingByOrderId
} = require("./services/trackingSyncService");

const {
  syncPostNordBatch,
  syncActivePostNordBatch
} = require("./services/trackingBatchSyncService");

const { runPostNordActiveSyncJob } = require("./services/jobSyncService");

const {
  beginOrderProcessing,
  failOrderProcessing,
  saveShipmentOutcome,
  findShipmentByOrderId,
  getRecentShipments
} = require("./services/shipmentStore");

const {
  renderTrackingPage,
  renderTrackingNotFoundPage,
  renderTrackingErrorPage
} = require("./views/trackingPage");

const { renderHomePage } = require("./views/homePage");
const { renderAdminDashboard } = require("./views/adminDashboard");
const { renderAdminShipmentDetails } = require("./views/adminShipmentDetails");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const prefix = "Bearer ";

  if (!header.startsWith(prefix)) {
    return null;
  }

  return header.slice(prefix.length).trim();
}

function requireCronSecret(req, res, next) {
  const configuredSecret = String(process.env.CRON_SECRET || "").trim();

  const providedSecret = getBearerToken(req) || req.query.token || "";

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized"
    });
  }

  return next();
}

function normalizeAdminFilters(queryParams) {
  return {
    q: String(queryParams.q || "").trim(),
    status: String(queryParams.status || "").trim().toLowerCase(),
    carrier: String(queryParams.carrier || "").trim().toLowerCase(),
    health: String(queryParams.health || "").trim().toLowerCase()
  };
}

function matchesAdminFilters(shipment, filters) {
  const searchHaystack = [
    shipment.order_name,
    shipment.order_id,
    shipment.tracking_number
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (filters.q && !searchHaystack.includes(filters.q.toLowerCase())) {
    return false;
  }

  if (filters.status) {
    const shipmentStatus = String(shipment.status || "").toLowerCase();
    if (shipmentStatus !== filters.status) {
      return false;
    }
  }

  if (filters.carrier) {
    const shipmentCarrier = String(shipment.actual_carrier || "").toLowerCase();
    if (shipmentCarrier !== filters.carrier) {
      return false;
    }
  }

  return true;
}

async function getLiveCarrierTrackingForShipment(shipment) {
  const actualCarrier = String(shipment?.actual_carrier || "").toLowerCase();

  if (actualCarrier === "postnord") {
    return fetchPostNordTracking(shipment.tracking_number);
  }

  if (actualCarrier === "dhl") {
    return fetchDHLTracking(shipment.tracking_number);
  }

  return {
    success: false,
    skipped: true,
    reason: "Live carrier tracking is only enabled for PostNord and DHL shipments",
    events: [],
    statusText: shipment?.carrier_status_text || null,
    eventCount: shipment?.carrier_event_count || 0,
    latestEventAt: shipment?.carrier_last_event_at || null
  };
}

app.get("/", (req, res) => {
  return res.status(200).send(renderHomePage());
});

app.get("/admin", async (req, res) => {
  try {
    const filters = normalizeAdminFilters(req.query);
    const shipments = await getRecentShipments(200);
    const filteredShipments = shipments.filter((shipment) =>
      matchesAdminFilters(shipment, filters)
    );

    return res.status(200).send(
      renderAdminDashboard({
        shipments: filteredShipments,
        filters
      })
    );
  } catch (error) {
    console.error("Admin dashboard failed:", error.message);

    return res.status(500).send(`
      <html lang="sv">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>ShipOne Admin</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1>ShipOne Admin</h1>
          <p>Det gick inte att läsa admin dashboard just nu.</p>
        </body>
      </html>
    `);
  }
});

app.post("/admin/shipment/:orderId/sync", async (req, res) => {
  try {
    const result = await syncPostNordTrackingByOrderId(req.params.orderId);

    if (!result.success) {
      return res.redirect(
        `/admin/shipment/${encodeURIComponent(req.params.orderId)}?sync=error`
      );
    }

    return res.redirect(
      `/admin/shipment/${encodeURIComponent(req.params.orderId)}?sync=success`
    );
  } catch (error) {
    console.error("Manual admin sync failed:", error.message);

    return res.redirect(
      `/admin/shipment/${encodeURIComponent(req.params.orderId)}?sync=error`
    );
  }
});

app.get("/admin/shipment/:orderId", async (req, res) => {
  try {
    const shipment = await findShipmentByOrderId(req.params.orderId);

    if (!shipment) {
      return res.status(404).send(`
        <html lang="sv">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>ShipOne Admin</title>
          </head>
          <body style="font-family: Arial, sans-serif; padding: 40px;">
            <h1>ShipOne Admin</h1>
            <p>Shipment hittades inte.</p>
            <p><a href="/admin">Tillbaka till admin</a></p>
          </body>
        </html>
      `);
    }

    const carrierTracking = await getLiveCarrierTrackingForShipment(shipment);

    if (!carrierTracking.skipped) {
      try {
        await saveCarrierTrackingSnapshot(shipment.id, carrierTracking);
      } catch (syncError) {
        console.error("Admin details snapshot save failed:", syncError.message);
      }
    }

    const events = buildTrackingEvents({
      shipment,
      externalEvents: carrierTracking.events || [],
      externalSource: shipment.actual_carrier || "carrier"
    });

    return res.status(200).send(
      renderAdminShipmentDetails({
        shipment,
        events,
        carrierTracking,
        syncState: String(req.query.sync || "")
      })
    );
  } catch (error) {
    console.error("Admin shipment details failed:", error.message);

    return res.status(500).send(`
      <html lang="sv">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>ShipOne Admin</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1>ShipOne Admin</h1>
          <p>Det gick inte att läsa shipmentdetaljer just nu.</p>
          <p><a href="/admin">Tillbaka till admin</a></p>
        </body>
      </html>
    `);
  }
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
    console.error("Failed to read shipments:", error.message);

    return res.status(500).json({
      success: false,
      error: "Failed to read shipments"
    });
  }
});

app.get("/shipments/:orderId", async (req, res) => {
  try {
    const shipment = await findShipmentByOrderId(req.params.orderId);

    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: "Shipment not found"
      });
    }

    return res.json({
      success: true,
      shipment
    });
  } catch (error) {
    console.error("Shipment lookup failed:", error.message);

    return res.status(500).json({
      success: false,
      error: "Shipment lookup failed"
    });
  }
});

app.get("/sync-tracking/:trackingNumber", async (req, res) => {
  try {
    const result = await syncPostNordTrackingByTrackingNumber(
      req.params.trackingNumber
    );

    return res.status(result.statusCode || 200).json(result);
  } catch (error) {
    console.error("Manual sync failed:", error.message);

    return res.status(500).json({
      success: false,
      error: "Manual tracking sync failed"
    });
  }
});

app.get("/sync-tracking/order/:orderId", async (req, res) => {
  try {
    const result = await syncPostNordTrackingByOrderId(req.params.orderId);

    return res.status(result.statusCode || 200).json(result);
  } catch (error) {
    console.error("Order sync failed:", error.message);

    return res.status(500).json({
      success: false,
      error: "Order tracking sync failed"
    });
  }
});

app.get("/sync-tracking/batch/postnord", async (req, res) => {
  try {
    const result = await syncPostNordBatch({
      limit: req.query.limit || 20,
      includeDelivered:
        String(req.query.includeDelivered || "false").toLowerCase() === "true"
    });

    return res.json(result);
  } catch (error) {
    console.error("Batch sync failed:", error.message);

    return res.status(500).json({
      success: false,
      error: "Batch sync failed"
    });
  }
});

app.get("/sync-tracking/batch/postnord/active", async (req, res) => {
  try {
    const result = await syncActivePostNordBatch({
      limit: req.query.limit || 20,
      maxAgeDays: req.query.maxAgeDays || 30
    });

    return res.json(result);
  } catch (error) {
    console.error("Active batch sync failed:", error.message);

    return res.status(500).json({
      success: false,
      error: "Active batch sync failed"
    });
  }
});

app.get("/jobs/sync-postnord-active", requireCronSecret, async (req, res) => {
  try {
    const result = await runPostNordActiveSyncJob({
      limit: req.query.limit || 20,
      maxAgeDays: req.query.maxAgeDays || 30
    });

    return res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error("Job sync failed:", error.message);

    return res.status(500).json({
      success: false,
      error: "Job execution failed"
    });
  }
});

app.get("/admin/db/migrate-rate-limit", requireCronSecret, async (req, res) => {
  try {
    await query(`
      ALTER TABLE shipments
      ADD COLUMN IF NOT EXISTS carrier_next_sync_at TIMESTAMP;
    `);

    await query(`
      ALTER TABLE shipments
      ADD COLUMN IF NOT EXISTS carrier_sync_attempts INTEGER DEFAULT 0;
    `);

    await query(`
      ALTER TABLE shipments
      ADD COLUMN IF NOT EXISTS carrier_last_sync_status TEXT;
    `);

    await query(`
      UPDATE shipments
      SET carrier_next_sync_at = NOW()
      WHERE carrier_next_sync_at IS NULL;
    `);

    return res.json({
      success: true,
      message: "Rate limit migration completed"
    });
  } catch (error) {
    console.error("Migration failed:", error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/track/:trackingNumber", async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM shipments WHERE tracking_number = $1 LIMIT 1`,
      [req.params.trackingNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(renderTrackingNotFoundPage());
    }

    const shipment = result.rows[0];
    const carrierTracking = await getLiveCarrierTrackingForShipment(shipment);

    if (!carrierTracking.skipped) {
      await saveCarrierTrackingSnapshot(shipment.id, carrierTracking);
    }

    const displayStatus = getDisplayStatus({
      shipment,
      carrierTracking
    });

    const events = buildTrackingEvents({
      shipment,
      externalEvents: carrierTracking.events,
      externalSource: shipment.actual_carrier || "carrier"
    });

    return res.send(
      renderTrackingPage({
        shipment,
        events,
        carrierTracking,
        displayStatus
      })
    );
  } catch (error) {
    console.error("Tracking lookup failed:", error.message);

    return res.status(500).send(renderTrackingErrorPage());
  }
});

app.post("/webhooks/orders-create", async (req, res) => {
  const order = req.body;

  try {
    if (!order || !order.id) {
      return res.sendStatus(200);
    }

    const state = await beginOrderProcessing(order);

    if (!state.started) {
      return res.sendStatus(200);
    }

    if (!order.shipping_address) {
      await failOrderProcessing(order.id, {
        order_name: order.name,
        error: "Missing shipping address"
      });

      return res.sendStatus(200);
    }

    const shippingOptions = await collectRates(order);

    const selectedOption = chooseBestOption(shippingOptions, "SMART");

    if (!selectedOption) {
      await failOrderProcessing(order.id, {
        order_name: order.name,
        error: "No shipping option selected"
      });

      return res.sendStatus(200);
    }

    const shipmentResult = await createShipment(order, selectedOption);

    let fulfillmentResult = {
      success: false
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
    }

    await saveShipmentOutcome(order, {
      shipone_choice: "SMART",
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

    return res.sendStatus(200);
  } catch (error) {
    console.error("Shipment error:", error.message);

    if (order && order.id) {
      await failOrderProcessing(order.id, {
        order_name: order.name,
        error: error.message
      });
    }

    return res.sendStatus(200);
  }
});

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`ShipOne running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server start failed:", error.message);
    process.exit(1);
  }
}

startServer();
