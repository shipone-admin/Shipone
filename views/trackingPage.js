function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeStatus(status, fulfilledAt) {
  const raw = String(status || "").trim().toLowerCase();

  if (raw === "delivered") {
    return {
      key: "delivered",
      label: "Levererad",
      description: "Paketet har levererats till mottagaren.",
    };
  }

  if (raw === "in_transit" || raw === "in-transit" || raw === "transit") {
    return {
      key: "in_transit",
      label: "På väg",
      description: "Paketet är på väg genom transportörens nätverk.",
    };
  }

  if (raw === "fulfilled" || raw === "shipped" || raw === "completed") {
    return {
      key: "fulfilled",
      label: "Slutförd",
      description: "Försändelsen är skapad och fulfillment är genomförd.",
    };
  }

  if (raw === "created" || raw === "pending" || raw === "ready") {
    return {
      key: "created",
      label: "Skapad",
      description: "Försändelsen är registrerad och väntar på nästa steg.",
    };
  }

  if (!raw && fulfilledAt) {
    return {
      key: "fulfilled",
      label: "Slutförd",
      description: "Försändelsen är skapad och fulfillment är genomförd.",
    };
  }

  return {
    key: "unknown",
    label: raw ? escapeHtml(status) : "Okänd",
    description: "Aktuell status kunde inte tolkas fullt ut ännu.",
  };
}

function buildTimeline(shipment, statusMeta) {
  const items = [];

  if (shipment.createdAt) {
    items.push({
      title: "Shipment skapat",
      value: formatDate(shipment.createdAt),
      done: true,
    });
  } else {
    items.push({
      title: "Shipment skapat",
      value: "Väntar på data",
      done: false,
    });
  }

  items.push({
    title: "Fulfillment",
    value: shipment.fulfilledAt ? formatDate(shipment.fulfilledAt) : "Inte slutförd ännu",
    done: Boolean(shipment.fulfilledAt),
  });

  items.push({
    title: "Transportstatus",
    value: statusMeta.label,
    done: statusMeta.key !== "unknown",
  });

  if (statusMeta.key === "delivered") {
    items.push({
      title: "Levererad",
      value: "Paketet är levererat",
      done: true,
    });
  } else {
    items.push({
      title: "Leverans",
      value: "Inte bekräftad ännu",
      done: false,
    });
  }

  return items;
}

function renderTimeline(items) {
  return items
    .map(
      (item) => `
        <li class="timeline-item ${item.done ? "is-done" : ""}">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-title">${escapeHtml(item.title)}</div>
            <div class="timeline-value">${escapeHtml(item.value)}</div>
          </div>
        </li>
      `
    )
    .join("");
}

