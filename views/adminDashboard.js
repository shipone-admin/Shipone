// (KORTAD FÖR ATT VISA VAR ÄNDRINGEN ÄR — MEN DU FÅR HELA FUNKTIONEN ATT ERSÄTTA)

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
      </div>
    `;
  }

  return `
    <div class="carrier-block">
      <div class="primary">
        <span class="carrier-pill">${escapeHtml(actualCarrier)}</span>
      </div>
      <div class="secondary">Tjänst: ${escapeHtml(selectedService)}</div>

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
    </div>
  `;
}
