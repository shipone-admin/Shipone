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

function formatMerchantStatus(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "active") return "Aktiv";
  if (normalized === "paused") return "Pausad";
  if (normalized === "test") return "Test";

  return status || "-";
}

function getMerchantStatusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "active") return "badge-success";
  if (normalized === "paused") return "badge-warning";
  if (normalized === "test") return "badge-info";

  return "badge-neutral";
}

function formatStoreActive(isActive) {
  return isActive ? "Aktiv" : "Inaktiv";
}

function getStoreActiveClass(isActive) {
  return isActive ? "badge-success" : "badge-neutral";
}

function renderMerchantRows(merchants) {
  if (!Array.isArray(merchants) || merchants.length === 0) {
    return `
      <tr>
        <td colspan="6" class="empty-cell">Inga merchants hittades.</td>
      </tr>
    `;
  }

  return merchants
    .map((merchant) => {
      return `
        <tr>
          <td><span class="mono">${escapeHtml(merchant.id)}</span></td>
          <td>${escapeHtml(merchant.name)}</td>
          <td>
            <span class="badge ${getMerchantStatusClass(merchant.status)}">
              ${escapeHtml(formatMerchantStatus(merchant.status))}
            </span>
          </td>
          <td>${escapeHtml(String(merchant.store_count ?? 0))}</td>
          <td>${escapeHtml(formatDateSv(merchant.created_at))}</td>
          <td>${escapeHtml(formatDateSv(merchant.updated_at))}</td>
        </tr>
      `;
    })
    .join("");
}

