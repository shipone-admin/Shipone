function formatDateValue(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatCarrierName(carrier) {
  const normalized = normalizeText(carrier);

  if (normalized === "postnord") return "PostNord";
  if (normalized === "dhl") return "DHL";
  if (normalized === "budbee") return "Budbee";

  return carrier || "transportör";
}

function createEvent({
  code,
  title,
  description,
  occurredAt,
  status = "done",
  source = "shipone"
}) {
  return {
    code,
    title,
    description,
    occurredAt: formatDateValue(occurredAt),
    status,
    source
  };
}

function getShipmentRegisteredAt(shipment) {
  return shipment?.created_at || null;
}

function getShipmentCreatedAt(shipment) {
  return shipment?.created_at || null;
}

function getFulfillmentCompletedAt(shipment) {
  return shipment?.completed_at || shipment?.created_at || null;
}

function getTrackingNumberCreatedAt(shipment) {
  return shipment?.completed_at || shipment?.created_at || null;
}

function getShipmentCompletedAt(shipment) {
  return shipment?.completed_at || shipment?.created_at || null;
}

function getShipmentProcessingAt(shipment) {
  return shipment?.created_at || null;
}

function getShipmentFailedAt(shipment) {
  return shipment?.failed_at || shipment?.created_at || null;
}

function buildShipmentCreatedDescription(shipment) {
  const actualCarrier = formatCarrierName(shipment?.actual_carrier);
  const selectedCarrier = formatCarrierName(shipment?.selected_carrier);
  const selectedService = shipment?.selected_service || "okänd tjänst";
  const fallbackUsed = Boolean(shipment?.fallback_used);
  const fallbackFrom = formatCarrierName(shipment?.fallback_from);

  if (fallbackUsed) {
    return `Shipment skapades hos ${actualCarrier} efter fallback från ${fallbackFrom}. Ursprungligt val var ${selectedCarrier} • ${selectedService}.`;
  }

  return `Shipment skapades framgångsrikt hos ${actualCarrier}. Vald tjänst: ${selectedService}.`;
}

function buildTrackingNumberDescription(shipment) {
  const trackingNumber = shipment?.tracking_number || "-";
  const actualCarrier = formatCarrierName(shipment?.actual_carrier);
  return `Trackingnummer ${trackingNumber} är registrerat för försändelsen hos ${actualCarrier}.`;
}

function buildShipmentCompletedDescription(shipment) {
  const actualCarrier = formatCarrierName(shipment?.actual_carrier);
  const fallbackUsed = Boolean(shipment?.fallback_used);
  const fallbackFrom = formatCarrierName(shipment?.fallback_from);

  if (fallbackUsed) {
    return `Försändelsen är klar och tracking-sidan kan visas för kunden. Fallback användes från ${fallbackFrom} till ${actualCarrier}.`;
  }

  return "Försändelsen är klar och tracking-sidan kan visas för kunden.";
}

function buildInternalTrackingEvents(shipment) {
  const events = [];

  if (!shipment) {
    return events;
  }

  events.push(
    createEvent({
      code: "shipment_registered",
      title: "Shipment registrerat",
      description: "Försändelsen har registrerats i ShipOne.",
      occurredAt: getShipmentRegisteredAt(shipment),
      status: "done",
      source: "shipone"
    })
  );

  if (shipment.shipment_success) {
    events.push(
      createEvent({
        code: "shipment_created",
        title: "Fraktsedel skapad",
        description: buildShipmentCreatedDescription(shipment),
        occurredAt: getShipmentCreatedAt(shipment),
        status: "done",
        source: "shipone"
      })
    );
  }

  if (shipment.fulfillment_success) {
    events.push(
      createEvent({
        code: "fulfillment_completed",
        title: "Fulfillment slutförd",
        description: "Ordern har markerats som uppfylld i Shopify.",
        occurredAt: getFulfillmentCompletedAt(shipment),
        status: "done",
        source: "shopify"
      })
    );
  } else {
    events.push(
      createEvent({
        code: "fulfillment_pending",
        title: "Fulfillment väntar",
        description: "Fulfillment är ännu inte markerad som slutförd.",
        occurredAt: getShipmentProcessingAt(shipment),
        status: "pending",
        source: "shopify"
      })
    );
  }

  if (shipment.tracking_number) {
    events.push(
      createEvent({
        code: "tracking_number_created",
        title: "Trackingnummer skapat",
        description: buildTrackingNumberDescription(shipment),
        occurredAt: getTrackingNumberCreatedAt(shipment),
        status: "done",
        source: shipment?.actual_carrier || "carrier"
      })
    );
  }

  if (shipment.status === "completed") {
    events.push(
      createEvent({
        code: "shipment_completed",
        title: "Shipment klart för spårning",
        description: buildShipmentCompletedDescription(shipment),
        occurredAt: getShipmentCompletedAt(shipment),
        status: "done",
        source: "shipone"
      })
    );
  }

  if (shipment.status === "processing") {
    events.push(
      createEvent({
        code: "shipment_processing",
        title: "Shipment behandlas",
        description: "Försändelsen behandlas fortfarande i ShipOne-flödet.",
        occurredAt: getShipmentProcessingAt(shipment),
        status: "active",
        source: "shipone"
      })
    );
  }

  if (shipment.status === "failed") {
    events.push(
      createEvent({
        code: "shipment_failed",
        title: "Shipment misslyckades",
        description: shipment.error || "Ett fel uppstod i shipment-flödet.",
        occurredAt: getShipmentFailedAt(shipment),
        status: "failed",
        source: "shipone"
      })
    );
  }

  return events.filter(Boolean);
}

function normalizeExternalEvents(events, fallbackSource = "carrier") {
  if (!Array.isArray(events)) {
    return [];
  }

  return events
    .filter(Boolean)
    .map((event, index) => ({
      code: event.code || `${fallbackSource}_event_${index + 1}`,
      title: event.title || "Tracking-händelse",
      description: event.description || "Extern tracking-händelse.",
      occurredAt: formatDateValue(event.occurredAt),
      status: event.status || "done",
      source: event.source || fallbackSource
    }))
    .filter((event) => event.occurredAt || event.title || event.description);
}

function sortEventsAscending(events) {
  return [...events].sort((a, b) => {
    const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
    const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
    return aTime - bTime;
  });
}

function buildTrackingEvents({
  shipment,
  externalEvents = [],
  externalSource = "carrier"
}) {
  const internalEvents = buildInternalTrackingEvents(shipment);
  const normalizedExternalEvents = normalizeExternalEvents(
    externalEvents,
    externalSource || shipment?.actual_carrier || "carrier"
  );

  return sortEventsAscending([...internalEvents, ...normalizedExternalEvents]);
}

module.exports = {
  buildTrackingEvents
};
