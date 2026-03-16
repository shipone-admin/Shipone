function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatBoolLabel(value) {
  return value ? "På" : "Av";
}

function getBoolClass(value) {
  return value ? "badge-on" : "badge-off";
}

function formatMerchantStatus(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "active") return "Aktiv";
  if (normalized === "paused") return "Pausad";
  if (normalized === "test") return "Test";

  return status || "-";
}

function formatCarrierName(carrierKey) {
  const normalized = String(carrierKey || "").toLowerCase();

  if (normalized === "postnord") return "PostNord";
  if (normalized === "dhl") return "DHL";
  if (normalized === "budbee") return "Budbee";

  return carrierKey || "-";
}

function renderFlashMessage(message, type = "success") {
  if (!message) {
    return "";
  }

  const className =
    type === "error" ? "flash flash-error" : "flash flash-success";

  return `
    <div class="${className}">
      ${escapeHtml(message)}
    </div>
  `;
}

function renderRows(rows, token) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return `
      <tr>
        <td colspan="8" class="empty-cell">Inga carrier settings hittades.</td>
      </tr>
    `;
  }

  return rows
    .map((row) => {
      return `
        <tr>
          <td>
            <div class="cell-primary mono">${escapeHtml(row.merchant_id)}</div>
            <div class="cell-secondary">${escapeHtml(row.merchant_name || "-")}</div>
          </td>
          <td>${escapeHtml(formatMerchantStatus(row.merchant_status))}</td>
          <td>${escapeHtml(formatCarrierName(row.carrier_key))}</td>
          <td><span class="badge ${getBoolClass(row.shipments_enabled)}">${formatBoolLabel(row.shipments_enabled)}</span></td>
          <td><span class="badge ${getBoolClass(row.rates_enabled)}">${formatBoolLabel(row.rates_enabled)}</span></td>
          <td><span class="badge ${getBoolClass(row.tracking_enabled)}">${formatBoolLabel(row.tracking_enabled)}</span></td>
          <td>
            <form method="POST" action="/admin/merchant-carriers/upsert" class="inline-form">
              <input type="hidden" name="token" value="${escapeHtml(token)}" />
              <input type="hidden" name="merchant_id" value="${escapeHtml(row.merchant_id)}" />
              <input type="hidden" name="carrier_key" value="${escapeHtml(row.carrier_key)}" />

              <div class="inline-grid">
                <select name="shipments_enabled" class="mini-select">
                  <option value="true" ${row.shipments_enabled ? "selected" : ""}>Shipments på</option>
                  <option value="false" ${!row.shipments_enabled ? "selected" : ""}>Shipments av</option>
                </select>

                <select name="rates_enabled" class="mini-select">
                  <option value="true" ${row.rates_enabled ? "selected" : ""}>Rates på</option>
                  <option value="false" ${!row.rates_enabled ? "selected" : ""}>Rates av</option>
                </select>

                <select name="tracking_enabled" class="mini-select">
                  <option value="true" ${row.tracking_enabled ? "selected" : ""}>Tracking på</option>
                  <option value="false" ${!row.tracking_enabled ? "selected" : ""}>Tracking av</option>
                </select>
              </div>
          </td>
          <td>
              <button type="submit" class="save-button">Spara</button>
            </form>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderAdminMerchantCarrierSettingsPage({
  rows = [],
  token = "",
  flashMessage = "",
  flashType = "success"
} = {}) {
  return `
    <!DOCTYPE html>
    <html lang="sv">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ShipOne Merchant Carrier Settings</title>
        <style>
          :root {
            --bg: #f4f7fb;
            --card: #ffffff;
            --text: #132238;
            --muted: #6b7a90;
            --line: #e4ebf5;
            --brand: #2563eb;
            --success-bg: #ecfdf5;
            --success-text: #047857;
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
            background: radial-gradient(circle at top left, #f8fbff 0%, #f4f7fb 42%, #eef3fa 100%);
            color: var(--text);
          }

          body {
            padding: 28px 16px 48px;
          }

          .wrap {
            max-width: 1700px;
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
            border: 1px solid #e8eef7;
            border-radius: 28px;
            box-shadow: var(--shadow);
            padding: 30px;
            margin-bottom: 22px;
          }

          h1 {
            margin: 0 0 10px;
            font-size: 38px;
            line-height: 1.05;
          }

          .subtitle {
            margin: 0;
            color: var(--muted);
            font-size: 17px;
            line-height: 1.7;
            max-width: 980px;
          }

          .flash {
            margin-top: 18px;
            border-radius: 16px;
            padding: 14px 16px;
            font-size: 14px;
            font-weight: 700;
          }

          .flash-success {
            background: var(--success-bg);
            color: var(--success-text);
            border: 1px solid #bbf7d0;
          }

          .flash-error {
            background: var(--danger-bg);
            color: var(--danger-text);
            border: 1px solid #fecaca;
          }

          .table-card {
            background: var(--card);
            border: 1px solid #e8eef7;
            border-radius: 28px;
            box-shadow: var(--shadow);
            overflow: hidden;
          }

          .table-header {
            padding: 22px 24px;
            border-bottom: 1px solid var(--line);
            background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,251,255,0.98) 100%);
          }

          .table-title {
            font-size: 20px;
            font-weight: 800;
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
            min-width: 1450px;
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
          }

          tbody td {
            padding: 16px 18px;
            border-bottom: 1px solid #edf2f7;
            vertical-align: top;
            font-size: 14px;
            background: rgba(255, 255, 255, 0.88);
          }

          tbody tr:last-child td {
            border-bottom: none;
          }

          .badge {
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 800;
          }

          .badge-on {
            background: #ecfdf5;
            color: #047857;
          }

          .badge-off {
            background: #f8fafc;
            color: #475569;
          }

          .cell-primary {
            font-weight: 700;
          }

          .cell-secondary {
            color: var(--muted);
            font-size: 12px;
            margin-top: 4px;
          }

          .mono {
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 13px;
          }

          .inline-form {
            margin: 0;
          }

          .inline-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
          }

          .mini-select {
            width: 100%;
            border: 1px solid #dbe3ee;
            border-radius: 10px;
            padding: 10px 12px;
            font-size: 13px;
            background: #fff;
          }

          .save-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            padding: 10px 14px;
            font-size: 13px;
            font-weight: 700;
            border: none;
            cursor: pointer;
            background: linear-gradient(180deg, #2d6df6 0%, #2563eb 100%);
            color: #fff;
          }

          .empty-cell {
            text-align: center;
            color: var(--muted);
            padding: 34px;
            font-size: 15px;
            background: #fff;
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="topbar">
            <div class="brand">ShipOne Merchant Carrier Settings</div>

            <div class="top-links">
              <a class="pill-link" href="/admin">Admin Dashboard</a>
              <a class="pill-link" href="/admin/merchants?token=${escapeHtml(token)}">Merchant Admin</a>
              <a class="pill-link" href="/" target="_blank" rel="noopener noreferrer">Startsida</a>
            </div>
          </div>

          <div class="hero">
            <h1>Per-merchant carrier settings</h1>
            <p class="subtitle">
              Här definierar du vilka carriers som ska vara på eller av per merchant. I detta steg sparas bara inställningarna. Shipmentflödet påverkas ännu inte förrän steg 2 kopplar in reglerna live.
            </p>
            ${renderFlashMessage(flashMessage, flashType)}
          </div>

          <div class="table-card">
            <div class="table-header">
              <div class="table-title">Carrier-matris per merchant</div>
              <div class="table-subtitle">Shipments, rates och tracking kan förberedas separat för varje merchant och carrier</div>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Merchant</th>
                    <th>Merchant status</th>
                    <th>Carrier</th>
                    <th>Shipments</th>
                    <th>Rates</th>
                    <th>Tracking</th>
                    <th>Ändra</th>
                    <th>Spara</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderRows(rows, token)}
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
  renderAdminMerchantCarrierSettingsPage
};
