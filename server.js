const express = require("express");
const axios = require("axios");

const { initDatabase, query } = require("./services/db");
const { chooseBestOption } = require("./services/routingEngine");
const { createShipment } = require("./services/createShipment");
const { fulfillShopifyOrder } = require("./services/shopifyfulfillment");
const { collectRates } = require("./core/rateCollector");

const { buildTrackingEvents } = require("./services/trackingEvents");
const { fetchPostNordTracking } = require("./services/postnordTracking");
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
  readShipments,
  findShipmentByOrderId,
  getRecentShipments
} = require("./services/shipmentStore");

const {
  renderTrackingPage,
  renderTrackingNotFoundPage,
  renderTrackingErrorPage
} = require("./views/trackingPage");

const { renderHomePage } = require("./views/homePage");

const app = express();
app.use(express.json());

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

  const providedSecret =
    getBearerToken(req) ||
    req.query.token ||
    "";

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized"
    });
  }

  return next();
}

app.get("/", (req, res) => {
  return res.status(200).send(renderHomePage());
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
    const limit = req.query.limit || 20;
    const includeDelivered =
      String(req.query.includeDelivered || "false").toLowerCase() === "true";

    const result = await syncPostNordBatch({
      limit,
      includeDelivered
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

app.get(
  "/admin/db/migrate-rate-limit",
  requireCronSecret,
  async (req, res) => {
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
  }
);

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

    let carrierTracking = {
      success: false,
      skipped: true,
      events: [],
      statusText: null
    };

    if (
      String(shipment.actual_carrier || "").toLowerCase() === "postnord"
    ) {
      carrierTracking = await fetchPostNordTracking(
        shipment.tracking_number
      );

      await saveCarrierTrackingSnapshot(
        shipment.id,
        carrierTracking
      );
    }

    const displayStatus = getDisplayStatus({
      shipment,
      carrierTracking
    });

    const events = buildTrackingEvents({
      shipment,
      externalEvents: carrierTracking.events
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

    const selectedOption = chooseBestOption(
      shippingOptions,
      "SMART"
    );

    if (!selectedOption) {
      await failOrderProcessing(order.id, {
        order_name: order.name,
        error: "No shipping option selected"
      });

      return res.sendStatus(200);
    }

    const shipmentResult = await createShipment(
      order,
      selectedOption
    );

    let trackingNumber = null;
    let trackingUrl = null;

    if (shipmentResult.success && shipmentResult.data) {
      trackingNumber =
        shipmentResult.data.trackingNumber || null;

      trackingUrl =
        shipmentResult.data.trackingUrl || null;

      await fulfillShopifyOrder(
        order.id,
        trackingNumber,
        trackingUrl
      );
    }

    await saveShipmentOutcome(order, {
      tracking_number: trackingNumber,
      tracking_url: trackingUrl,
      shipment_success: shipmentResult.success
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
