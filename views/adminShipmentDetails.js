const { enrichShipmentWithHealth } = require("../services/shipmentHealth");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateSv(dateValue) {
  if (!dateValue) return "-";

  try {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return date.toLocaleString("sv-SE", {
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

function formatCarrierName(carrier) {
  const normalized = String(carrier || "").toLowerCase();

  if (normalized === "postnord") return "PostNord";
  if (normalized === "dhl") return "DHL";
  if (normalized === "budbee") return "Budbee";

  return carrier || "-";
}

function formatShipmentStatus(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "completed") return "Slutförd";
  if (normalized === "processing") return "Behandlas";
  if (normalized === "failed") return "Misslyckad";

  return status || "-";
}

function formatChoice(choice) {
  const normalized = String(choice || "").toUpperCase();

  if (normalized === "FAST") return "Fast";
  if (normalized === "FASTEST") return "Fast";
  if (normalized === "CHEAP") return "Cheap";
  if (normalized === "CHEAPEST") return "Cheap";
  if (normalized === "GREEN") return "Smart";
  if (normalized === "SMART") return "Smart";
  if (normalized === "DHL_TEST") return "DHL Test";

  return choice || "-";
}

function getStatusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "completed") return "badge-completed";
  if (normalized === "processing") return "badge-processing";
  if (normalized === "failed") return "badge-failed";

  return "badge-neutral";
}

function renderJsonBlock(value) {
  if (!value) {
    return `<pre class="json-block">-</pre>`;
  }

  try {
    return `<pre class="json-block">${escapeHtml(
      JSON.stringify(value, null, 2)
    )}</pre>`;
  } catch (error) {
    return `<pre class="json-block">${escapeHtml(String(value))}</pre>`;
  }
}

function getEventStateClass(status) {
  if (status === "done") return "event-done";
  if (status === "active") return "event-active";
  if (status === "failed") return "event-failed";
  return "event-pending";
}

function getEventSourceLabel(source) {
  if (source === "shopify") return "Shopify";
  if (source === "postnord") return "PostNord";
  if (source === "dhl") return "DHL";
  if (source === "budbee") return "Budbee";
  if (source === "carrier") return "Transportör";
  return "ShipOne";
}

function isMerchantTrackingBlocked(shipment) {
  const syncStatus = String(
    shipment?.carrier_last_sync_status || ""
  ).toLowerCase();

  return syncStatus === "disabled_by_merchant" || syncStatus === "disabled";
}

function buildPolicyState(shipment) {
  const selectedCarrier = String(shipment?.selected_carrier || "").toLowerCase();
  const actualCarrier = String(shipment?.actual_carrier || "").toLowerCase();
  const fallbackUsed = Boolean(shipment?.fallback_used);
  const trackingBlocked = isMerchantTrackingBlocked(shipment);

  if (trackingBlocked) {
    return {
      code: "blocked",
      label: "Tracking blockerad",
      className: "policy-pill-blocked",
      summary: `Live tracking är blockerad av merchant-policy för ${formatCarrierName(
        actualCarrier
      )}.`
    };
  }

  if (fallbackUsed && selectedCarrier && actualCarrier && selectedCarrier !== actualCarrier) {
    return {
      code: "fallback",
      label: "Fallback använd",
      className: "policy-pill-warning",
      summary: `Shipmentet gick vidare med fallback från ${formatCarrierName(
        selectedCarrier
      )} till ${formatCarrierName(actualCarrier)}.`
    };
  }

  return {
    code: "ok",
    label: "Policy OK",
    className: "policy-pill-ok",
    summary: "Ingen merchant-policy blockerar tracking eller routing för detta shipment."
  };
}

function renderTimeline(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return `
      <div class="empty-note">
        Inga tracking-events finns ännu för detta shipment.
      </div>
    `;
  }

  return `
    <ul class="timeline">
      ${events
        .map((event) => {
          const title = escapeHtml(event.title || "Tracking-event");
          const description = escapeHtml(event.description || "-");
          const occurredAt = escapeHtml(formatDateSv(event.occurredAt));
          const source = escapeHtml(getEventSourceLabel(event.source));
          const stateClass = getEventStateClass(event.status);

          return `
            <li class="timeline-item">
              <div class="timeline-marker ${stateClass}"></div>
              <div class="timeline-card">
                <div class="timeline-top">
                  <div class="timeline-title">${title}</div>
                  <div class="timeline-source">${source}</div>
                </div>
                <div class="timeline-time">${occurredAt}</div>
                <div class="timeline-description">${description}</div>
              </div>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function renderSyncBanner(syncState) {
  if (!syncState) {
    return "";
  }

  if (syncState === "success") {
    return `
      <div class="sync-banner sync-banner-success">
        Tracking sync genomfördes och shipmentet uppdaterades.
      </div>
    `;
  }

  if (syncState === "blocked") {
    return `
      <div class="sync-banner sync-banner-warning">
        Sync stoppades eftersom tracking är blockerad av merchant-policy för aktuell carrier.
      </div>
    `;
  }

  if (syncState === "error") {
    return `
      <div class="sync-banner sync-banner-error">
        Tracking sync misslyckades. Kontrollera carrier, trackingnummer och serverloggar.
      </div>
    `;
  }

  return "";
}

function renderHealthPanel(shipment) {
  const label = escapeHtml(shipment.healthLabel || "-");
  const reason = escapeHtml(shipment.healthReason || "-");
  const code = escapeHtml(shipment.healthCode || "-");
  const pillClass = escapeHtml(shipment.healthClass || "health-neutral");

  return `
    <div class="card full-width">
      <h2 class="card-title">Shipment health</h2>

      <div class="health-panel">
        <div class="health-top">
          <span class="health-pill ${pillClass}">${label}</span>
        </div>

        <div class="info-list">
          <div class="info-row">
            <div class="label">Bedömning</div>
            <div class="value">${reason}</div>
          </div>

          <div class="info-row">
            <div class="label">Health code</div>
            <div class="value">${code}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getRoutingSnapshot(shipment) {
  return shipment?.shipment_result?.routing_snapshot || null;
}

function getOrderSnapshot(shipment) {
  return shipment?.shipment_result?.order_snapshot || null;
}

function renderPolicyPanel(shipment) {
  const policy = buildPolicyState(shipment);
  const selectedCarrier = formatCarrierName(shipment?.selected_carrier);
  const actualCarrier = formatCarrierName(shipment?.actual_carrier);
  const merchantId = shipment?.merchant_id || "default";
  const shopDomain = shipment?.shop_domain || "-";
  const shipmentAllowed = "Ja";
  const trackingAllowed = isMerchantTrackingBlocked(shipment) ? "Nej" : "Ja";

  return `
    <div class="card full-width">
      <h2 class="card-title">Merchant policy</h2>

      <div class="policy-panel">
        <div class="policy-top">
          <span class="policy-pill ${escapeHtml(policy.className)}">
            ${escapeHtml(policy.label)}
          </span>
        </div>

        <div class="policy-summary">
          ${escapeHtml(policy.summary)}
        </div>

        <div class="info-list">
          <div class="info-row">
            <div class="label">Merchant ID</div>
            <div class="value">${escapeHtml(merchantId)}</div>
          </div>

          <div class="info-row">
            <div class="label">Shop domain</div>
            <div class="value">${escapeHtml(shopDomain)}</div>
          </div>

          <div class="info-row">
            <div class="label">Vald carrier</div>
            <div class="value">${escapeHtml(selectedCarrier)}</div>
          </div>

          <div class="info-row">
            <div class="label">Faktisk carrier</div>
            <div class="value">${escapeHtml(actualCarrier)}</div>
          </div>

          <div class="info-row">
            <div class="label">Fallback använd</div>
            <div class="value">${shipment?.fallback_used ? "Ja" : "Nej"}</div>
          </div>

          <div class="info-row">
            <div class="label">Shipment tillåtet</div>
            <div class="value">${shipmentAllowed}</div>
          </div>

          <div class="info-row">
            <div class="label">Tracking tillåten</div>
            <div class="value">${trackingAllowed}</div>
          </div>

          <div class="info-row">
            <div class="label">Senaste sync-status</div>
            <div class="value">${escapeHtml(shipment?.carrier_last_sync_status || "-")}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderRoutingPanel(shipment) {
  const routingSnapshot = getRoutingSnapshot(shipment);

  const shiponeChoice = escapeHtml(
    formatChoice(
      routingSnapshot?.shipone_choice_normalized || shipment.shipone_choice
    )
  );

  const selectedCarrier = escapeHtml(
    formatCarrierName(
      routingSnapshot?.selected_carrier || shipment.selected_carrier
    )
  );

  const selectedService = escapeHtml(
    routingSnapshot?.selected_service || shipment.selected_service || "-"
  );

  const actualCarrier = escapeHtml(
    formatCarrierName(
      routingSnapshot?.actual_carrier || shipment.actual_carrier
    )
  );

  const actualCarrierRaw = String(
    routingSnapshot?.actual_carrier || shipment.actual_carrier || ""
  ).toLowerCase();

  const fallbackUsed = Boolean(
    routingSnapshot?.fallback_used ?? shipment.fallback_used
  );

  const fallbackFrom = escapeHtml(
    formatCarrierName(
      routingSnapshot?.fallback_from || shipment.fallback_from
    )
  );

  const fallbackTo = escapeHtml(
    formatCarrierName(
      routingSnapshot?.actual_carrier || shipment.actual_carrier
    )
  );

  let actualServiceLabel = "Tjänst ej specificerad";

  if (actualCarrierRaw === "postnord") {
    actualServiceLabel = "PostNord-shipment skapad";
  } else if (actualCarrierRaw === "dhl") {
    actualServiceLabel = "DHL-shipment skapad";
  } else if (actualCarrierRaw === "budbee") {
    actualServiceLabel = "Budbee-shipment skapad";
  }

  return `
    <div class="card full-width">
      <h2 class="card-title">Routing & carrier-val</h2>

      <div class="routing-grid">
        <div class="routing-box">
          <div class="routing-label">ShipOne-val</div>
          <div class="routing-value">${shiponeChoice}</div>
        </div>

        <div class="routing-box routing-box-selected">
          <div class="routing-label">Vald carrier</div>
          <div class="routing-value">${selectedCarrier}</div>
          <div class="routing-subvalue">Vald tjänst: ${selectedService}</div>
        </div>

        <div class="routing-box routing-box-actual">
          <div class="routing-label">Faktisk carrier</div>
          <div class="routing-value">${actualCarrier}</div>
          <div class="routing-subvalue">Faktisk tjänst: ${escapeHtml(actualServiceLabel)}</div>
        </div>

        <div class="routing-box">
          <div class="routing-label">Fallback</div>
          <div class="routing-value">${fallbackUsed ? "Ja" : "Nej"}</div>
          <div class="routing-subvalue">
            ${
              fallbackUsed
                ? `Från ${fallbackFrom} till ${fallbackTo}`
                : "Ingen fallback använd"
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCheckoutSnapshotPanel(shipment) {
  const orderSnapshot = getOrderSnapshot(shipment);
  const routingSnapshot = getRoutingSnapshot(shipment);
  const merchantSnapshot = shipment?.shipment_result?.merchant_snapshot || null;

  if (!orderSnapshot && !routingSnapshot && !merchantSnapshot) {
    return `
      <div class="card full-width">
        <h2 class="card-title">Checkout & webhook snapshot</h2>
        <div class="empty-note">
          Ingen sparad checkout/webhook-snapshot finns för detta shipment ännu.
        </div>
      </div>
    `;
  }

  const firstShippingLine = orderSnapshot?.first_shipping_line || null;
  const shippingLines = Array.isArray(orderSnapshot?.shipping_lines)
    ? orderSnapshot.shipping_lines
    : [];

  const shippingLinesHtml =
    shippingLines.length > 0
      ? shippingLines
          .map((line, index) => {
            return `
              <div class="snapshot-line">
                <div class="snapshot-line-title">Shipping line ${index + 1}</div>
                <div class="snapshot-line-meta">
                  Titel: ${escapeHtml(line?.title || "-")}<br />
                  Code: ${escapeHtml(line?.code || "-")}<br />
                  Source: ${escapeHtml(line?.source || "-")}<br />
                  Pris: ${escapeHtml(line?.price || "-")}
                </div>
              </div>
            `;
          })
          .join("")
      : `<div class="empty-note">Inga shipping_lines sparade.</div>`;

  return `
    <div class="card full-width">
      <h2 class="card-title">Checkout & webhook snapshot</h2>

      <div class="info-list">
        <div class="info-row">
          <div class="label">Merchant snapshot</div>
          <div class="value">
            Merchant: ${escapeHtml(merchantSnapshot?.merchant_id || shipment?.merchant_id || "-")}<br />
            Shop domain: ${escapeHtml(merchantSnapshot?.shop_domain || shipment?.shop_domain || "-")}
          </div>
        </div>

        <div class="info-row">
          <div class="label">Cart-val från kund</div>
          <div class="value">${escapeHtml(orderSnapshot?.shipone_delivery_raw || routingSnapshot?.shipone_delivery_raw || "-")}</div>
        </div>

        <div class="info-row">
          <div class="label">Normaliserat ShipOne-val</div>
          <div class="value">${escapeHtml(formatChoice(routingSnapshot?.shipone_choice_normalized || shipment.shipone_choice || "-"))}</div>
        </div>

        <div class="info-row">
          <div class="label">Shopify shipping line</div>
          <div class="value">
            ${
              firstShippingLine
                ? `
                  Titel: ${escapeHtml(firstShippingLine.title || "-")}<br />
                  Code: ${escapeHtml(firstShippingLine.code || "-")}<br />
                  Source: ${escapeHtml(firstShippingLine.source || "-")}<br />
                  Pris: ${escapeHtml(firstShippingLine.price || "-")}
                `
                : "Ingen first_shipping_line sparad"
            }
          </div>
        </div>

        <div class="info-row">
          <div class="label">Antal shipping lines</div>
          <div class="value">${escapeHtml(String(shippingLines.length))}</div>
        </div>

        <div class="info-row">
          <div class="label">Webhook ordernamn</div>
          <div class="value">${escapeHtml(orderSnapshot?.name || shipment.order_name || "-")}</div>
        </div>

        <div class="info-row">
          <div class="label">Webhook order ID</div>
          <div class="value">${escapeHtml(orderSnapshot?.id || shipment.order_id || "-")}</div>
        </div>
      </div>

      <div class="snapshot-lines-wrap">
        ${shippingLinesHtml}
      </div>
    </div>
  `;
}

function renderAdminShipmentDetails({
  shipment,
  events = [],
  carrierTracking = null,
  syncState = ""
}) {
  const enrichedShipment = enrichShipmentWithHealth(shipment);
  const policy = buildPolicyState(enrichedShipment);

  const orderId = escapeHtml(enrichedShipment.order_id || "-");
  const orderName = escapeHtml(enrichedShipment.order_name || "-");
  const carrier = escapeHtml(formatCarrierName(enrichedShipment.actual_carrier));
  const status = escapeHtml(formatShipmentStatus(enrichedShipment.status));
  const trackingNumber = escapeHtml(enrichedShipment.tracking_number || "-");
  const trackingUrl = enrichedShipment.tracking_url
    ? escapeHtml(enrichedShipment.tracking_url)
    : "";
  const trackingPageUrl = enrichedShipment.tracking_number
    ? `/track/${encodeURIComponent(enrichedShipment.tracking_number)}`
    : "";
  const adminJsonUrl = `/shipments/${encodeURIComponent(enrichedShipment.order_id)}`;
  const manualSyncUrl = `/admin/shipment/${encodeURIComponent(
    enrichedShipment.order_id
  )}/sync`;
  const statusClass = getStatusClass(enrichedShipment.status);
  const liveStatusText = carrierTracking?.statusText
    ? escapeHtml(carrierTracking.statusText)
    : escapeHtml(enrichedShipment.carrier_status_text || "-");
  const trackingBlocked = isMerchantTrackingBlocked(enrichedShipment);

  return `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>ShipOne Admin Shipment</title>
      <style>
        :root {
          --bg: #f5f7fb;
          --card: #ffffff;
          --text: #14213d;
          --muted: #64748b;
          --line: #e2e8f0;
          --brand: #2563eb;
          --brand-dark: #1d4ed8;
          --success-bg: #ecfdf5;
          --success-text: #047857;
          --warning-bg: #fff7ed;
          --warning-text: #b45309;
          --danger-bg: #fef2f2;
          --danger-text: #b91c1c;
          --neutral-bg: #f8fafc;
          --neutral-text: #475569;
          --info-bg: #eff6ff;
          --info-text: #1d4ed8;
          --shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
          --selected-bg: #eef4ff;
          --selected-line: #c7d7fe;
          --actual-bg: #ecfdf5;
          --actual-line: #b7e4cb;
        }

        * {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          background: var(--bg);
          color: var(--text);
        }

        body {
          padding: 28px 16px 48px;
        }

        .wrap {
          max-width: 1320px;
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }

        .brand {
          color: var(--brand);
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 1.6px;
          text-transform: uppercase;
        }

        .top-links {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .pill-link {
          display: inline-flex;
          align-items: center;
          text-decoration: none;
          background: #fff;
          border: 1px solid var(--line);
          color: var(--text);
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 14px;
          font-weight: 700;
        }

        .hero {
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          border: 1px solid #ebf0f6;
          border-radius: 24px;
          box-shadow: var(--shadow);
          padding: 28px;
          margin-bottom: 20px;
        }

        h1 {
          margin: 0 0 10px;
          font-size: 40px;
          line-height: 1.05;
        }

        .subtitle {
          margin: 0;
          color: var(--muted);
          font-size: 17px;
          line-height: 1.6;
          max-width: 820px;
        }

        .hero-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 18px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 9px 13px;
          font-size: 12px;
          font-weight: 800;
        }

        .badge-completed {
          background: var(--success-bg);
          color: var(--success-text);
        }

        .badge-processing {
          background: var(--warning-bg);
          color: var(--warning-text);
        }

        .badge-failed {
          background: var(--danger-bg);
          color: var(--danger-text);
        }

        .badge-neutral {
          background: var(--neutral-bg);
          color: var(--neutral-text);
        }

        .policy-hero {
          margin-top: 18px;
          padding: 16px 18px;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .policy-hero-top {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .policy-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 800;
        }

        .policy-pill-ok {
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #bbf7d0;
        }

        .policy-pill-warning {
          background: #fff7ed;
          color: #9a3412;
          border: 1px solid #fed7aa;
        }

        .policy-pill-blocked {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .policy-hero-text {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text);
        }

        .sync-banner {
          margin-top: 18px;
          border-radius: 16px;
          padding: 14px 16px;
          font-size: 14px;
          font-weight: 700;
        }

        .sync-banner-success {
          background: var(--success-bg);
          color: var(--success-text);
          border: 1px solid #bbf7d0;
        }

        .sync-banner-warning {
          background: var(--warning-bg);
          color: var(--warning-text);
          border: 1px solid #fed7aa;
        }

        .sync-banner-error {
          background: var(--danger-bg);
          color: var(--danger-text);
          border: 1px solid #fecaca;
        }

        .action-links {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 18px;
        }

        .action-button {
          display: inline-flex;
          align-items: center;
          text-decoration: none;
          background: var(--brand);
          color: white;
          border-radius: 14px;
          padding: 12px 16px;
          font-weight: 700;
          font-size: 14px;
          border: none;
          cursor: pointer;
        }

        .action-button.secondary {
          background: #fff;
          color: var(--brand);
          border: 1px solid #cfe0ff;
        }

        .action-button.warning {
          background: #f59e0b;
          color: #fff;
        }

        .action-button.disabled {
          background: #e5e7eb;
          color: #6b7280;
          border: 1px solid #d1d5db;
          cursor: not-allowed;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .card {
          background: var(--card);
          border: 1px solid #ebf0f6;
          border-radius: 22px;
          box-shadow: var(--shadow);
          padding: 22px;
        }

        .full-width {
          grid-column: 1 / -1;
        }

        .card-title {
          margin: 0 0 18px;
          font-size: 20px;
          font-weight: 800;
        }

        .info-list {
          display: grid;
          gap: 14px;
        }

        .info-row {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 12px;
          align-items: start;
          padding-bottom: 14px;
          border-bottom: 1px solid #edf2f7;
        }

        .info-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .label {
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .value {
          font-size: 15px;
          line-height: 1.6;
          word-break: break-word;
        }

        .value strong {
          font-size: 17px;
        }

        .routing-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .routing-box {
          border: 1px solid var(--line);
          background: #fbfdff;
          border-radius: 18px;
          padding: 16px;
        }

        .routing-box-selected {
          background: var(--selected-bg);
          border-color: var(--selected-line);
        }

        .routing-box-actual {
          background: var(--actual-bg);
          border-color: var(--actual-line);
        }

        .routing-label {
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .routing-value {
          font-size: 24px;
          font-weight: 800;
          line-height: 1.15;
          margin-bottom: 8px;
        }

        .routing-subvalue {
          font-size: 14px;
          line-height: 1.5;
          color: var(--muted);
        }

        .snapshot-lines-wrap {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }

        .snapshot-line {
          border: 1px solid #e6edf5;
          background: #fbfdff;
          border-radius: 16px;
          padding: 14px;
        }

        .snapshot-line-title {
          font-size: 14px;
          font-weight: 800;
          margin-bottom: 6px;
        }

        .snapshot-line-meta {
          font-size: 14px;
          line-height: 1.6;
          color: var(--muted);
        }

        .json-block {
          margin: 0;
          background: #0f172a;
          color: #e2e8f0;
          padding: 18px;
          border-radius: 16px;
          overflow-x: auto;
          font-size: 12px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .empty-note {
          color: var(--muted);
          line-height: 1.6;
        }

        .timeline {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 14px;
        }

        .timeline-item {
          display: grid;
          grid-template-columns: 16px 1fr;
          gap: 14px;
          align-items: start;
        }

        .timeline-marker {
          width: 16px;
          height: 16px;
          border-radius: 999px;
          margin-top: 6px;
        }

        .event-done {
          background: #047857;
        }

        .event-active {
          background: #2563eb;
        }

        .event-failed {
          background: #b91c1c;
        }

        .event-pending {
          background: #94a3b8;
        }

        .timeline-card {
          background: #ffffff;
          border: 1px solid #e6edf5;
          border-radius: 16px;
          padding: 16px;
        }

        .timeline-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 6px;
        }

        .timeline-title {
          font-size: 16px;
          font-weight: 800;
        }

        .timeline-source {
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .timeline-time {
          font-size: 14px;
          color: var(--muted);
          margin-bottom: 8px;
        }

        .timeline-description {
          font-size: 14px;
          line-height: 1.6;
        }

        .health-panel,
        .policy-panel {
          display: grid;
          gap: 16px;
        }

        .health-top,
        .policy-top {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }

        .health-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 800;
        }

        .health-ok {
          background: var(--success-bg);
          color: var(--success-text);
        }

        .health-waiting {
          background: var(--info-bg);
          color: var(--info-text);
        }

        .health-warning {
          background: var(--warning-bg);
          color: var(--warning-text);
        }

        .health-problem {
          background: var(--danger-bg);
          color: var(--danger-text);
        }

        .health-neutral {
          background: var(--neutral-bg);
          color: var(--neutral-text);
        }

        .policy-summary {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text);
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 14px 16px;
        }

        @media (max-width: 1120px) {
          .routing-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 980px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          h1 {
            font-size: 32px;
          }

          .info-row {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .routing-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="topbar">
          <div class="brand">ShipOne Admin</div>
          <div class="top-links">
            <a class="pill-link" href="/admin">Admin Dashboard</a>
            <a class="pill-link" href="/" target="_blank" rel="noopener noreferrer">Startsida</a>
            <a class="pill-link" href="${adminJsonUrl}" target="_blank" rel="noopener noreferrer">Shipment JSON</a>
          </div>
        </div>

        <div class="hero">
          <h1>${orderName}</h1>
          <p class="subtitle">
            Detaljsida för shipment i ShipOne admin. Här ser du orderdata, carrier-status, sync-data och full timeline för tracking.
          </p>

          <div class="hero-meta">
            <span class="badge ${statusClass}">${status}</span>
            <span class="badge badge-neutral">${carrier}</span>
            <span class="badge badge-neutral">Order ID: ${orderId}</span>
          </div>

          <div class="policy-hero">
            <div class="policy-hero-top">
              <span class="policy-pill ${escapeHtml(policy.className)}">${escapeHtml(policy.label)}</span>
            </div>
            <div class="policy-hero-text">
              ${escapeHtml(policy.summary)}
            </div>
          </div>

          ${renderSyncBanner(syncState)}

          <div class="action-links">
            ${
              trackingPageUrl
                ? `<a class="action-button" href="${trackingPageUrl}" target="_blank" rel="noopener noreferrer">Öppna publik tracking</a>`
                : ""
            }
            ${
              trackingUrl
                ? `<a class="action-button secondary" href="${trackingUrl}" target="_blank" rel="noopener noreferrer">Öppna carrier-tracking</a>`
                : ""
            }
            <a class="action-button secondary" href="${adminJsonUrl}" target="_blank" rel="noopener noreferrer">Öppna JSON</a>
            ${
              trackingBlocked
                ? `<button class="action-button disabled" type="button" disabled title="Tracking är blockerad av merchant-policy">Sync spärrad av policy</button>`
                : `
                  <form method="POST" action="${manualSyncUrl}" style="display:inline;">
                    <button class="action-button warning" type="submit">Synka tracking nu</button>
                  </form>
                `
            }
          </div>
        </div>

        <div class="grid">
          ${renderPolicyPanel(enrichedShipment)}
          ${renderHealthPanel(enrichedShipment)}
          ${renderRoutingPanel(enrichedShipment)}
          ${renderCheckoutSnapshotPanel(enrichedShipment)}

          <div class="card">
            <h2 class="card-title">Grundinformation</h2>

            <div class="info-list">
              <div class="info-row">
                <div class="label">Order</div>
                <div class="value"><strong>${orderName}</strong></div>
              </div>

              <div class="info-row">
                <div class="label">Order ID</div>
                <div class="value">${orderId}</div>
              </div>

              <div class="info-row">
                <div class="label">Ordernummer</div>
                <div class="value">${escapeHtml(enrichedShipment.order_number || "-")}</div>
              </div>

              <div class="info-row">
                <div class="label">Merchant ID</div>
                <div class="value">${escapeHtml(enrichedShipment.merchant_id || "-")}</div>
              </div>

              <div class="info-row">
                <div class="label">Shop domain</div>
                <div class="value">${escapeHtml(enrichedShipment.shop_domain || "-")}</div>
              </div>

              <div class="info-row">
                <div class="label">E-post</div>
                <div class="value">${escapeHtml(enrichedShipment.email || "-")}</div>
              </div>

              <div class="info-row">
                <div class="label">Kund</div>
                <div class="value">${escapeHtml(enrichedShipment.customer_name || "-")}</div>
              </div>

              <div class="info-row">
                <div class="label">Land</div>
                <div class="value">${escapeHtml(enrichedShipment.shipping_country || "-")}</div>
              </div>

              <div class="info-row">
                <div class="label">Stad</div>
                <div class="value">${escapeHtml(enrichedShipment.shipping_city || "-")}</div>
              </div>

              <div class="info-row">
                <div class="label">Postnummer</div>
                <div class="value">${escapeHtml(enrichedShipment.shipping_zip || "-")}</div>
              </div>
            </div>
          </div>

          <div class="card">
            <h2 class="card-title">Tracking & Sync</h2>

            <div class="info-list">
              <div class="info-row">
                <div class="label">Carrier</div>
                <div class="value">${carrier}</div>
              </div>

              <div class="info-row">
                <div class="label">Status</div>
                <div class="value">${status}</div>
              </div>

              <div class="info-row">
                <div class="label">Trackingnummer</div>
                <div class="value">${trackingNumber}</div>
              </div>

              <div class="info-row">
                <div class="label">Live carrier-status</div>
                <div class="value">${liveStatusText}</div>
              </div>

              <div class="info-row">
                <div class="label">Carrier events</div>
                <div class="value">${escapeHtml(String(enrichedShipment.carrier_event_count ?? 0))}</div>
              </div>

              <div class="info-row">
                <div class="label">Senaste carrier-event</div>
                <div class="value">${escapeHtml(formatDateSv(enrichedShipment.carrier_last_event_at))}</div>
              </div>

              <div class="info-row">
                <div class="label">Senast synkad</div>
                <div class="value">${escapeHtml(formatDateSv(enrichedShipment.carrier_last_synced_at))}</div>
              </div>

              <div class="info-row">
                <div class="label">Nästa sync</div>
                <div class="value">${escapeHtml(formatDateSv(enrichedShipment.carrier_next_sync_at))}</div>
              </div>

              <div class="info-row">
                <div class="label">Sync-försök</div>
                <div class="value">${escapeHtml(String(enrichedShipment.carrier_sync_attempts ?? 0))}</div>
              </div>

              <div class="info-row">
                <div class="label">Senaste sync-status</div>
                <div class="value">${escapeHtml(enrichedShipment.carrier_last_sync_status || "-")}</div>
              </div>

              <div class="info-row">
                <div class="label">Skapad</div>
                <div class="value">${escapeHtml(formatDateSv(enrichedShipment.created_at))}</div>
              </div>

              <div class="info-row">
                <div class="label">Slutförd</div>
                <div class="value">${escapeHtml(formatDateSv(enrichedShipment.completed_at))}</div>
              </div>

              <div class="info-row">
                <div class="label">Senast uppdaterad</div>
                <div class="value">${escapeHtml(formatDateSv(enrichedShipment.updated_at))}</div>
              </div>
            </div>
          </div>

          <div class="card full-width">
            <h2 class="card-title">Tracking Events Timeline</h2>
            ${renderTimeline(events)}
          </div>

          <div class="card full-width">
            <h2 class="card-title">Shipment result</h2>
            ${renderJsonBlock(enrichedShipment.shipment_result)}
          </div>

          <div class="card full-width">
            <h2 class="card-title">Fulfillment result</h2>
            ${renderJsonBlock(enrichedShipment.fulfillment_result)}
          </div>

          <div class="card full-width">
            <h2 class="card-title">Selected option</h2>
            ${renderJsonBlock(enrichedShipment.selected_option)}
          </div>

          <div class="card full-width">
            <h2 class="card-title">Fel / systemnotering</h2>
            ${
              enrichedShipment.error
                ? `<pre class="json-block">${escapeHtml(enrichedShipment.error)}</pre>`
                : `<div class="empty-note">Inget fel sparat för detta shipment.</div>`
            }
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  renderAdminShipmentDetails
};
