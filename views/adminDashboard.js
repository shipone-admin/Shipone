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

function formatSyncStatus(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "success") return "OK";
  if (normalized === "failed") return "Fel";

  return "-";
}

function getStatusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "completed") return "badge-completed";
  if (normalized === "processing") return "badge-processing";
  if (normalized === "failed") return "badge-failed";

  return "badge-neutral";
}

function getSyncClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "success") return "sync-ok";
  if (normalized === "failed") return "sync-failed";

  return "sync-neutral";
}

function isProblemShipment(shipment) {
  const shipmentStatus = String(shipment?.status || "").toLowerCase();
  const syncStatus = String(shipment?.carrier_last_sync_status || "").toLowerCase();

  return shipmentStatus === "failed" || syncStatus === "failed";
}

function hasUpcomingSync(shipment) {
  if (!shipment?.carrier_next_sync_at) {
    return false;
  }

  const nextSyncDate = new Date(shipment.carrier_next_sync_at);

  if (Number.isNaN(nextSyncDate.getTime())) {
    return false;
  }

  return nextSyncDate.getTime() > Date.now();
}

function buildStats(shipments) {
  const list = Array.isArray(shipments) ? shipments : [];

  const total = list.length;
  const completed = list.filter(
    (shipment) => String(shipment.status || "").toLowerCase() === "completed"
  ).length;
  const problems = list.filter((shipment) => isProblemShipment(shipment)).length;
  const waitingForNextSync = list.filter((shipment) => hasUpcomingSync(shipment)).length;

  return {
    total,
    completed,
    problems,
    waitingForNextSync
  };
}

