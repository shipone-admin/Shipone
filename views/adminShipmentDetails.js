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
  if (source === "carrier") return "Transportör";
  return "ShipOne";
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

function renderAdminShipmentDetails({ shipment, events = [], carrierTracking = null }) {
  const orderId = escapeHtml(shipment.order_id || "-");
  const orderName = escapeHtml(shipment.order_name || "-");
  const carrier = escapeHtml(formatCarrierName(shipment.actual_carrier));
  const status = escapeHtml(formatShipmentStatus(shipment.status));
  const trackingNumber = escapeHtml(shipment.tracking_number || "-");
  const trackingUrl = shipment.tracking_url
    ? escapeHtml(shipment.tracking_url)
    : "";
  const trackingPageUrl = shipment.tracking_number
    ? `/track/${encodeURIComponent(shipment.tracking_number)}`
    : "";
  const adminJsonUrl = `/shipments/${encodeURIComponent(shipment.order_id)}`;
  const statusClass = getStatusClass(shipment.status);
  const liveStatusText = carrierTracking?.statusText
    ? escapeHtml(carrierTracking.statusText)
    : escapeHtml(shipment.carrier_status_text || "-");

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
          --shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
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
        }

        .action-button.secondary {
          background: #fff;
          color: var(--brand);
          border: 1px solid #cfe0ff;
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
          </div>
        </div>

        <div class="grid">
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
                <div class="value">${escapeHtml(shipment.order_number || "-")}</div>
              </div>

              <div class="info-row">
                <div class="label">E-post</div>
                <div class="value">${escapeHtml(shipment.email || "-")}</div>
              </div>

              <div class="info-row">
                <div class="label">Kund</div>
                <div class="value">${escapeHtml(shipment.customer_name || "-")}</div>
              </div>

              <div class="info-row">
                <div class="label">Land</div>
                <div class="value">${escapeHtml(shipment.shipping_country || "-")}</div>
              </div>

              <div class="info-row">
                <div class="label">Stad</div>
                <div class="value">${escapeHtml(shipment.shipping_city || "-")}</div>
              </div>

              <div class="info-row">
                <div class="label">Postnummer</div>
                <div class="value">${escapeHtml(shipment.shipping_zip || "-")}</div>
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
                <div class="value">${escapeHtml(String(shipment.carrier_event_count ?? 0))}</div>
              </div>

              <div class="info-row">
                <div class="label">Senaste carrier-event</div>
                <div class="value">${escapeHtml(formatDateSv(shipment.carrier_last_event_at))}</div>
              </div>

              <div class="info-row">
                <div class="label">Senast synkad</div>
                <div class="value">${escapeHtml(formatDateSv(shipment.carrier_last_synced_at))}</div>
              </div>

              <div class="info-row">
                <div class="label">Nästa sync</div>
                <div class="value">${escapeHtml(formatDateSv(shipment.carrier_next_sync_at))}</div>
              </div>

              <div class="info-row">
                <div class="label">Sync-försök</div>
                <div class="value">${escapeHtml(String(shipment.carrier_sync_attempts ?? 0))}</div>
              </div>

              <div class="info-row">
                <div class="label">Senaste sync-status</div>
                <div class="value">${escapeHtml(shipment.carrier_last_sync_status || "-")}</div>
              </div>

              <div class="info-row">
                <div class="label">Skapad</div>
                <div class="value">${escapeHtml(formatDateSv(shipment.created_at))}</div>
              </div>

              <div class="info-row">
                <div class="label">Slutförd</div>
                <div class="value">${escapeHtml(formatDateSv(shipment.completed_at))}</div>
              </div>

              <div class="info-row">
                <div class="label">Senast uppdaterad</div>
                <div class="value">${escapeHtml(formatDateSv(shipment.updated_at))}</div>
              </div>
            </div>
          </div>

          <div class="card full-width">
            <h2 class="card-title">Tracking Events Timeline</h2>
            ${renderTimeline(events)}
          </div>

          <div class="card full-width">
            <h2 class="card-title">Shipment result</h2>
            ${renderJsonBlock(shipment.shipment_result)}
          </div>

          <div class="card full-width">
            <h2 class="card-title">Fulfillment result</h2>
            ${renderJsonBlock(shipment.fulfillment_result)}
          </div>

          <div class="card full-width">
            <h2 class="card-title">Selected option</h2>
            ${renderJsonBlock(shipment.selected_option)}
          </div>

          <div class="card full-width">
            <h2 class="card-title">Fel / systemnotering</h2>
            ${
              shipment.error
                ? `<pre class="json-block">${escapeHtml(shipment.error)}</pre>`
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
