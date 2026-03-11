const { enrichShipmentsWithHealth } = require("../services/shipmentHealth");

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
  });
}

function formatRelativeNextSync(value) {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes === 0) return "Nu";

  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 60) {
    return diffMinutes > 0 ? `Om ${absMinutes} min` : `${absMinutes} min sen`;
  }

  const absHours = Math.round(absMinutes / 60);

  if (absHours < 24) {
    return diffMinutes > 0 ? `Om ${absHours} h` : `${absHours} h sen`;
  }

  const absDays = Math.round(absHours / 24);

  return diffMinutes > 0 ? `Om ${absDays} d` : `${absDays} d sen`;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getSyncBadge(syncStatus) {
  const value = normalizeText(syncStatus);

  if (value === "ok" || value === "success" || value === "synced") {
    return {
      label: "OK",
      className: "badge badge-ok",
    };
  }

  if (value === "pending" || value === "queued") {
    return {
      label: "Pending",
      className: "badge badge-waiting",
    };
  }

  if (value === "error" || value === "failed" || value === "failure") {
    return {
      label: "Fel",
      className: "badge badge-problem",
    };
  }

  return {
    label: syncStatus || "—",
    className: "badge badge-neutral",
  };
}

function getHealthBadgeHtml(shipment) {
  const label = escapeHtml(shipment.healthLabel || "—");
  const className = escapeHtml(
    shipment.health === "ok"
      ? "badge badge-ok"
      : shipment.health === "waiting"
      ? "badge badge-waiting"
      : shipment.health === "warning"
      ? "badge badge-warning"
      : shipment.health === "problem"
      ? "badge badge-problem"
      : "badge badge-neutral"
  );

  const title = escapeHtml(shipment.healthReason || "");

  return `<span class="${className}" title="${title}">${label}</span>`;
}

function buildStats(shipments) {
  const total = shipments.length;

  const fulfilled = shipments.filter((shipment) => {
    const status = normalizeText(
      shipment.shopify_fulfillment_status ||
        shipment.fulfillment_status ||
        shipment.status
    );

    return ["fulfilled", "success", "done", "complete", "completed"].includes(status);
  }).length;

  const problems = shipments.filter((shipment) => shipment.health === "problem").length;

  const waitingNextSync = shipments.filter((shipment) => {
    const nextSyncAt = shipment.carrier_next_sync_at || shipment.next_sync_at;
    if (!nextSyncAt) return false;

    const nextDate = nextSyncAt instanceof Date ? nextSyncAt : new Date(nextSyncAt);
    if (Number.isNaN(nextDate.getTime())) return false;

    return nextDate.getTime() > Date.now();
  }).length;

  return {
    total,
    fulfilled,
    problems,
    waitingNextSync,
  };
}