function renderRows(shipments) {
  if (!Array.isArray(shipments) || shipments.length === 0) {
    return `
      <tr>
        <td colspan="10" class="empty-cell">Inga shipments hittades för aktuellt filter.</td>
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
      const detailsUrl = `/admin/shipment/${encodeURIComponent(
        shipment.order_id
      )}`;
      const carrierStatusText = escapeHtml(shipment.carrier_status_text || "-");
      const syncedAt = escapeHtml(formatDateSv(shipment.carrier_last_synced_at));
      const nextSyncAt = escapeHtml(formatDateSv(shipment.carrier_next_sync_at));
      const createdAt = escapeHtml(formatDateSv(shipment.created_at));
      const statusClass = getStatusClass(shipment.status);
      const syncClass = getSyncClass(shipment.carrier_last_sync_status);
      const syncStatusText = escapeHtml(
        formatSyncStatus(shipment.carrier_last_sync_status)
      );
      const problemRowClass = isProblemShipment(shipment) ? "problem-row" : "";

      return `
        <tr class="clickable-row ${problemRowClass}" onclick="window.location.href='${detailsUrl}'">
          <td>
            <div class="primary">
              <a class="order-link" href="${detailsUrl}" onclick="event.stopPropagation();">
                ${orderName}
              </a>
            </div>
            <div class="secondary">${orderId}</div>
          </td>
          <td>${carrier}</td>
          <td><span class="badge ${statusClass}">${status}</span></td>
          <td>
            <div class="primary mono">${trackingNumber}</div>
            ${
              trackingUrl
                ? `<div class="secondary"><a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">Öppna tracking</a></div>`
                : `<div class="secondary">-</div>`
            }
          </td>
          <td>${carrierStatusText}</td>
          <td><span class="sync-pill ${syncClass}">${syncStatusText}</span></td>
          <td>${escapeHtml(String(shipment.carrier_event_count ?? 0))}</td>
          <td>${syncedAt}</td>
          <td>${nextSyncAt}</td>
          <td>${createdAt}</td>
          <td>
            <div class="row-actions">
              <a class="action-link" href="${detailsUrl}" onclick="event.stopPropagation();">
                Detaljer
              </a>
              <a class="action-link" href="/shipments/${encodeURIComponent(
                shipment.order_id
              )}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">
                JSON
              </a>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderAdminDashboard({
  shipments = [],
  filters = {}
} = {}) {
  const shipmentCount = Array.isArray(shipments) ? shipments.length : 0;
  const q = escapeHtml(filters.q || "");
  const status = String(filters.status || "");
  const carrier = String(filters.carrier || "");
  const stats = buildStats(shipments);

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
          max-width: 1480px;
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-top: 22px;
        }

        .stat-card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 18px;
        }

        .stat-card.problem {
          border-color: #fecaca;
          background: #fffafa;
        }

        .stat-card.success {
          border-color: #bbf7d0;
          background: #f8fffb;
        }

        .stat-card.waiting {
          border-color: #dbeafe;
          background: #f8fbff;
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

        .filters-card {
          background: var(--card);
          border: 1px solid #ebf0f6;
          border-radius: 24px;
          box-shadow: var(--shadow);
          padding: 22px;
          margin-bottom: 20px;
        }

        .filters-title {
          margin: 0 0 16px;
          font-size: 20px;
          font-weight: 800;
        }

        .filters-form {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr auto auto;
          gap: 12px;
          align-items: end;
        }

        .field {
          display: grid;
          gap: 8px;
        }

        .field label {
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .input,
        .select {
          width: 100%;
          border: 1px solid #dbe3ee;
          border-radius: 14px;
          padding: 12px 14px;
          font-size: 14px;
          background: #fff;
          color: var(--text);
        }

        .filter-button,
        .reset-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          border: none;
          cursor: pointer;
          min-height: 46px;
        }

        .filter-button {
          background: var(--brand);
          color: white;
        }

        .reset-button {
          background: #fff;
          color: var(--brand);
          border: 1px solid #cfe0ff;
        }

        .active-filters {
          margin-top: 14px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .filter-pill {
          display: inline-flex;
          align-items: center;
          background: #eef4ff;
          color: var(--brand-dark);
          border: 1px solid #dbeafe;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 700;
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
          min-width: 1320px;
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

        .clickable-row {
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .clickable-row:hover {
          background: #fbfdff;
        }

        .problem-row {
          background: #fffafa;
        }

        .problem-row:hover {
          background: #fff1f2;
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

        .order-link {
          color: var(--text);
          text-decoration: none;
          font-weight: 800;
        }

        .order-link:hover {
          color: var(--brand);
        }

        .secondary a,
        .action-link {
          color: var(--brand);
          text-decoration: none;
          font-weight: 700;
        }

        .row-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
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

        .sync-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 800;
        }

        .sync-ok {
          background: var(--success-bg);
          color: var(--success-text);
        }

        .sync-failed {
          background: var(--danger-bg);
          color: var(--danger-text);
        }

        .sync-neutral {
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

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: 1fr 1fr;
          }

          .filters-form {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 32px;
          }
        }

        @media (max-width: 700px) {
          .stats {
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
            <a class="pill-link" href="/" target="_blank" rel="noopener noreferrer">Startsida</a>
            <a class="pill-link" href="/shipments" target="_blank" rel="noopener noreferrer">Shipments JSON</a>
          </div>
        </div>

        <div class="hero">
          <h1>Admin Dashboard</h1>
          <p class="subtitle">
            Här ser du senaste ShipOne-försändelser, live carrier-status, senaste sync och tydliga driftindikatorer för problem och nästa sync.
          </p>

          <div class="stats">
            <div class="stat-card">
              <div class="stat-label">Matchande shipments</div>
              <div class="stat-value">${stats.total}</div>
            </div>

            <div class="stat-card success">
              <div class="stat-label">Slutförda</div>
              <div class="stat-value">${stats.completed}</div>
            </div>

            <div class="stat-card problem">
              <div class="stat-label">Problem</div>
              <div class="stat-value">${stats.problems}</div>
            </div>

            <div class="stat-card waiting">
              <div class="stat-label">Väntar på nästa sync</div>
              <div class="stat-value">${stats.waitingForNextSync}</div>
            </div>
          </div>
        </div>

        <div class="filters-card">
          <h2 class="filters-title">Filter och sökning</h2>

          <form class="filters-form" method="GET" action="/admin">
            <div class="field">
              <label for="q">Sök</label>
              <input
                class="input"
                id="q"
                name="q"
                type="text"
                value="${q}"
                placeholder="Order, order-id eller trackingnummer"
              />
            </div>

            <div class="field">
              <label for="status">Status</label>
              <select class="select" id="status" name="status">
                <option value="" ${status === "" ? "selected" : ""}>Alla</option>
                <option value="completed" ${status === "completed" ? "selected" : ""}>Slutförd</option>
                <option value="processing" ${status === "processing" ? "selected" : ""}>Behandlas</option>
                <option value="failed" ${status === "failed" ? "selected" : ""}>Misslyckad</option>
              </select>
            </div>

            <div class="field">
              <label for="carrier">Carrier</label>
              <select class="select" id="carrier" name="carrier">
                <option value="" ${carrier === "" ? "selected" : ""}>Alla</option>
                <option value="postnord" ${carrier === "postnord" ? "selected" : ""}>PostNord</option>
                <option value="dhl" ${carrier === "dhl" ? "selected" : ""}>DHL</option>
                <option value="budbee" ${carrier === "budbee" ? "selected" : ""}>Budbee</option>
              </select>
            </div>

            <button class="filter-button" type="submit">Filtrera</button>
            <a class="reset-button" href="/admin">Rensa</a>
          </form>

          ${
            filters.q || filters.status || filters.carrier
              ? `
                <div class="active-filters">
                  ${filters.q ? `<div class="filter-pill">Sök: ${escapeHtml(filters.q)}</div>` : ""}
                  ${filters.status ? `<div class="filter-pill">Status: ${escapeHtml(formatShipmentStatus(filters.status))}</div>` : ""}
                  ${filters.carrier ? `<div class="filter-pill">Carrier: ${escapeHtml(formatCarrierName(filters.carrier))}</div>` : ""}
                </div>
              `
              : ""
          }
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
                  <th>Sync-status</th>
                  <th>Events</th>
                  <th>Senast synkad</th>
                  <th>Nästa sync</th>
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
