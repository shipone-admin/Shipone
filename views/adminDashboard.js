const { enrichShipmentsWithHealth } = require("../services/shipmentHealth");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCarrierName(carrier) {
  const normalized = String(carrier || "").toLowerCase();
  if (normalized === "postnord") return "PostNord";
  if (normalized === "dhl") return "DHL";
  if (normalized === "budbee") return "Budbee";
  return carrier || "-";
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

  const availabilityBlock = `
    ${
      shipment.shipmentAvailable === false
        ? `<div class="secondary carrier-fallback-text">
            Ej bokningsbar${
              shipment.shipmentBlockedReason
                ? ` (${escapeHtml(shipment.shipmentBlockedReason)})`
                : ""
            }
          </div>`
        : shipment.shipmentAvailable === true
        ? `<div class="secondary" style="color:#047857;font-weight:700;">
            Bokningsbar
          </div>`
        : ""
    }
  `;

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
        ${availabilityBlock}
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
        ${availabilityBlock}
      </div>
    `;
  }

  return `
    <div class="carrier-block">
      <div class="primary">
        <span class="carrier-pill">${escapeHtml(actualCarrier)}</span>
      </div>
      <div class="secondary">Tjänst: ${escapeHtml(selectedService)}</div>
      ${availabilityBlock}
    </div>
  `;
}

function renderRows(shipments) {
  if (!shipments.length) {
    return `<tr><td colspan="6">Inga shipments</td></tr>`;
  }

  return shipments
    .map((s) => {
      return `
        <tr>
          <td>${escapeHtml(s.order_name || "-")}</td>
          <td>${renderCarrierCell(s)}</td>
          <td>${escapeHtml(s.status || "-")}</td>
          <td>${escapeHtml(s.tracking_number || "-")}</td>
          <td>${escapeHtml(s.carrier_status_text || "-")}</td>
          <td>${escapeHtml(s.merchant_id || "-")}</td>
        </tr>
      `;
    })
    .join("");
}

function renderAdminDashboard({ shipments = [] } = {}) {
  const enriched = enrichShipmentsWithHealth(shipments);

  return `
    <html>
      <head>
        <title>ShipOne Admin</title>
        <style>
          body { font-family: Arial; padding:20px; }
          table { width:100%; border-collapse:collapse; }
          td, th { border:1px solid #ddd; padding:10px; }
          .carrier-pill { background:#eef; padding:4px 8px; border-radius:6px; }
          .carrier-pill-selected { background:#cce; }
          .carrier-pill-actual { background:#cfc; }
          .carrier-fallback-text { color:#b45309; font-weight:bold; }
          .secondary { font-size:12px; margin-top:4px; }
          .primary { font-weight:bold; }
        </style>
      </head>
      <body>
        <h1>ShipOne Admin</h1>
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Carrier</th>
              <th>Status</th>
              <th>Tracking</th>
              <th>Carrier status</th>
              <th>Merchant</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows(enriched)}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

module.exports = {
  renderAdminDashboard
};