function renderRow(shipment) {
  const orderId = escapeHtml(shipment.order_id || shipment.orderId || "");
  const orderName = escapeHtml(shipment.order_name || shipment.orderName || "—");
  const trackingNumber = escapeHtml(shipment.tracking_number || "—");
  const carrier = escapeHtml(shipment.carrier || "—");
  const carrierStatusText = escapeHtml(shipment.carrier_status_text || "—");

  const syncStatusValue =
    shipment.carrier_last_sync_status ||
    shipment.sync_status ||
    shipment.carrier_sync_status ||
    "";

  const syncBadge = getSyncBadge(syncStatusValue);

  const lastSynced =
    shipment.carrier_last_synced_at ||
    shipment.last_synced_at ||
    shipment.synced_at ||
    null;

  const nextSync =
    shipment.carrier_next_sync_at ||
    shipment.next_sync_at ||
    null;

  return `
    <tr>
      <td>
        <a class="order-link" href="/admin/shipment/${encodeURIComponent(orderId)}">
          ${orderName}
        </a>
        <div class="subtle">Order ID: ${orderId || "—"}</div>
      </td>
      <td>${getHealthBadgeHtml(shipment)}</td>
      <td><span class="${escapeHtml(syncBadge.className)}">${escapeHtml(syncBadge.label)}</span></td>
      <td>${carrier}</td>
      <td class="mono">${trackingNumber}</td>
      <td>${carrierStatusText}</td>
      <td>${escapeHtml(formatDateTime(lastSynced))}</td>
      <td>${escapeHtml(formatRelativeNextSync(nextSync))}</td>
    </tr>
  `;
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <h3>Inga shipments hittades</h3>
      <p>Justera sökning eller filter, eller invänta att nya shipments skapas.</p>
    </div>
  `;
}

function renderTable(shipments) {
  if (!shipments.length) {
    return renderEmptyState();
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Health</th>
            <th>Sync-status</th>
            <th>Carrier</th>
            <th>Trackingnummer</th>
            <th>Carrier-status</th>
            <th>Senast synkad</th>
            <th>Nästa sync</th>
          </tr>
        </thead>
        <tbody>
          ${shipments.map(renderRow).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderFilterInfo({ query, filter, shipments }) {
  const parts = [];

  if (query) {
    parts.push(`Sökning: <strong>${escapeHtml(query)}</strong>`);
  }

  if (filter && filter !== "all") {
    parts.push(`Filter: <strong>${escapeHtml(filter)}</strong>`);
  }

  parts.push(`Visar <strong>${shipments.length}</strong> shipment(s)`);

  return `
    <div class="toolbar-meta">
      ${parts.join(" · ")}
    </div>
  `;
}

function applyFilter(shipments, filter) {
  const normalizedFilter = normalizeText(filter || "all");

  if (!normalizedFilter || normalizedFilter === "all") {
    return shipments;
  }

  if (normalizedFilter === "problem") {
    return shipments.filter((shipment) => shipment.health === "problem");
  }

  if (normalizedFilter === "warning") {
    return shipments.filter((shipment) => shipment.health === "warning");
  }

  if (normalizedFilter === "waiting") {
    return shipments.filter((shipment) => shipment.health === "waiting");
  }

  if (normalizedFilter === "ok") {
    return shipments.filter((shipment) => shipment.health === "ok");
  }

  return shipments;
}

function applySearch(shipments, query) {
  const q = normalizeText(query);

  if (!q) return shipments;

  return shipments.filter((shipment) => {
    return [
      shipment.order_id,
      shipment.order_name,
      shipment.tracking_number,
      shipment.carrier,
      shipment.carrier_status_text,
      shipment.healthLabel,
      shipment.healthReason,
    ]
      .map((value) => normalizeText(value))
      .some((value) => value.includes(q));
  });
}

function renderAdminDashboard(data = {}) {
  const inputShipments = Array.isArray(data.shipments) ? data.shipments : [];
  const query = data.query || data.search || "";
  const filter = data.filter || "all";

  const shipmentsWithHealth = enrichShipmentsWithHealth(inputShipments);
  const filteredShipments = applyFilter(
    applySearch(shipmentsWithHealth, query),
    filter
  );

  const stats = buildStats(shipmentsWithHealth);

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>ShipOne Admin</title>
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
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .title-wrap h1 {
      margin: 0 0 6px;
      font-size: 32px;
    }

    .title-wrap p {
      margin: 0;
      color: var(--muted);
    }

    .top-actions a {
      display: inline-block;
      text-decoration: none;
      color: white;
      background: var(--blue);
      padding: 10px 14px;
      border-radius: 10px;
      font-weight: 700;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
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

    .card-label {
      color: var(--muted);
      font-size: 14px;
      margin-bottom: 8px;
    }

    .card-value {
      font-size: 30px;
      font-weight: 800;
    }

    .toolbar {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 16px;
      box-shadow: var(--shadow);
      margin-bottom: 16px;
    }

    .toolbar form {
      display: grid;
      grid-template-columns: 1.5fr 220px 140px;
      gap: 12px;
    }

    .toolbar input,
    .toolbar select,
    .toolbar button {
      width: 100%;
      min-height: 42px;
      border-radius: 10px;
      border: 1px solid #cbd5e1;
      padding: 0 12px;
      font-size: 14px;
    }

    .toolbar button {
      background: var(--blue);
      border: none;
      color: white;
      font-weight: 700;
      cursor: pointer;
    }

    .toolbar-meta {
      margin-top: 12px;
      color: var(--muted);
      font-size: 14px;
    }

    .table-wrap {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      box-shadow: var(--shadow);
      overflow: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 1100px;
    }

    th,
    td {
      text-align: left;
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
      font-size: 14px;
    }

    th {
      color: var(--muted);
      font-size: 13px;
      background: #f8fafc;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    tr:hover td {
      background: #f8fbff;
    }

    .order-link {
      color: var(--blue);
      text-decoration: none;
      font-weight: 700;
    }

    .order-link:hover {
      text-decoration: underline;
    }

    .subtle {
      color: var(--muted);
      margin-top: 6px;
      font-size: 12px;
    }

    .mono {
      font-family: Consolas, Monaco, monospace;
      font-size: 13px;
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

    .empty-state {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      box-shadow: var(--shadow);
      padding: 40px 24px;
      text-align: center;
    }

    .empty-state h3 {
      margin-top: 0;
      margin-bottom: 8px;
    }

    .empty-state p {
      margin: 0;
      color: var(--muted);
    }

    @media (max-width: 1100px) {
      .cards {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .toolbar form {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 700px) {
      .container {
        padding: 16px;
      }

      .cards {
        grid-template-columns: 1fr;
      }

      .title-wrap h1 {
        font-size: 26px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="topbar">
      <div class="title-wrap">
        <h1>ShipOne Admin</h1>
        <p>Översikt över shipments, tracking och sync-hälsa.</p>
      </div>
      <div class="top-actions">
        <a href="/">Till startsidan</a>
      </div>
    </div>

    <div class="cards">
      <div class="card">
        <div class="card-label">Matchande shipments</div>
        <div class="card-value">${escapeHtml(String(stats.total))}</div>
      </div>
      <div class="card">
        <div class="card-label">Slutförda</div>
        <div class="card-value">${escapeHtml(String(stats.fulfilled))}</div>
      </div>
      <div class="card">
        <div class="card-label">Problem</div>
        <div class="card-value">${escapeHtml(String(stats.problems))}</div>
      </div>
      <div class="card">
        <div class="card-label">Väntar på nästa sync</div>
        <div class="card-value">${escapeHtml(String(stats.waitingNextSync))}</div>
      </div>
    </div>

    <div class="toolbar">
      <form method="GET" action="/admin">
        <input
          type="text"
          name="query"
          placeholder="Sök order, trackingnummer, carrier, status..."
          value="${escapeHtml(query)}"
        />
        <select name="filter">
          <option value="all"${filter === "all" ? " selected" : ""}>Alla</option>
          <option value="ok"${filter === "ok" ? " selected" : ""}>Endast OK</option>
          <option value="waiting"${filter === "waiting" ? " selected" : ""}>Endast Väntar</option>
          <option value="warning"${filter === "warning" ? " selected" : ""}>Endast Varning</option>
          <option value="problem"${filter === "problem" ? " selected" : ""}>Endast Problem</option>
        </select>
        <button type="submit">Filtrera</button>
      </form>

      ${renderFilterInfo({
        query,
        filter,
        shipments: filteredShipments,
      })}
    </div>

    ${renderTable(filteredShipments)}
  </div>
</body>
</html>`;
}

module.exports = {
  renderAdminDashboard,
  default: renderAdminDashboard,
};
