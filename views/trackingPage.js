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

function getHeadingText(displayStatus, shipment) {
  const stage = displayStatus?.stage || "";

  if (stage === "registered") return "Försändelsen är registrerad";
  if (stage === "received") return "PostNord har tagit emot försändelsen";
  if (stage === "in_transit") return "Paketet är på väg";
  if (stage === "ready_for_pickup") return "Paketet är redo att hämtas";
  if (stage === "delivered") return "Paketet är levererat";
  if (stage === "issue") return "Det finns ett problem med leveransen";

  if (shipment?.status === "completed") return "Ditt paket är skickat";
  if (shipment?.status === "processing") return "Din leverans behandlas";
  if (shipment?.status === "failed") return "Ett problem uppstod med leveransen";

  return "Leveransstatus";
}

function getStatusMeta(displayStatus, shipment) {
  const stage = displayStatus?.stage || "";

  if (stage === "registered") {
    return {
      label: displayStatus.label || "Registrerad",
      description: displayStatus.description || "Försändelsen är registrerad hos transportören men ännu inte inlämnad.",
      badgeClass: "status-registered"
    };
  }

  if (stage === "received") {
    return {
      label: displayStatus.label || "Mottagen av PostNord",
      description: displayStatus.description || "Transportören har tagit emot försändelsen.",
      badgeClass: "status-received"
    };
  }

  if (stage === "in_transit") {
    return {
      label: displayStatus.label || "Under transport",
      description: displayStatus.description || "Försändelsen är på väg genom transportnätverket.",
      badgeClass: "status-in-transit"
    };
  }

  if (stage === "ready_for_pickup") {
    return {
      label: displayStatus.label || "Redo att hämtas",
      description: displayStatus.description || "Försändelsen kan nu hämtas ut av mottagaren.",
      badgeClass: "status-pickup"
    };
  }

  if (stage === "delivered") {
    return {
      label: displayStatus.label || "Levererad",
      description: displayStatus.description || "Försändelsen har levererats till mottagaren.",
      badgeClass: "status-delivered"
    };
  }

  if (stage === "issue") {
    return {
      label: displayStatus.label || "Leveransproblem",
      description: displayStatus.description || "Det finns en avvikelse i leveransflödet.",
      badgeClass: "status-failed"
    };
  }

  const shipmentStatus = String(shipment?.status || "").toLowerCase();

  if (shipmentStatus === "completed") {
    return {
      label: "Skickad",
      description: "Försändelsen är skapad och skickad vidare med transportören.",
      badgeClass: "status-completed"
    };
  }

  if (shipmentStatus === "processing") {
    return {
      label: "Behandlas",
      description: "Leveransen behandlas just nu i ShipOne-flödet.",
      badgeClass: "status-processing"
    };
  }

  if (shipmentStatus === "failed") {
    return {
      label: "Misslyckades",
      description: "Något gick fel i leveransflödet och behöver kontrolleras.",
      badgeClass: "status-failed"
    };
  }

  return {
    label: formatShipmentStatus(shipment?.status),
    description: "Status är registrerad men kunde inte kategoriseras tydligare ännu.",
    badgeClass: "status-unknown"
  };
}

function getEventStateClass(status) {
  if (status === "done") return "event-done";
  if (status === "active") return "event-active";
  if (status === "failed") return "event-failed";
  return "event-pending";
}

function getEventSourceLabel(source) {
  if (source === "shopify") return "Shopify";
  if (source === "carrier") return "Transportör";
  if (source === "postnord") return "PostNord";
  return "ShipOne";
}

function renderEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return `
      <div class="empty-events">
        Inga tracking-händelser finns ännu för denna försändelse.
      </div>
    `;
  }

  return `
    <ul class="event-list">
      ${events
        .map((event) => {
          const stateClass = getEventStateClass(event.status);
          const occurredAt = escapeHtml(formatDateSv(event.occurredAt));
          const title = escapeHtml(event.title || "Händelse");
          const description = escapeHtml(event.description || "-");
          const source = escapeHtml(getEventSourceLabel(event.source));

          return `
            <li class="event-item">
              <div class="event-dot ${stateClass}"></div>
              <div class="event-content">
                <div class="event-top">
                  <div class="event-title">${title}</div>
                  <div class="event-source">${source}</div>
                </div>
                <div class="event-time">${occurredAt}</div>
                <div class="event-description">${description}</div>
              </div>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function renderCarrierStatusMessage(carrierTracking, displayStatus) {
  if (!carrierTracking) {
    return "";
  }

  if (carrierTracking.success && carrierTracking.statusText) {
    return `
      <div class="carrier-box carrier-success">
        Live PostNord-status: ${escapeHtml(carrierTracking.statusText)}
        <div class="
