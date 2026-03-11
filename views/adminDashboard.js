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

function renderRows(shipments) {
  if (!Array.isArray(shipments) || shipments.length === 0) {
    return `
      <tr>
        <td colspan="9" class="empty-cell">Inga shipments hittades.</td>
      </tr>
    `;
  }

  return shipments
    .map((shipment) => {
      const orderName = escapeHtml(shipment.order_name || "-");
      const orderId = escapeHtml(shipment.order_id || "-");
      const carrier = escapeHtml(formatCarrierName(shipment.actual_carrier));
      const status = escapeHtml(formatShipmentStatus(shipment.status));
      const trackingNumber = escapeHtml(shipment.tracking_number || "-");
      const trackingUrl = shipment.tracking_number
        ? `/track/${encodeURIComponent(shipment.tracking_number)}`
        : null;
      const carrierStatusText = escapeHtml(shipment.carrier_status_text || "-");
      const syncedAt = escapeHtml(formatDateSv(shipment.carrier_last_synced_at));
      const createdAt = escapeHtml(formatDateSv(shipment.created_at));
      const statusClass = getStatusClass(shipment.status);

      return `
        <tr>
          <td>
            <div class="primary">${orderName}</div>
            <div class="secondary">${orderId}</div>
          </td>
          <td>${carrier}</td>
          <td><span class="badge ${statusClass}">${status}</span></td>
          <td>
            <div class="primary mono">${trackingNumber}</div>
            ${
              trackingUrl
                ? `<div class="secondary"><a href="${trackingUrl}" target="_blank" rel="noopener noreferrer">Öppna tracking</a></div>`
                : `<div class="secondary">-</div>`
            }
          </td>
          <td>${carrierStatusText}</td>
          <td>${escapeHtml(String(shipment.carrier_event_count ?? 0))}</td>
          <td>${syncedAt}</td>
          <td>${createdAt}</td>
          <td>
            <a class="action-link" href="/shipments/${encodeURIComponent(
              shipment.order_id
            )}" target="_blank" rel="noopener noreferrer">
              JSON
            </a>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderAdminDashboard({ shipments = [] } = {}) {
  const shipmentCount = Array.isArray(shipments) ? shipments.length : 0;

  return `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>ShipOne Admin Dashboard</title>
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
          max-width: 1380px;
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
          max-width: 760px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 22px;
        }

        .stat-card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 18px;
        }

        .stat-label {
          color: var(--muted);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 800;
        }

        .table-card {
          background: var(--card);
          border: 1px solid #ebf0f6;
          border-radius: 24px;
          box-shadow: var(--shadow);
          overflow: hidden;
        }

        .table-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--line);
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .table-title {
          font-size: 20px;
          font-weight: 800;
        }

        .table-subtitle {
          color: var(--muted);
          font-size: 14px;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1150px;
        }

        thead th {
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          background: #f8fafc;
          padding: 14px 18px;
          border-bottom: 1px solid var(--line);
        }

        tbody td {
          padding: 16px 18px;
          border-bottom: 1px solid #edf2f7;
          vertical-align: top;
          font-size: 14px;
        }

        tbody tr:hover {
          background: #fbfdff;
        }

        .primary {
          font-weight: 700;
          line-height: 1.5;
        }

        .secondary {
          color: var(--muted);
          font-size: 12px;
          margin-top: 4px;
          line-height: 1.5;
        }

        .secondary a,
        .action-link {
          color: var(--brand);
          text-decoration: none;
          font-weight: 700;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 8px 12px;
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

        .mono {
          font-family: monospace;
          font-size: 13px;
        }

        .empty-cell {
          text-align: center;
          color: var(--muted);
          padding: 28px;
        }

        @media (max-width: 900px) {
          .stats {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 32px;
          }
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="topbar">
          <div class="brand">ShipOne Admin</div>
          <div class="top-links">
            <a class="pill-link" href="/" target="_blank" rel="noopener noreferrer">Startsida</a>
            <a class="pill-link" href="/shipments" target="_blank" rel="noopener noreferrer">Shipments JSON</a>
          </div>
        </div>

        <div class="hero">
          <h1>Admin Dashboard</h1>
          <p class="subtitle">
            Här ser du senaste ShipOne-försändelser, live carrier-status, senaste sync och snabblänkar till tracking och JSON-data.
          </p>

          <div class="stats">
            <div class="stat-card">
              <div class="stat-label">Totala shipments på sidan</div>
              <div class="stat-value">${shipmentCount}</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Aktiv carrier just nu</div>
              <div class="stat-value">PostNord</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Syncmotor</div>
              <div class="stat-value">Live</div>
            </div>
          </div>
        </div>

        <div class="table-card">
          <div class="table-header">
            <div>
              <div class="table-title">Senaste shipments</div>
              <div class="table-subtitle">Direkt från PostgreSQL via ShipOne backend</div>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Carrier</th>
                  <th>Status</th>
                  <th>Tracking</th>
                  <th>Carrier-status</th>
                  <th>Events</th>
                  <th>Senast synkad</th>
                  <th>Skapad</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(shipments)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  renderAdminDashboard
};
