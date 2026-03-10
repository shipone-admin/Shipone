function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function getHeadingText(status) {
  if (status === "completed") return "Ditt paket är skickat";
  if (status === "processing") return "Din leverans behandlas";
  if (status === "failed") return "Ett problem uppstod med leveransen";
  return "Leveransstatus";
}

function getStatusMeta(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "completed") {
    return {
      label: "Skickad",
      description: "Försändelsen är skapad och skickad vidare med transportören.",
      badgeClass: "status-completed"
    };
  }

  if (normalized === "processing") {
    return {
      label: "Behandlas",
      description: "Leveransen behandlas just nu i ShipOne-flödet.",
      badgeClass: "status-processing"
    };
  }

  if (normalized === "failed") {
    return {
      label: "Misslyckades",
      description: "Något gick fel i leveransflödet och behöver kontrolleras.",
      badgeClass: "status-failed"
    };
  }

  return {
    label: formatShipmentStatus(status),
    description: "Status är registrerad men kunde inte kategoriseras tydligare ännu.",
    badgeClass: "status-unknown"
  };
}

function renderTrackingPage(shipment) {
  const orderName = escapeHtml(shipment.order_name || "-");
  const carrier = escapeHtml(formatCarrierName(shipment.actual_carrier));
  const status = escapeHtml(formatShipmentStatus(shipment.status));
  const trackingNumber = escapeHtml(shipment.tracking_number || "-");
  const trackingUrl = shipment.tracking_url ? escapeHtml(shipment.tracking_url) : "";
  const createdAt = escapeHtml(formatDateSv(shipment.created_at));
  const completedAt = escapeHtml(formatDateSv(shipment.completed_at));
  const headingText = escapeHtml(getHeadingText(shipment.status));
  const statusMeta = getStatusMeta(shipment.status);

  const trackingButton = trackingUrl
    ? `
      <a class="button" href="${trackingUrl}" target="_blank" rel="noopener noreferrer">
        Öppna spårning hos transportör
      </a>
    `
    : `
      <div class="button button-disabled">
        Trackinglänk saknas
      </div>
    `;

  return `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>ShipOne Tracking</title>
      <meta name="description" content="Spåra din försändelse i ShipOne." />
      <style>
        :root {
          --bg: #f4f7fb;
          --card: #ffffff;
          --card-soft: #f8fbff;
          --text: #14213d;
          --muted: #64748b;
          --line: #e5e7eb;
          --brand: #2563eb;
          --brand-dark: #1d4ed8;
          --soft: #eef4ff;
          --success: #0f766e;
          --success-soft: #ecfdf5;
          --warning: #a16207;
          --warning-soft: #fff7ed;
          --danger: #b91c1c;
          --danger-soft: #fef2f2;
          --neutral-soft: #f8fafc;
          --shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
        }

        * {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          background: linear-gradient(180deg, #f7f9fd 0%, #f2f5fa 100%);
          color: var(--text);
          font-family: Arial, sans-serif;
        }

        a {
          color: inherit;
        }

        .page {
          min-height: 100vh;
          padding: 28px 16px 48px;
        }

        .wrap {
          max-width: 1040px;
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

        .brand-mini {
          color: var(--brand);
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 1.6px;
          text-transform: uppercase;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
        }

        .card {
          background: var(--card);
          border-radius: 26px;
          box-shadow: var(--shadow);
          overflow: hidden;
          border: 1px solid #edf2f7;
        }

        .hero {
          padding: 34px 34px 22px;
          background:
            radial-gradient(circle at top right, rgba(37, 99, 235, 0.10), transparent 35%),
            linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          border-bottom: 1px solid var(--line);
        }

        .hero-grid {
          display: grid;
          grid-template-columns: 1.35fr 0.9fr;
          gap: 22px;
          align-items: start;
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
          font-size: 44px;
          line-height: 1.05;
        }

        .subtitle {
          margin: 12px 0 0;
          color: var(--muted);
          font-size: 18px;
          line-height: 1.6;
          max-width: 640px;
        }

        .status-panel {
          background: var(--card-soft);
          border: 1px solid var(--line);
          border-radius: 20px;
          padding: 18px;
        }

        .status-panel-label {
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 10px;
          font-weight: 700;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 15px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .status-badge::before {
          content: "";
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: currentColor;
          flex: 0 0 auto;
        }

        .status-completed {
          background: var(--success-soft);
          color: var(--success);
          border: 1px solid #bbf7d0;
        }

        .status-processing {
          background: var(--warning-soft);
          color: var(--warning);
          border: 1px solid #fed7aa;
        }

        .status-failed {
          background: var(--danger-soft);
          color: var(--danger);
          border: 1px solid #fecaca;
        }

        .status-unknown {
          background: var(--neutral-soft);
          color: #475569;
          border: 1px solid #cbd5e1;
        }

        .status-description {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.6;
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

        .main-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .section-card {
          background: #f8fafc;
          border: 1px solid #eef2f7;
          border-radius: 18px;
          padding: 22px;
        }

        .section-title {
          margin: 0 0 18px;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .info-list {
          display: grid;
          gap: 14px;
        }

        .info-row {
          display: grid;
          grid-template-columns: 130px 1fr;
          gap: 12px;
          align-items: start;
          padding-bottom: 14px;
          border-bottom: 1px solid #e9eef5;
        }

        .info-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .label {
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.7px;
          font-weight: 700;
        }

        .value {
          font-size: 17px;
          font-weight: 700;
          line-height: 1.45;
          word-break: break-word;
        }

        .timeline {
          list-style: none;
          margin: 0;
          padding: 0;
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
          bottom: 0;
          width: 2px;
          background: #dbe3ee;
        }

        .timeline-dot {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          border: 2px solid #bfccdb;
          background: #fff;
          position: relative;
          z-index: 1;
          margin-top: 2px;
        }

        .timeline-item.done .timeline-dot {
          background: var(--success);
          border-color: var(--success);
          box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.12);
        }

        .timeline-title {
          font-size: 15px;
          font-weight: 800;
          margin-bottom: 4px;
        }

        .timeline-value {
          color: var(--muted);
          font-size: 14px;
          line-height: 1.6;
        }

        .future-box {
          margin-top: 18px;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px dashed #cbd5e1;
          background: #ffffff;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.6;
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

        .button-disabled {
          background: #94a3b8;
          cursor: default;
        }

        .footer {
          margin-top: 26px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.7;
        }

        @media (max-width: 900px) {
          .hero-grid,
          .main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          h1 {
            font-size: 34px;
          }

          .hero,
          .content {
            padding-left: 20px;
            padding-right: 20px;
          }

          .subtitle {
            font-size: 16px;
          }

          .info-row {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .page {
            padding-left: 12px;
            padding-right: 12px;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="wrap">
          <div class="topbar">
            <div class="brand-mini">ShipOne Tracking</div>
            <a class="back-link" href="/">← Till startsidan</a>
          </div>

          <div class="card">
            <div class="hero">
              <div class="hero-grid">
                <div>
                  <div class="brand">SHIPONE</div>
                  <h1>Tracking</h1>
                  <p class="subtitle">${headingText}. Här kan du följa din leverans och se aktuell shipment-information.</p>
                </div>

                <div class="status-panel">
                  <div class="status-panel-label">Aktuell status</div>
                  <div class="status-badge ${statusMeta.badgeClass}">${escapeHtml(statusMeta.label)}</div>
                  <p class="status-description">${escapeHtml(statusMeta.description)}</p>
                </div>
              </div>
            </div>

            <div class="content">
              <div class="status-banner">
                <div class="status-dot"></div>
                <div class="status-text">
                  <strong>Status: ${status}</strong>
                  <span>Order ${orderName} hanteras via ${carrier}.</span>
                </div>
              </div>

              <div class="main-grid">
                <div class="section-card">
                  <h2 class="section-title">Försändelseinformation</h2>

                  <div class="info-list">
                    <div class="info-row">
                      <div class="label">Order</div>
                      <div class="value">${orderName}</div>
                    </div>

                    <div class="info-row">
                      <div class="label">Transportör</div>
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
                      <div class="label">Skapad</div>
                      <div class="value">${createdAt}</div>
                    </div>

                    <div class="info-row">
                      <div class="label">Slutförd</div>
                      <div class="value">${completedAt}</div>
                    </div>
                  </div>
                </div>

                <div class="section-card">
                  <h2 class="section-title">Statusöversikt</h2>

                  <ul class="timeline">
                    <li class="timeline-item done">
                      <div class="timeline-dot"></div>
                      <div>
                        <div class="timeline-title">Shipment registrerat</div>
                        <div class="timeline-value">${createdAt}</div>
                      </div>
                    </li>

                    <li class="timeline-item ${shipment.completed_at ? "done" : ""}">
                      <div class="timeline-dot"></div>
                      <div>
                        <div class="timeline-title">Fulfillment</div>
                        <div class="timeline-value">${shipment.completed_at ? completedAt : "Inte slutförd ännu"}</div>
                      </div>
                    </li>

                    <li class="timeline-item ${shipment.status === "completed" ? "done" : ""}">
                      <div class="timeline-dot"></div>
                      <div>
                        <div class="timeline-title">Transportstatus</div>
                        <div class="timeline-value">${status}</div>
                      </div>
                    </li>

                    <li class="timeline-item">
                      <div class="timeline-dot"></div>
                      <div>
                        <div class="timeline-title">Leveranshändelser</div>
                        <div class="timeline-value">Redo för framtida event-data från transportören</div>
                      </div>
                    </li>
                  </ul>

                  <div class="future-box">
                    Den här sektionen är förberedd för att senare visa riktiga tracking-events från PostNord och fler carriers.
                  </div>
                </div>
              </div>

              <div class="actions">
                ${trackingButton}
              </div>

              <div class="footer">
                ShipOne hjälper butiker att välja rätt fraktalternativ och ge kunder enkel spårning.
              </div>
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

        .actions {
          margin-top: 24px;
        }

        .link {
          display: inline-block;
          text-decoration: none;
          color: #2563eb;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="brand">SHIPONE</div>
        <h1>Tracking</h1>
        <p>Vi kunde inte hitta något paket med det här trackingnumret.</p>
        <div class="actions">
          <a class="link" href="/">Till startsidan</a>
        </div>
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

        .actions {
          margin-top: 24px;
        }

        .link {
          display: inline-block;
          text-decoration: none;
          color: #2563eb;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="brand">SHIPONE</div>
        <h1>Tracking</h1>
        <p>Det gick inte att hämta spårningen just nu. Försök igen om en liten stund.</p>
        <div class="actions">
          <a class="link" href="/">Till startsidan</a>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  renderTrackingPage,
  renderTrackingNotFoundPage,
  renderTrackingErrorPage
};