function renderTrackingPage(shipmentInput = {}) {
  const shipment = {
    orderNumber: shipmentInput.orderNumber || shipmentInput.order || shipmentInput.shopifyOrderNumber || "",
    carrier: shipmentInput.carrier || shipmentInput.carrierName || "PostNord",
    status: shipmentInput.status || "",
    trackingNumber: shipmentInput.trackingNumber || "",
    createdAt: shipmentInput.createdAt || shipmentInput.created_at || "",
    fulfilledAt: shipmentInput.fulfilledAt || shipmentInput.fulfilled_at || "",
  };

  const statusMeta = normalizeStatus(shipment.status, shipment.fulfilledAt);
  const timeline = buildTimeline(shipment, statusMeta);

  const pageTitle = shipment.trackingNumber
    ? `Spåra paket ${shipment.trackingNumber} | ShipOne`
    : "Spåra paket | ShipOne";

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="Spåra din försändelse i ShipOne." />
  <style>
    :root {
      --bg: #f6f8fb;
      --surface: #ffffff;
      --surface-soft: #f8fafc;
      --text: #102033;
      --muted: #607089;
      --border: #dbe3ee;
      --primary: #0f62fe;
      --primary-soft: #eaf2ff;
      --success: #0f9f6e;
      --success-soft: #e9fbf4;
      --warning: #b7791f;
      --warning-soft: #fff6e5;
      --shadow: 0 10px 30px rgba(16, 32, 51, 0.08);
      --radius: 18px;
      --radius-sm: 12px;
      --max: 1040px;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: linear-gradient(180deg, #f8fbff 0%, #f3f6fb 100%);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    a {
      color: var(--primary);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .page {
      min-height: 100vh;
      padding: 32px 20px 48px;
    }

    .container {
      width: 100%;
      max-width: var(--max);
      margin: 0 auto;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .brand {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      background: rgba(255,255,255,0.8);
      border: 1px solid var(--border);
      padding: 10px 14px;
      border-radius: 999px;
      backdrop-filter: blur(6px);
    }

    .hero {
      background: radial-gradient(circle at top right, rgba(15, 98, 254, 0.12), transparent 32%),
                  linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      border-radius: 28px;
      padding: 28px;
      margin-bottom: 22px;
    }

    .hero-grid {
      display: grid;
      grid-template-columns: 1.4fr 0.8fr;
      gap: 18px;
      align-items: start;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
      color: var(--primary);
      background: var(--primary-soft);
      border-radius: 999px;
      padding: 8px 12px;
      margin-bottom: 14px;
    }

    h1 {
      font-size: clamp(28px, 4vw, 44px);
      line-height: 1.05;
      margin: 0 0 12px;
      letter-spacing: -0.03em;
    }

    .lead {
      margin: 0;
      font-size: 16px;
      line-height: 1.6;
      color: var(--muted);
      max-width: 60ch;
    }

    .status-panel {
      background: var(--surface-soft);
      border: 1px solid var(--border);
      border-radius: 22px;
      padding: 18px;
    }

    .status-panel-label {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-bottom: 10px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      border-radius: 999px;
      padding: 10px 16px;
      font-weight: 800;
      font-size: 15px;
      margin-bottom: 12px;
    }

    .status-badge::before {
      content: "";
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.9;
    }

    .status-created {
      color: #8a5a00;
      background: var(--warning-soft);
      border: 1px solid #f0d9a6;
    }

    .status-fulfilled,
    .status-in_transit,
    .status-delivered {
      color: var(--success);
      background: var(--success-soft);
      border: 1px solid #bee9d9;
    }

    .status-unknown {
      color: #4d5b72;
      background: #edf2f7;
      border: 1px solid #d5deea;
    }

    .status-description {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
      font-size: 14px;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 22px;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 22px;
    }

    .card h2 {
      margin: 0 0 18px;
      font-size: 18px;
      letter-spacing: -0.02em;
    }

    .info-list {
      display: grid;
      gap: 14px;
    }

    .info-row {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 12px;
      align-items: start;
      padding-bottom: 14px;
      border-bottom: 1px solid #edf2f7;
    }

    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .info-label {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .info-value {
      font-size: 15px;
      font-weight: 600;
      color: var(--text);
      word-break: break-word;
    }

    .tracking-number {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.02em;
    }

    .timeline {
      list-style: none;
      margin: 0;
      padding: 0;
      position: relative;
    }

    .timeline-item {
      display: grid;
      grid-template-columns: 22px 1fr;
      gap: 14px;
      position: relative;
      padding-bottom: 18px;
    }

    .timeline-item:last-child {
      padding-bottom: 0;
    }

    .timeline-item:not(:last-child)::after {
      content: "";
      position: absolute;
      left: 10px;
      top: 22px;
      width: 2px;
      bottom: 0;
      background: #dbe3ee;
    }

    .timeline-dot {
      width: 22px;
      height: 22px;
      border-radius: 999px;
      border: 2px solid #b9c7d9;
      background: #fff;
      position: relative;
      z-index: 1;
      margin-top: 2px;
    }

    .timeline-item.is-done .timeline-dot {
      background: var(--success);
      border-color: var(--success);
      box-shadow: 0 0 0 4px rgba(15, 159, 110, 0.12);
    }

    .timeline-title {
      font-size: 15px;
      font-weight: 800;
      margin-bottom: 4px;
    }

    .timeline-value {
      font-size: 14px;
      color: var(--muted);
      line-height: 1.55;
    }

    .muted-box {
      margin-top: 18px;
      background: #fafcff;
      border: 1px dashed #cdd8e6;
      border-radius: 14px;
      padding: 16px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.6;
    }

    .footer-note {
      margin-top: 22px;
      text-align: center;
      font-size: 13px;
      color: var(--muted);
    }

    @media (max-width: 900px) {
      .hero-grid,
      .grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .page {
        padding: 20px 14px 36px;
      }

      .hero,
      .card {
        padding: 18px;
      }

      .info-row {
        grid-template-columns: 1fr;
        gap: 6px;
      }

      .topbar {
        align-items: stretch;
      }

      .back-link {
        justify-content: center;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <div class="container">
      <div class="topbar">
        <div class="brand">ShipOne Tracking</div>
        <a class="back-link" href="/">← Till startsidan</a>
      </div>

      <section class="hero">
        <div class="hero-grid">
          <div>
            <div class="eyebrow">Spårning aktiv</div>
            <h1>Paketstatus för ${escapeHtml(shipment.trackingNumber || "okänt trackingnummer")}</h1>
            <p class="lead">
              Här ser du aktuell shipment-information från ShipOne. Sidan är byggd för att vara tydlig,
              mobilvänlig och redo för framtida tracking-events.
            </p>
          </div>

          <aside class="status-panel">
            <div class="status-panel-label">Aktuell status</div>
            <div class="status-badge status-${escapeHtml(statusMeta.key)}">${escapeHtml(statusMeta.label)}</div>
            <p class="status-description">${escapeHtml(statusMeta.description)}</p>
          </aside>
        </div>
      </section>

      <section class="grid">
        <article class="card">
          <h2>Försändelseinformation</h2>
          <div class="info-list">
            <div class="info-row">
              <div class="info-label">Order</div>
              <div class="info-value">${escapeHtml(shipment.orderNumber || "—")}</div>
            </div>

            <div class="info-row">
              <div class="info-label">Transportör</div>
              <div class="info-value">${escapeHtml(shipment.carrier || "—")}</div>
            </div>

            <div class="info-row">
              <div class="info-label">Trackingnummer</div>
              <div class="info-value tracking-number">${escapeHtml(shipment.trackingNumber || "—")}</div>
            </div>

            <div class="info-row">
              <div class="info-label">Skapad</div>
              <div class="info-value">${escapeHtml(formatDate(shipment.createdAt))}</div>
            </div>

            <div class="info-row">
              <div class="info-label">Slutförd</div>
              <div class="info-value">${escapeHtml(formatDate(shipment.fulfilledAt))}</div>
            </div>
          </div>
        </article>

        <article class="card">
          <h2>Statusöversikt</h2>
          <ul class="timeline">
            ${renderTimeline(timeline)}
          </ul>

          <div class="muted-box">
            Händelser från transportören kan enkelt läggas till här senare som en riktig eventlista
            utan att layouten behöver byggas om igen.
          </div>
        </article>
      </section>

      <div class="footer-note">
        ShipOne tracking page • byggd för PostNord nu, redo för fler carriers senare
      </div>
    </div>
  </main>
</body>
</html>`;
}

module.exports = {
  renderTrackingPage,
};
