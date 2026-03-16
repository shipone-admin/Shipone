const { enrichShipmentsWithHealth } = require("../services/shipmentHealth");

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

function formatHealthLabel(health) {
  const normalized = String(health || "").toLowerCase();

  if (normalized === "ok") return "OK";
  if (normalized === "waiting") return "Väntar";
  if (normalized === "warning") return "Varning";
  if (normalized === "problem") return "Problem";

  return "Alla";
}

function formatShipOneChoice(choice) {
  const normalized = String(choice || "").toUpperCase();

  if (normalized === "FAST") return "Fast";
  if (normalized === "CHEAP") return "Cheap";
  if (normalized === "GREEN") return "Smart";
  if (normalized === "SMART") return "Smart";
  if (normalized === "DHL_TEST") return "DHL Test";

  return choice || "-";
}

function formatMerchantLabel(merchantId) {
  const value = String(merchantId || "").trim();
  return value || "default";
}

function formatShopDomain(shopDomain) {
  const value = String(shopDomain || "").trim();
  return value || "-";
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
  return String(shipment?.health || "").toLowerCase() === "problem";
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

function matchesHealthFilter(shipment, healthFilter) {
  const normalizedFilter = String(healthFilter || "").toLowerCase();

  if (!normalizedFilter) {
    return true;
  }

  return String(shipment?.health || "").toLowerCase() === normalizedFilter;
}

function buildStats(shipments) {
  const list = Array.isArray(shipments) ? shipments : [];

  const total = list.length;
  const completed = list.filter(
    (shipment) => String(shipment.status || "").toLowerCase() === "completed"
  ).length;
  const problems = list.filter((shipment) => shipment.health === "problem").length;
  const waitingForNextSync = list.filter((shipment) => hasUpcomingSync(shipment)).length;
  const merchants = new Set(
    list.map((shipment) => formatMerchantLabel(shipment.merchant_id))
  );

  return {
    total,
    completed,
    problems,
    waitingForNextSync,
    merchantCount: merchants.size
  };
}

function buildMerchantOptions(shipments) {
  const values = Array.from(
    new Set(
      (Array.isArray(shipments) ? shipments : [])
        .map((shipment) => formatMerchantLabel(shipment.merchant_id))
        .filter(Boolean)
    )
  );

  return values.sort((a, b) => a.localeCompare(b, "sv"));
}

function renderHealthPill(shipment) {
  const label = escapeHtml(shipment.healthLabel || "-");
  const reason = escapeHtml(shipment.healthReason || "");
  const className = escapeHtml(shipment.healthClass || "health-neutral");

  return `
    <div class="health-cell">
      <span class="health-pill ${className}" title="${reason}">
        ${label}
      </span>
      <div class="health-reason">${reason}</div>
    </div>
  `;
}

function renderMerchantCell(shipment) {
  const merchantLabel = escapeHtml(formatMerchantLabel(shipment.merchant_id));
  const shopDomain = escapeHtml(formatShopDomain(shipment.shop_domain));

  return `
    <div class="merchant-block">
      <div class="primary">
        <span class="merchant-pill">${merchantLabel}</span>
      </div>
      <div class="secondary">Shop: ${shopDomain}</div>
    </div>
  `;
}

function renderCarrierCell(shipment) {
  const selectedCarrier = formatCarrierName(shipment.selected_carrier);
  const actualCarrier = formatCarrierName(shipment.actual_carrier);
  const selectedService = shipment.selected_service || "-";
  const fallbackUsed = Boolean(shipment.fallback_used);
  const fallbackFrom = shipment.fallback_from
    ? formatCarrierName(shipment.fallback_from)
    : null;

  const sameCarrier =
    String(shipment.selected_carrier || "").toLowerCase() ===
    String(shipment.actual_carrier || "").toLowerCase();

  if (fallbackUsed) {
    return `
      <div class="carrier-block">
        <div class="primary">
          <span class="carrier-pill carrier-pill-selected">Vald: ${escapeHtml(selectedCarrier)}</span>
        </div>
        <div class="secondary">Tjänst: ${escapeHtml(selectedService)}</div>
        <div class="secondary">
          <span class="carrier-pill carrier-pill-actual">Faktisk: ${escapeHtml(actualCarrier)}</span>
        </div>
        <div class="secondary carrier-fallback-text">
          Fallback från ${escapeHtml(fallbackFrom || selectedCarrier)} till ${escapeHtml(actualCarrier)}
        </div>
      </div>
    `;
  }

  if (!sameCarrier && shipment.selected_carrier && shipment.actual_carrier) {
    return `
      <div class="carrier-block">
        <div class="primary">
          <span class="carrier-pill carrier-pill-selected">Vald: ${escapeHtml(selectedCarrier)}</span>
        </div>
        <div class="secondary">Tjänst: ${escapeHtml(selectedService)}</div>
        <div class="secondary">
          <span class="carrier-pill carrier-pill-actual">Faktisk: ${escapeHtml(actualCarrier)}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="carrier-block">
      <div class="primary">
        <span class="carrier-pill">${escapeHtml(actualCarrier)}</span>
      </div>
      <div class="secondary">Tjänst: ${escapeHtml(selectedService)}</div>
    </div>
  `;
}

function renderStrategyCell(shipment) {
  const choice = formatShipOneChoice(shipment.shipone_choice);
  const fallbackUsed = Boolean(shipment.fallback_used);

  return `
    <div class="strategy-block">
      <div class="primary">${escapeHtml(choice)}</div>
      <div class="secondary">
        ${fallbackUsed ? "Fallback använd" : "Ingen fallback"}
      </div>
    </div>
  `;
}

function renderRowActions(shipment, detailsUrl) {
  const orderId = encodeURIComponent(shipment.order_id || "");
  const jsonUrl = `/shipments/${orderId}`;
  const manualSyncUrl = `/admin/shipment/${orderId}/sync`;

  return `
    <div class="row-actions">
      <a
        class="action-link action-link-primary"
        href="${detailsUrl}"
        onclick="event.stopPropagation();"
      >
        Detaljer
      </a>

      <a
        class="action-link"
        href="${jsonUrl}"
        target="_blank"
        rel="noopener noreferrer"
        onclick="event.stopPropagation();"
      >
        JSON
      </a>

      <form
        class="inline-form"
        method="POST"
        action="${manualSyncUrl}"
        onsubmit="event.stopPropagation();"
      >
        <button class="sync-action-button" type="submit">
          Sync
        </button>
      </form>
    </div>
  `;
}

function renderRows(shipments) {
  if (!Array.isArray(shipments) || shipments.length === 0) {
    return `
      <tr>
        <td colspan="14" class="empty-cell">
          Inga shipments hittades för aktuellt filter.
        </td>
      </tr>
    `;
  }

  return shipments
    .map((shipment) => {
      const orderName = escapeHtml(shipment.order_name || "-");
      const orderId = escapeHtml(shipment.order_id || "-");
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
      const eventCount = escapeHtml(String(shipment.carrier_event_count ?? 0));

      return `
        <tr class="clickable-row ${problemRowClass}" onclick="window.location.href='${detailsUrl}'">
          <td>
            <div class="order-block">
              <div class="primary">
                <a class="order-link" href="${detailsUrl}" onclick="event.stopPropagation();">
                  ${orderName}
                </a>
              </div>
              <div class="secondary">Order ID: ${orderId}</div>
            </div>
          </td>

          <td>
            ${renderMerchantCell(shipment)}
          </td>

          <td>
            ${renderHealthPill(shipment)}
          </td>

          <td>
            ${renderStrategyCell(shipment)}
          </td>

          <td>
            ${renderCarrierCell(shipment)}
          </td>

          <td>
            <span class="badge ${statusClass}">${status}</span>
          </td>

          <td>
            <div class="tracking-block">
              <div class="primary mono">${trackingNumber}</div>
              ${
                trackingUrl
                  ? `<div class="secondary"><a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">Öppna tracking</a></div>`
                  : `<div class="secondary">-</div>`
              }
            </div>
          </td>

          <td>
            <div class="status-text">${carrierStatusText}</div>
          </td>

          <td>
            <span class="sync-pill ${syncClass}">${syncStatusText}</span>
          </td>

          <td>
            <div class="event-count">
              ${eventCount}
            </div>
          </td>

          <td>
            <div class="date-block">
              ${syncedAt}
            </div>
          </td>

          <td>
            <div class="date-block">
              ${nextSyncAt}
            </div>
          </td>

          <td>
            <div class="date-block">
              ${createdAt}
            </div>
          </td>

          <td>
            ${renderRowActions(shipment, detailsUrl)}
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
  const enrichedShipments = enrichShipmentsWithHealth(shipments);
  const health = String(filters.health || "").trim().toLowerCase();

  const visibleShipments = enrichedShipments.filter((shipment) =>
    matchesHealthFilter(shipment, health)
  );

  const q = escapeHtml(filters.q || "");
  const status = String(filters.status || "");
  const carrier = String(filters.carrier || "");
  const merchant = String(filters.merchant || "");
  const stats = buildStats(visibleShipments);
  const merchantOptions = buildMerchantOptions(enrichedShipments);

  return `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>ShipOne Admin Dashboard</title>
      <style>
        :root {
          --bg: #f4f7fb;
          --bg-accent: #eef4ff;
          --card: rgba(255, 255, 255, 0.96);
          --card-strong: #ffffff;
          --text: #132238;
          --muted: #6b7a90;
          --line: #e4ebf5;
          --line-strong: #d6e0ee;
          --brand: #2563eb;
          --brand-dark: #1d4ed8;
          --brand-soft: #eff6ff;
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
          --shadow-soft: 0 10px 30px rgba(15, 23, 42, 0.05);
          --shadow-card: 0 18px 50px rgba(15, 23, 42, 0.08);
          --radius-xl: 26px;
          --radius-lg: 20px;
          --radius-md: 16px;
          --radius-sm: 12px;
        }

        * {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top left, #f8fbff 0%, #f4f7fb 42%, #eef3fa 100%);
          color: var(--text);
        }

        body {
          padding: 28px 16px 48px;
        }

        .wrap {
          max-width: 1720px;
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
          gap: 8px;
          text-decoration: none;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid var(--line);
          color: var(--text);
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 14px;
          font-weight: 700;
          box-shadow: var(--shadow-soft);
          transition: transform 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }

        .pill-link:hover {
          transform: translateY(-1px);
          border-color: #cfe0ff;
          color: var(--brand);
        }

        .hero {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,252,255,0.98) 100%);
          border: 1px solid #e8eef7;
          border-radius: 28px;
          box-shadow: var(--shadow-card);
          padding: 30px;
          margin-bottom: 22px;
          position: relative;
          overflow: hidden;
        }

        .hero::before {
          content: "";
          position: absolute;
          right: -60px;
          top: -60px;
          width: 220px;
          height: 220px;
          background: radial-gradient(circle, rgba(37, 99, 235, 0.10) 0%, rgba(37, 99, 235, 0) 72%);
          pointer-events: none;
        }

        h1 {
          margin: 0 0 10px;
          font-size: 40px;
          line-height: 1.05;
          letter-spacing: -0.02em;
        }

        .subtitle {
          margin: 0;
          color: var(--muted);
          font-size: 17px;
          line-height: 1.7;
          max-width: 900px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 16px;
          margin-top: 24px;
        }

        .stat-card {
          background: linear-gradient(180deg, #ffffff 0%, #fcfdff 100%);
          border: 1px solid var(--line);
          border-radius: 20px;
          padding: 18px;
          box-shadow: var(--shadow-soft);
        }

        .stat-card.problem {
          border-color: #fecaca;
          background: linear-gradient(180deg, #fffefe 0%, #fff7f7 100%);
        }

        .stat-card.success {
          border-color: #ccefdc;
          background: linear-gradient(180deg, #fbfffd 0%, #f4fff8 100%);
        }

        .stat-card.waiting {
          border-color: #d7e6ff;
          background: linear-gradient(180deg, #fbfdff 0%, #f4f9ff 100%);
        }

        .stat-card.merchant {
          border-color: #dbeafe;
          background: linear-gradient(180deg, #fbfdff 0%, #f4f8ff 100%);
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
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .filters-card {
          background: var(--card);
          border: 1px solid #e8eef7;
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-card);
          padding: 24px;
          margin-bottom: 22px;
          backdrop-filter: blur(8px);
        }

        .filters-title {
          margin: 0 0 16px;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .filters-form {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr 1.3fr auto auto;
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
          padding: 13px 14px;
          font-size: 14px;
          background: #fff;
          color: var(--text);
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .input:focus,
        .select:focus {
          border-color: #bfd5ff;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
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
          min-height: 48px;
          white-space: nowrap;
          transition: transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease;
        }

        .filter-button:hover,
        .reset-button:hover {
          transform: translateY(-1px);
        }

        .filter-button {
          background: linear-gradient(180deg, #2d6df6 0%, #2563eb 100%);
          color: white;
          box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);
        }

        .reset-button {
          background: #fff;
          color: var(--brand);
          border: 1px solid #cfe0ff;
        }

        .active-filters {
          margin-top: 16px;
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
          border: 1px solid #e8eef7;
          border-radius: 28px;
          box-shadow: var(--shadow-card);
          overflow: hidden;
        }

        .table-header {
          padding: 22px 24px;
          border-bottom: 1px solid var(--line);
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,251,255,0.98) 100%);
        }

        .table-title {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .table-subtitle {
          color: var(--muted);
          font-size: 14px;
          margin-top: 4px;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          min-width: 1940px;
        }

        thead th {
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          background: #f8fbff;
          padding: 16px 18px;
          border-bottom: 1px solid var(--line);
          position: sticky;
          top: 0;
          z-index: 1;
        }

        tbody td {
          padding: 18px;
          border-bottom: 1px solid #edf2f7;
          vertical-align: top;
          font-size: 14px;
          background: rgba(255, 255, 255, 0.88);
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        .clickable-row {
          cursor: pointer;
          transition: background 0.16s ease, transform 0.16s ease;
        }

        .clickable-row:hover td {
          background: #fbfdff;
        }

        .problem-row td {
          background: #fffafa;
        }

        .problem-row:hover td {
          background: #fff4f4;
        }

        .order-block,
        .tracking-block,
        .carrier-block,
        .strategy-block,
        .merchant-block {
          min-width: 0;
        }

        .primary {
          font-weight: 700;
          line-height: 1.5;
        }

        .secondary {
          color: var(--muted);
          font-size: 12px;
          margin-top: 5px;
          line-height: 1.5;
        }

        .order-link {
          color: var(--text);
          text-decoration: none;
          font-weight: 800;
          font-size: 15px;
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

        .secondary a:hover,
        .action-link:hover {
          color: var(--brand-dark);
        }

        .row-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: flex-start;
        }

        .action-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 78px;
          padding: 8px 12px;
          border-radius: 10px;
          background: #f8fbff;
          border: 1px solid #dbeafe;
        }

        .action-link-primary {
          background: #eef4ff;
        }

        .inline-form {
          margin: 0;
          padding: 0;
        }

        .sync-action-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 78px;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid #fde68a;
          background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%);
          color: #ffffff;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(245, 158, 11, 0.18);
        }

        .sync-action-button:hover {
          filter: brightness(0.98);
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

        .merchant-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 800;
          background: #eef4ff;
          color: #1d4ed8;
          border: 1px solid #dbeafe;
          max-width: 100%;
          word-break: break-word;
        }

        .carrier-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 800;
          color: #29415f;
          background: #f3f7fc;
          border: 1px solid #dde7f4;
        }

        .carrier-pill-selected {
          background: #eef4ff;
          border-color: #cfe0ff;
          color: #1d4ed8;
        }

        .carrier-pill-actual {
          background: #ecfdf5;
          border-color: #ccefdc;
          color: #047857;
        }

        .carrier-fallback-text {
          color: #b45309;
          font-weight: 700;
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

        .health-cell {
          min-width: 240px;
          max-width: 280px;
        }

        .health-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 800;
        }

        .health-reason {
          color: var(--muted);
          font-size: 12px;
          line-height: 1.55;
          margin-top: 8px;
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

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 13px;
          letter-spacing: 0.01em;
        }

        .status-text {
          max-width: 260px;
          line-height: 1.55;
          color: var(--text);
        }

        .event-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 38px;
          padding: 8px 10px;
          border-radius: 12px;
          background: #f6f9fd;
          border: 1px solid #e4edf7;
          font-weight: 800;
          color: #29415f;
        }

        .date-block {
          color: var(--text);
          line-height: 1.5;
          white-space: nowrap;
        }

        .empty-cell {
          text-align: center;
          color: var(--muted);
          padding: 34px;
          font-size: 15px;
          background: #fff;
        }

        @media (max-width: 1380px) {
          .stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .filters-form {
            grid-template-columns: 1fr 1fr;
          }

          h1 {
            font-size: 34px;
          }
        }

        @media (max-width: 760px) {
          body {
            padding: 18px 10px 36px;
          }

          .hero,
          .filters-card,
          .table-card {
            border-radius: 22px;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .filters-form {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 30px;
          }

          .subtitle {
            font-size: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="topbar">
          <div class="brand">ShipOne Admin</div>

          <div class="top-links">
            <a class="pill-link" href="/" target="_blank" rel="noopener noreferrer">
              Startsida
            </a>
            <a class="pill-link" href="/shipments" target="_blank" rel="noopener noreferrer">
              Shipments JSON
            </a>
          </div>
        </div>

        <div class="hero">
          <h1>Admin Dashboard</h1>
          <p class="subtitle">
            Här ser du senaste ShipOne-försändelser, live carrier-status, senaste sync och tydliga driftindikatorer för problem, fallback och nästa sync.
          </p>

          <div class="stats">
            <div class="stat-card">
              <div class="stat-label">Matchande shipments</div>
              <div class="stat-value">${stats.total}</div>
            </div>

            <div class="stat-card merchant">
              <div class="stat-label">Merchants</div>
              <div class="stat-value">${stats.merchantCount}</div>
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
                placeholder="Order, order-id, trackingnummer, merchant eller shop"
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

            <div class="field">
              <label for="health">Health</label>
              <select class="select" id="health" name="health">
                <option value="" ${health === "" ? "selected" : ""}>Alla</option>
                <option value="ok" ${health === "ok" ? "selected" : ""}>OK</option>
                <option value="waiting" ${health === "waiting" ? "selected" : ""}>Väntar</option>
                <option value="warning" ${health === "warning" ? "selected" : ""}>Varning</option>
                <option value="problem" ${health === "problem" ? "selected" : ""}>Problem</option>
              </select>
            </div>

            <div class="field">
              <label for="merchant">Merchant</label>
              <select class="select" id="merchant" name="merchant">
                <option value="" ${merchant === "" ? "selected" : ""}>Alla</option>
                ${merchantOptions
                  .map(
                    (option) => `
                      <option value="${escapeHtml(option)}" ${merchant === option ? "selected" : ""}>
                        ${escapeHtml(option)}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </div>

            <button class="filter-button" type="submit">Filtrera</button>
            <a class="reset-button" href="/admin">Rensa</a>
          </form>

          ${
            filters.q || filters.status || filters.carrier || health || filters.merchant
              ? `
                <div class="active-filters">
                  ${filters.q ? `<div class="filter-pill">Sök: ${escapeHtml(filters.q)}</div>` : ""}
                  ${filters.status ? `<div class="filter-pill">Status: ${escapeHtml(formatShipmentStatus(filters.status))}</div>` : ""}
                  ${filters.carrier ? `<div class="filter-pill">Carrier: ${escapeHtml(formatCarrierName(filters.carrier))}</div>` : ""}
                  ${health ? `<div class="filter-pill">Health: ${escapeHtml(formatHealthLabel(health))}</div>` : ""}
                  ${filters.merchant ? `<div class="filter-pill">Merchant: ${escapeHtml(formatMerchantLabel(filters.merchant))}</div>` : ""}
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
                  <th>Merchant</th>
                  <th>Health</th>
                  <th>Strategi</th>
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
                ${renderRows(visibleShipments)}
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
