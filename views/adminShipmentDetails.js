const { enrichShipmentWithHealth } = require("../services/shipmentHealth");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatJson(value) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch (error) {
    return String(value ?? "");
  }
}

function normalizeEvents(input) {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input;
  }

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
}

function getHealthBadgeHtml(shipment) {
  const className =
    shipment.health === "ok"
      ? "badge badge-ok"
      : shipment.health === "waiting"
      ? "badge badge-waiting"
      : shipment.health === "warning"
      ? "badge badge-warning"
      : shipment.health === "problem"
      ? "badge badge-problem"
      : "badge badge-neutral";

  return `<span class="${className}">${escapeHtml(shipment.healthLabel || "—")}</span>`;
}

function renderField(label, value, mono = false) {
  return `
    <div class="field">
      <div class="field-label">${escapeHtml(label)}</div>
      <div class="field-value${mono ? " mono" : ""}">${escapeHtml(value || "—")}</div>
    </div>
  `;
}

function renderEvents(events) {
  if (!events.length) {
    return `
      <div class="empty-box">
        Inga tracking events registrerade ännu.
      </div>
    `;
  }

  return `
    <div class="timeline">
      ${events
        .map((event, index) => {
          const title =
            event.status_text ||
            event.title ||
            event.description ||
            event.event ||
            `Event ${index + 1}`;

          const timestamp =
            event.happened_at ||
            event.timestamp ||
            event.created_at ||
            event.date ||
            null;

          const location =
            event.location ||
            event.city ||
            event.facility ||
            event.country_code ||
            "";

          const details =
            event.details ||
            event.note ||
            event.raw_status ||
            "";

          return `
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-title">${escapeHtml(title)}</div>
                <div class="timeline-meta">
                  ${escapeHtml(formatDateTime(timestamp))}
                  ${location ? ` · ${escapeHtml(location)}` : ""}
                </div>
                ${
                  details
                    ? `<div class="timeline-details">${escapeHtml(details)}</div>`
                    : ""
                }
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAdminShipmentDetails(data = {}) {
  const rawShipment = data.shipment || data;
  const shipment = enrichShipmentWithHealth(rawShipment || {});
  const trackingEvents = normalizeEvents(
    shipment.tracking_events ||
      shipment.trackingEvents ||
      shipment.events ||
      []
  );

  const orderId = shipment.order_id || shipment.orderId || "";
  const orderName = shipment.order_name || shipment.orderName || "—";

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>ShipOne Admin · ${escapeHtml(orderName)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      --blue: #2563eb;
      --green-bg: #dcfce7;
      --green-text: #166534;
      --yellow-bg: #fef3c7;
      --yellow-text: #92400e;
      --red-bg: #fee2e2;
      --red-text: #991b1b;
      --blue-bg: #dbeafe;
      --blue-text: #1d4ed8;
      --gray-bg: #e5e7eb;
      --gray-text: #374151;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .back-link {
      display: inline-block;
      text-decoration: none;
      color: var(--blue);
      font-weight: 700;
      margin-bottom: 10px;
    }

    .header-title {
      margin: 0 0 8px;
      font-size: 32px;
    }

    .header-subtitle {
      color: var(--muted);
      margin: 0;
    }

    .header-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .button {
      display: inline-block;
      text-decoration: none;
      border: none;
      border-radius: 10px;
      padding: 10px 14px;
      font-weight: 700;
      cursor: pointer;
    }

    .button-primary {
      background: var(--blue);
      color: white;
    }

    .hero {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 16px;
      margin-bottom: 24px;
    }

    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 18px;
      box-shadow: var(--shadow);
    }

    .hero-title {
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 20px;
    }

    .health-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    .health-reason {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .field {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      background: #fcfdff;
    }

    .field-label {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .field-value {
      font-size: 14px;
      line-height: 1.45;
      word-break: break-word;
    }

    .mono {
      font-family: Consolas, Monaco, monospace;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .badge-ok {
      background: var(--green-bg);
      color: var(--green-text);
    }

    .badge-waiting {
      background: var(--blue-bg);
      color: var(--blue-text);
    }

    .badge-warning {
      background: var(--yellow-bg);
      color: var(--yellow-text);
    }

    .badge-problem {
      background: var(--red-bg);
      color: var(--red-text);
    }

    .badge-neutral {
      background: var(--gray-bg);
      color: var(--gray-text);
    }

    .section-title {
      margin-top: 0;
      margin-bottom: 16px;
      font-size: 20px;
    }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .timeline-item {
      display: grid;
      grid-template-columns: 20px 1fr;
      gap: 12px;
      align-items: flex-start;
    }

    .timeline-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--blue);
      margin-top: 5px;
    }

    .timeline-content {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      background: #fcfdff;
    }

    .timeline-title {
      font-weight: 700;
      margin-bottom: 6px;
    }

    .timeline-meta {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 6px;
    }

    .timeline-details {
      font-size: 14px;
      line-height: 1.45;
    }

    .empty-box {
      border: 1px dashed #cbd5e1;
      border-radius: 12px;
      padding: 20px;
      color: var(--muted);
      background: #fcfdff;
    }

    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 13px;
      line-height: 1.5;
      font-family: Consolas, Monaco, monospace;
    }

    @media (max-width: 1000px) {
      .hero,
      .grid,
      .fields {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 700px) {
      .container {
        padding: 16px;
      }

      .header-title {
        font-size: 26px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="topbar">
      <div>
        <a class="back-link" href="/admin">← Till admin</a>
        <h1 class="header-title">${escapeHtml(orderName)}</h1>
        <p class="header-subtitle">Order ID: ${escapeHtml(orderId || "—")}</p>
      </div>

      <div class="header-actions">
        <form method="POST" action="/admin/shipment/${encodeURIComponent(orderId)}/sync">
          <button class="button button-primary" type="submit">Manuell sync</button>
        </form>
      </div>
    </div>

    <div class="hero">
      <div class="card">
        <h2 class="hero-title">Shipment health</h2>
        <div class="health-row">
          ${getHealthBadgeHtml(shipment)}
        </div>
        <div class="health-reason">
          ${escapeHtml(shipment.healthReason || "Ingen health reason tillgänglig.")}
        </div>
      </div>

      <div class="card">
        <h2 class="hero-title">Snabböversikt</h2>
        <div class="fields">
          ${renderField("Carrier", shipment.carrier)}
          ${renderField("Trackingnummer", shipment.tracking_number, true)}
          ${renderField(
            "Carrier-status",
            shipment.carrier_status_text || shipment.status_text || shipment.status
          )}
          ${renderField(
            "Senaste sync-status",
            shipment.carrier_last_sync_status || shipment.sync_status
          )}
          ${renderField(
            "Senast synkad",
            formatDateTime(
              shipment.carrier_last_synced_at ||
                shipment.last_synced_at ||
                shipment.synced_at
            )
          )}
          ${renderField(
            "Nästa sync",
            formatDateTime(
              shipment.carrier_next_sync_at ||
                shipment.next_sync_at
            )
          )}
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2 class="section-title">Shipment details</h2>
        <div class="fields">
          ${renderField("Order ID", shipment.order_id || shipment.orderId)}
          ${renderField("Ordernamn", shipment.order_name || shipment.orderName)}
          ${renderField("Trackingnummer", shipment.tracking_number, true)}
          ${renderField("Carrier", shipment.carrier)}
          ${renderField(
            "Carrier status text",
            shipment.carrier_status_text || shipment.status_text
          )}
          ${renderField(
            "Health code",
            shipment.healthCode
          )}
          ${renderField(
            "Sync attempts",
            String(shipment.carrier_sync_attempts ?? "0")
          )}
          ${renderField(
            "Senaste sync-status",
            shipment.carrier_last_sync_status || shipment.sync_status
          )}
          ${renderField(
            "Skapad",
            formatDateTime(shipment.created_at)
          )}
          ${renderField(
            "Uppdaterad",
            formatDateTime(shipment.updated_at)
          )}
          ${renderField(
            "Senast synkad",
            formatDateTime(
              shipment.carrier_last_synced_at ||
                shipment.last_synced_at ||
                shipment.synced_at
            )
          )}
          ${renderField(
            "Nästa sync",
            formatDateTime(
              shipment.carrier_next_sync_at ||
                shipment.next_sync_at
            )
          )}
        </div>
      </div>

      <div class="card">
        <h2 class="section-title">Carrier snapshot</h2>
        <pre>${escapeHtml(
          formatJson(
            shipment.carrier_snapshot ||
              shipment.carrierSnapshot ||
              shipment.raw_tracking_response ||
              {}
          )
        )}</pre>
      </div>
    </div>

    <div class="card">
      <h2 class="section-title">Tracking events timeline</h2>
      ${renderEvents(trackingEvents)}
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  renderAdminShipmentDetails,
  default: renderAdminShipmentDetails,
};