function renderStoreRows(stores) {
  if (!Array.isArray(stores) || stores.length === 0) {
    return `
      <tr>
        <td colspan="7" class="empty-cell">Inga Shopify stores hittades.</td>
      </tr>
    `;
  }

  return stores
    .map((store) => {
      return `
        <tr>
          <td><span class="mono">${escapeHtml(store.shop_domain)}</span></td>
          <td><span class="mono">${escapeHtml(store.merchant_id)}</span></td>
          <td>${escapeHtml(store.merchant_name || "-")}</td>
          <td>
            <span class="badge ${getMerchantStatusClass(store.merchant_status)}">
              ${escapeHtml(formatMerchantStatus(store.merchant_status))}
            </span>
          </td>
          <td>
            <span class="badge ${getStoreActiveClass(store.is_active)}">
              ${escapeHtml(formatStoreActive(store.is_active))}
            </span>
          </td>
          <td>${escapeHtml(formatDateSv(store.created_at))}</td>
          <td>${escapeHtml(formatDateSv(store.updated_at))}</td>
        </tr>
      `;
    })
    .join("");
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

function renderAdminMerchantsPage({
  merchants = [],
  stores = [],
  flashMessage = "",
  flashType = "success"
} = {}) {
  return `
    <!DOCTYPE html>
    <html lang="sv">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ShipOne Merchant Admin</title>
        <style>
          :root {
            --bg: #f4f7fb;
            --card: #ffffff;
            --text: #132238;
            --muted: #6b7a90;
            --line: #e4ebf5;
            --brand: #2563eb;
            --brand-dark: #1d4ed8;
            --success-bg: #ecfdf5;
            --success-text: #047857;
            --warning-bg: #fff7ed;
            --warning-text: #b45309;
            --danger-bg: #fef2f2;
            --danger-text: #b91c1c;
            --info-bg: #eff6ff;
            --info-text: #1d4ed8;
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
            max-width: 1540px;
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
            max-width: 880px;
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

          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 22px;
          }

          .card {
            background: var(--card);
            border: 1px solid #e8eef7;
            border-radius: 24px;
            box-shadow: var(--shadow);
            padding: 24px;
          }

          .card-title {
            margin: 0 0 18px;
            font-size: 20px;
            font-weight: 800;
          }

          .form-grid {
            display: grid;
            gap: 14px;
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
          }

          .submit-button {
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
            background: linear-gradient(180deg, #2d6df6 0%, #2563eb 100%);
            color: white;
          }

          .table-card {
            background: var(--card);
            border: 1px solid #e8eef7;
            border-radius: 28px;
            box-shadow: var(--shadow);
            overflow: hidden;
            margin-bottom: 22px;
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
            min-width: 980px;
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

          .badge-success {
            background: var(--success-bg);
            color: var(--success-text);
          }

          .badge-warning {
            background: var(--warning-bg);
            color: var(--warning-text);
          }

          .badge-info {
            background: var(--info-bg);
            color: var(--info-text);
          }

          .badge-neutral {
            background: var(--neutral-bg);
            color: var(--neutral-text);
          }

          .mono {
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 13px;
          }

          .empty-cell {
            text-align: center;
            color: var(--muted);
            padding: 34px;
            font-size: 15px;
            background: #fff;
          }

          @media (max-width: 980px) {
            .grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 760px) {
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
            <div class="brand">ShipOne Merchant Admin</div>

            <div class="top-links">
              <a class="pill-link" href="/admin">Admin Dashboard</a>
              <a class="pill-link" href="/" target="_blank" rel="noopener noreferrer">Startsida</a>
              <a class="pill-link" href="/shipments" target="_blank" rel="noopener noreferrer">Shipments JSON</a>
            </div>
          </div>

          <div class="hero">
            <h1>Merchant Admin</h1>
            <p class="subtitle">
              Här hanterar du ShipOne merchants och kopplingar mellan Shopify-butiker och merchants. Detta är den interna grunden för multi-tenant-plattformen.
            </p>
            ${renderFlashMessage(flashMessage, flashType)}
          </div>

          <div class="grid">
            <div class="card">
              <h2 class="card-title">Skapa eller uppdatera merchant</h2>

              <form class="form-grid" method="POST" action="/admin/merchants/upsert">
                <div class="field">
                  <label for="merchant-id">Merchant ID</label>
                  <input
                    class="input"
                    id="merchant-id"
                    name="id"
                    type="text"
                    placeholder="shipone-test-2"
                    required
                  />
                </div>

                <div class="field">
                  <label for="merchant-name">Namn</label>
                  <input
                    class="input"
                    id="merchant-name"
                    name="name"
                    type="text"
                    placeholder="ShipOne Test 2"
                    required
                  />
                </div>

                <div class="field">
                  <label for="merchant-status">Status</label>
                  <select class="select" id="merchant-status" name="status">
                    <option value="active">Aktiv</option>
                    <option value="paused">Pausad</option>
                    <option value="test">Test</option>
                  </select>
                </div>

                <button class="submit-button" type="submit">
                  Spara merchant
                </button>
              </form>
            </div>

            <div class="card">
              <h2 class="card-title">Koppla Shopify store till merchant</h2>

              <form class="form-grid" method="POST" action="/admin/merchants/store/upsert">
                <div class="field">
                  <label for="store-shop-domain">Shop domain</label>
                  <input
                    class="input"
                    id="store-shop-domain"
                    name="shop_domain"
                    type="text"
                    placeholder="shipone-test-2.myshopify.com"
                    required
                  />
                </div>

                <div class="field">
                  <label for="store-merchant-id">Merchant ID</label>
                  <input
                    class="input"
                    id="store-merchant-id"
                    name="merchant_id"
                    type="text"
                    placeholder="shipone-test-2"
                    required
                  />
                </div>

                <div class="field">
                  <label for="store-merchant-name">Merchant namn (om ny merchant)</label>
                  <input
                    class="input"
                    id="store-merchant-name"
                    name="merchant_name"
                    type="text"
                    placeholder="ShipOne Test 2"
                  />
                </div>

                <div class="field">
                  <label for="store-merchant-status">Merchant status</label>
                  <select class="select" id="store-merchant-status" name="merchant_status">
                    <option value="active">Aktiv</option>
                    <option value="paused">Pausad</option>
                    <option value="test">Test</option>
                  </select>
                </div>

                <div class="field">
                  <label for="store-is-active">Store aktiv</label>
                  <select class="select" id="store-is-active" name="is_active">
                    <option value="true">Ja</option>
                    <option value="false">Nej</option>
                  </select>
                </div>

                <button class="submit-button" type="submit">
                  Spara store-koppling
                </button>
              </form>
            </div>
          </div>

          <div class="table-card">
            <div class="table-header">
              <div class="table-title">Merchants</div>
              <div class="table-subtitle">Alla merchants som finns registrerade i ShipOne</div>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Merchant ID</th>
                    <th>Namn</th>
                    <th>Status</th>
                    <th>Stores</th>
                    <th>Skapad</th>
                    <th>Uppdaterad</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderMerchantRows(merchants)}
                </tbody>
              </table>
            </div>
          </div>

          <div class="table-card">
            <div class="table-header">
              <div class="table-title">Shopify stores</div>
              <div class="table-subtitle">Kopplingar mellan Shopify shop domains och merchants</div>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Shop domain</th>
                    <th>Merchant ID</th>
                    <th>Merchant namn</th>
                    <th>Merchant status</th>
                    <th>Store aktiv</th>
                    <th>Skapad</th>
                    <th>Uppdaterad</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderStoreRows(stores)}
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
  renderAdminMerchantsPage
};
