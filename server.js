const express = require("express");
const axios = require("axios");

const { initDatabase, query } = require("./services/db");
const {
  chooseBestOption,
  normalizeChoice
} = require("./services/routingEngine");
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
  createDHLTestShipment,
  deleteShipmentByOrderId,
  findShipmentByOrderId,
  getRecentShipments
} = require("./services/shipmentStore");

const {
  resolveMerchantContext,
  upsertMerchant,
  upsertShopifyStore,
  listMerchants,
  listShopifyStores,
  normalizeShopDomain,
  normalizeMerchantId
} = require("./services/merchantStore");

const {
  renderTrackingPage,
  renderTrackingNotFoundPage,
  renderTrackingErrorPage
} = require("./views/trackingPage");

const { renderHomePage } = require("./views/homePage");
const { renderAdminDashboard } = require("./views/adminDashboard");
const { renderAdminShipmentDetails } = require("./views/adminShipmentDetails");
const { renderAdminMerchantsPage } = require("./views/adminMerchants");

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

  const providedSecret =
    getBearerToken(req) ||
    req.query.token ||
    req.body?.token ||
    "";

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
    health: String(queryParams.health || "").trim().toLowerCase(),
    merchant: String(queryParams.merchant || "").trim().toLowerCase()
  };
}

function matchesAdminFilters(shipment, filters) {
  const searchHaystack = [
    shipment.order_name,
    shipment.order_id,
    shipment.tracking_number,
    shipment.merchant_id,
    shipment.shop_domain
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

  if (filters.merchant) {
    const shipmentMerchant = String(shipment.merchant_id || "").toLowerCase();
    if (shipmentMerchant !== filters.merchant) {
      return false;
    }
  }

  return true;
}

function extractShipOneDeliveryChoice(order) {
  const noteAttributes = Array.isArray(order?.note_attributes)
    ? order.note_attributes
    : [];

  const match = noteAttributes.find((attribute) => {
    const name = String(attribute?.name || "").trim().toLowerCase();
    return name === "shipone_delivery";
  });

  const rawChoice = String(match?.value || "").trim();

  if (!rawChoice) {
    return {
      raw: "",
      normalized: "SMART"
    };
  }

  return {
    raw: rawChoice,
    normalized: normalizeChoice(rawChoice)
  };
}

function setPublicApiCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function formatCarrierLabel(carrier) {
  const normalized = String(carrier || "").toLowerCase();

  if (normalized === "postnord") return "PostNord";
  if (normalized === "dhl") return "DHL";
  if (normalized === "budbee") return "Budbee";

  return carrier || "-";
}

function formatEtaLabel(etaDays) {
  const value = Number(etaDays);

  if (!Number.isFinite(value) || value <= 0) {
    return "Okänd leveranstid";
  }

  if (value === 1) {
    return "1 arbetsdag";
  }

  return `${value} arbetsdagar`;
}

function formatPriceLabel(price) {
  const value = Number(price);

  if (!Number.isFinite(value)) {
    return "-";
  }

  return `${value} kr`;
}

function buildPreviewOrder() {
  return {
    id: "preview-order",
    name: "#PREVIEW",
    shipping_address: {
      city: "Stockholm",
      zip: "111 22",
      country: "Sweden",
      country_code: "SE"
    },
    customer: {
      first_name: "ShipOne",
      last_name: "Preview"
    }
  };
}

function buildStrategyMeta(strategyKey) {
  if (strategyKey === "FAST") {
    return {
      code: "FASTEST",
      title: "Fast",
      badge: "Snabbast",
      description: "Strategi: välj snabbaste tillgängliga frakt"
    };
  }

  if (strategyKey === "CHEAP") {
    return {
      code: "CHEAPEST",
      title: "Cheap",
      badge: "Billigast",
      description: "Strategi: välj billigaste tillgängliga frakt"
    };
  }

  return {
    code: "GREEN",
    title: "Smart",
    badge: "Bästa balans",
    description: "Strategi: välj bäst balans mellan pris, hastighet och miljö"
  };
}

function buildPreviewOption(strategyKey, selectedOption, allRates) {
  const meta = buildStrategyMeta(strategyKey);

  if (!selectedOption) {
    return {
      ...meta,
      available: false,
      carrier: "-",
      carrierLabel: "Ingen aktiv carrier",
      service: "-",
      etaDays: null,
      etaLabel: "Ingen leveranstid tillgänglig",
      price: null,
      priceLabel: "-",
      raw: null
    };
  }

  return {
    ...meta,
    available: true,
    carrier: selectedOption.carrier || null,
    carrierLabel: formatCarrierLabel(selectedOption.carrier),
    service: selectedOption.name || "-",
    etaDays: selectedOption.eta_days ?? null,
    etaLabel: formatEtaLabel(selectedOption.eta_days),
    price: Number(selectedOption.price ?? 0),
    priceLabel: formatPriceLabel(selectedOption.price),
    raw: selectedOption,
    comparedRateCount: Array.isArray(allRates) ? allRates.length : 0
  };
}

async function buildShipOneRatePreview() {
  const previewOrder = buildPreviewOrder();
  const shippingOptions = await collectRates(previewOrder);

  const fastOption = chooseBestOption(shippingOptions, "FAST");
  const cheapOption = chooseBestOption(shippingOptions, "CHEAP");
  const greenOption = chooseBestOption(shippingOptions, "GREEN");

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    currency: "SEK",
    activeRateCount: shippingOptions.length,
    activeRates: shippingOptions.map((option) => ({
      carrier: option.carrier || null,
      carrierLabel: formatCarrierLabel(option.carrier),
      service: option.name || "-",
      price: Number(option.price ?? 0),
      priceLabel: formatPriceLabel(option.price),
      etaDays: option.eta_days ?? null,
      etaLabel: formatEtaLabel(option.eta_days),
      co2: option.co2 ?? null,
      raw: option
    })),
    strategies: {
      FASTEST: buildPreviewOption("FAST", fastOption, shippingOptions),
      CHEAPEST: buildPreviewOption("CHEAP", cheapOption, shippingOptions),
      GREEN: buildPreviewOption("GREEN", greenOption, shippingOptions)
    }
  };
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

async function resolveMerchantContextFromRequest(req) {
  const shopDomain =
    normalizeShopDomain(req.headers["x-shopify-shop-domain"]) ||
    normalizeShopDomain(req.body?.shop_domain) ||
    normalizeShopDomain(req.query.shop_domain);

  const explicitMerchantId =
    normalizeMerchantId(req.headers["x-shipone-merchant-id"]) ||
    normalizeMerchantId(req.body?.merchant_id) ||
    normalizeMerchantId(req.query.merchant_id);

  const defaultMerchantId = normalizeMerchantId(
    process.env.SHIPONE_DEFAULT_MERCHANT_ID || "default"
  );

  return resolveMerchantContext({
    explicitMerchantId,
    shopDomain,
    defaultMerchantId
  });
}

function renderDHLTestPage({
  token,
  createdShipment = null,
  deletedShipment = null,
  error = ""
}) {
  const escapedToken = String(token || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const createdHtml = createdShipment
    ? `
      <div style="margin-bottom:16px;padding:16px;border-radius:14px;background:#ecfdf5;color:#065f46;border:1px solid #bbf7d0;">
        <strong>DHL test-shipment skapat.</strong><br />
        Merchant: ${createdShipment.merchant_id || "default"}<br />
        Shop domain: ${createdShipment.shop_domain || "-"}<br />
        Order ID: ${createdShipment.order_id}<br />
        Trackingnummer: ${createdShipment.tracking_number}<br />
        <a href="/admin/shipment/${encodeURIComponent(createdShipment.order_id)}" style="color:#065f46;font-weight:700;">Öppna shipment</a>
      </div>
    `
    : "";

  const deletedHtml = deletedShipment
    ? `
      <div style="margin-bottom:16px;padding:16px;border-radius:14px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;">
        <strong>DHL test-shipment raderat.</strong><br />
        Order ID: ${deletedShipment.order_id}
      </div>
    `
    : "";

  const errorHtml = error
    ? `
      <div style="margin-bottom:16px;padding:16px;border-radius:14px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;">
        <strong>Fel:</strong> ${String(error)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}
      </div>
    `
    : "";

  return `
    <!DOCTYPE html>
    <html lang="sv">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ShipOne DHL Test Tools</title>
      </head>
      <body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;color:#0f172a;">
        <div style="max-width:900px;margin:0 auto;">
          <div style="margin-bottom:18px;">
            <a href="/admin" style="color:#2563eb;font-weight:700;text-decoration:none;">← Till admin</a>
          </div>

          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:24px;margin-bottom:20px;">
            <h1 style="margin-top:0;">ShipOne DHL Test Tools</h1>
            <p style="color:#475569;line-height:1.6;">
              Här kan du skapa och radera isolerade DHL test-shipments utan att röra PostNord-flödet.
            </p>
            ${createdHtml}
            ${deletedHtml}
            ${errorHtml}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:24px;">
              <h2 style="margin-top:0;">Skapa DHL test-shipment</h2>
              <form method="GET" action="/admin/test/dhl/create">
                <input type="hidden" name="token" value="${escapedToken}" />

                <div style="margin-bottom:12px;">
                  <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">DHL trackingnummer</label>
                  <input name="trackingNumber" type="text" required style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:12px;" />
                </div>

                <div style="margin-bottom:12px;">
                  <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">Merchant ID (valfri)</label>
                  <input name="merchant_id" type="text" placeholder="default" style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:12px;" />
                </div>

                <div style="margin-bottom:12px;">
                  <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">Shop domain (valfri)</label>
                  <input name="shop_domain" type="text" placeholder="example.myshopify.com" style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:12px;" />
                </div>

                <div style="margin-bottom:12px;">
                  <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">Order ID (valfri)</label>
                  <input name="orderId" type="text" style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:12px;" />
                </div>

                <div style="margin-bottom:12px;">
                  <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">Ordernamn (valfri)</label>
                  <input name="orderName" type="text" placeholder="#DHL-TEST" style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:12px;" />
                </div>

                <div style="margin-bottom:12px;">
                  <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">E-post (valfri)</label>
                  <input name="email" type="text" style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:12px;" />
                </div>

                <button type="submit" style="padding:12px 16px;border:none;border-radius:12px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer;">
                  Skapa DHL test-shipment
                </button>
              </form>
            </div>

            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:24px;">
              <h2 style="margin-top:0;">Rollback / radera test-shipment</h2>
              <form method="GET" action="/admin/test/dhl/delete">
                <input type="hidden" name="token" value="${escapedToken}" />

                <div style="margin-bottom:12px;">
                  <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">Order ID att radera</label>
                  <input name="orderId" type="text" required style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:12px;" />
                </div>

                <button type="submit" style="padding:12px 16px;border:none;border-radius:12px;background:#dc2626;color:#fff;font-weight:700;cursor:pointer;">
                  Radera test-shipment
                </button>
              </form>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

app.get("/", (req, res) => {
  return res.status(200).send(renderHomePage());
});

app.options("/api/rates/preview", (req, res) => {
  setPublicApiCors(res);
  return res.sendStatus(204);
});

app.get("/api/rates/preview", async (req, res) => {
  try {
    setPublicApiCors(res);

    const preview = await buildShipOneRatePreview();

    return res.status(200).json(preview);
  } catch (error) {
    console.error("Rate preview failed:", error.message);

    setPublicApiCors(res);

    return res.status(500).json({
      success: false,
      error: "Failed to build ShipOne rate preview"
    });
  }
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

app.get("/admin/merchants", requireCronSecret, async (req, res) => {
  try {
    const merchants = await listMerchants();
    const stores = await listShopifyStores();

    return res.status(200).send(
      renderAdminMerchantsPage({
        merchants,
        stores,
        flashMessage: req.query.message || "",
        flashType: req.query.type || "success",
        token: req.query.token || ""
      })
    );
  } catch (error) {
    console.error("Merchant admin page failed:", error.message);

    return res.status(500).send(`
      <html lang="sv">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>ShipOne Merchant Admin</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1>ShipOne Merchant Admin</h1>
          <p>Det gick inte att läsa merchant admin just nu.</p>
          <p><a href="/admin?token=${encodeURIComponent(req.query.token || "")}">Tillbaka till admin</a></p>
        </body>
      </html>
    `);
  }
});
  } catch (error) {
    console.error("Merchant admin page failed:", error.message);

    return res.status(500).send(`
      <html lang="sv">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>ShipOne Merchant Admin</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1>ShipOne Merchant Admin</h1>
          <p>Det gick inte att läsa merchant admin just nu.</p>
          <p><a href="/admin?token=${encodeURIComponent(req.query.token || "")}">Tillbaka till admin</a></p>
        </body>
      </html>
    `);
  }
});

app.post("/admin/merchants/upsert", requireCronSecret, async (req, res) => {
  try {
    await upsertMerchant({
      id: req.body.id,
      name: req.body.name,
      status: req.body.status || "active"
    });

    return res.redirect(
      `/admin/merchants?token=${encodeURIComponent(req.body.token || "")}&message=${encodeURIComponent("Merchant sparad")}&type=success`
    );
  } catch (error) {
    console.error("Merchant form upsert failed:", error.message);

    return res.redirect(
      `/admin/merchants?token=${encodeURIComponent(req.body.token || "")}&message=${encodeURIComponent(error.message)}&type=error`
    );
  }
});

app.post("/admin/merchants/store/upsert", requireCronSecret, async (req, res) => {
  try {
    const merchantId = normalizeMerchantId(req.body.merchant_id);
    const shopDomain = normalizeShopDomain(req.body.shop_domain);

    if (!merchantId || !shopDomain) {
      return res.redirect(
        `/admin/merchants?token=${encodeURIComponent(req.body.token || "")}&message=${encodeURIComponent("merchant_id och shop_domain krävs")}&type=error`
      );
    }

    await upsertMerchant({
      id: merchantId,
      name: req.body.merchant_name || merchantId,
      status: req.body.merchant_status || "active"
    });

    await upsertShopifyStore({
      shop_domain: shopDomain,
      merchant_id: merchantId,
      is_active: String(req.body.is_active || "true").toLowerCase() !== "false"
    });

    return res.redirect(
      `/admin/merchants?token=${encodeURIComponent(req.body.token || "")}&message=${encodeURIComponent("Store-koppling sparad")}&type=success`
    );
  } catch (error) {
    console.error("Merchant store form upsert failed:", error.message);

    return res.redirect(
      `/admin/merchants?token=${encodeURIComponent(req.body.token || "")}&message=${encodeURIComponent(error.message)}&type=error`
    );
  }
});

app.get("/admin/test/dhl", requireCronSecret, async (req, res) => {
  return res.status(200).send(
    renderDHLTestPage({
      token: req.query.token || ""
    })
  );
});

app.get("/admin/test/dhl/create", requireCronSecret, async (req, res) => {
  try {
    const shipment = await createDHLTestShipment({
      merchant_id: req.query.merchant_id,
      shop_domain: req.query.shop_domain,
      order_id: req.query.orderId,
      order_name: req.query.orderName,
      email: req.query.email,
      tracking_number: req.query.trackingNumber
    });

    return res.status(200).send(
      renderDHLTestPage({
        token: req.query.token || "",
        createdShipment: shipment
      })
    );
  } catch (error) {
    console.error("DHL test shipment create failed:", error.message);

    return res.status(500).send(
      renderDHLTestPage({
        token: req.query.token || "",
        error: error.message
      })
    );
  }
});

app.get("/admin/test/dhl/delete", requireCronSecret, async (req, res) => {
  try {
    const orderId = String(req.query.orderId || "").trim();

    if (!orderId) {
      return res.status(400).send(
        renderDHLTestPage({
          token: req.query.token || "",
          error: "Order ID saknas för radering"
        })
      );
    }

    const deleted = await deleteShipmentByOrderId(orderId);

    return res.status(200).send(
      renderDHLTestPage({
        token: req.query.token || "",
        deletedShipment: deleted || { order_id: orderId }
      })
    );
  } catch (error) {
    console.error("DHL test shipment delete failed:", error.message);

    return res.status(500).send(
      renderDHLTestPage({
        token: req.query.token || "",
        error: error.message
      })
    );
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

app.get("/admin/merchant/upsert", requireCronSecret, async (req, res) => {
  try {
    const merchant = await upsertMerchant({
      id: req.query.id,
      name: req.query.name,
      status: req.query.status || "active"
    });

    return res.status(200).json({
      success: true,
      merchant
    });
  } catch (error) {
    console.error("Merchant upsert failed:", error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/admin/shopify-store/upsert", requireCronSecret, async (req, res) => {
  try {
    const merchantId = normalizeMerchantId(req.query.merchant_id);
    const shopDomain = normalizeShopDomain(req.query.shop_domain);

    if (!merchantId || !shopDomain) {
      return res.status(400).json({
        success: false,
        error: "merchant_id and shop_domain are required"
      });
    }

    await upsertMerchant({
      id: merchantId,
      name: req.query.merchant_name || merchantId,
      status: req.query.merchant_status || "active"
    });

    const store = await upsertShopifyStore({
      shop_domain: shopDomain,
      merchant_id: merchantId,
      is_active:
        String(req.query.is_active || "true").toLowerCase() !== "false"
    });

    return res.status(200).json({
      success: true,
      store
    });
  } catch (error) {
    console.error("Shopify store upsert failed:", error.message);

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
  const merchantContext = await resolveMerchantContextFromRequest(req);

  try {
    if (!order || !order.id) {
      return res.sendStatus(200);
    }

    console.log("🏪 ShipOne merchant resolved:", merchantContext.merchant_id);
    console.log("🏪 Shopify shop domain:", merchantContext.shop_domain || "unknown");
    console.log("🏪 Merchant source:", merchantContext.source || "unknown");

    const state = await beginOrderProcessing(order, merchantContext);

    if (!state.started) {
      return res.sendStatus(200);
    }

    if (!order.shipping_address) {
      await failOrderProcessing(
        order.id,
        {
          order_name: order.name,
          error: "Missing shipping address"
        },
        merchantContext
      );

      return res.sendStatus(200);
    }

    const shippingOptions = await collectRates(order);
    const shipOneChoice = extractShipOneDeliveryChoice(order);

    console.log("🚚 ShipOne order delivery choice raw:", shipOneChoice.raw || "none");
    console.log("🚚 ShipOne order delivery choice normalized:", shipOneChoice.normalized);

    const selectedOption = chooseBestOption(
      shippingOptions,
      shipOneChoice.normalized
    );

    if (!selectedOption) {
      await failOrderProcessing(
        order.id,
        {
          order_name: order.name,
          error: "No shipping option selected"
        },
        merchantContext
      );

      return res.sendStatus(200);
    }

    console.log("✅ ShipOne selected carrier:", selectedOption.carrier || "unknown");
    console.log("✅ ShipOne selected service:", selectedOption.name || "unknown");
    console.log("✅ ShipOne selected price:", selectedOption.price ?? "unknown");

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

    await saveShipmentOutcome(
      order,
      {
        shipone_choice: shipOneChoice.normalized,
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
      },
      merchantContext
    );

    return res.sendStatus(200);
  } catch (error) {
    console.error("Shipment error:", error.message);

    if (order && order.id) {
      await failOrderProcessing(
        order.id,
        {
          order_name: order.name,
          error: error.message
        },
        merchantContext
      );
    }

    return res.sendStatus(200);
  }
});

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`ShipOne running on port ${PORT}`);
      console.log(
        `ShipOne backend URL: https://shipone-production.up.railway.app`
      );
    });
  } catch (error) {
    console.error("Server start failed:", error.message);
    process.exit(1);
  }
}

startServer();
