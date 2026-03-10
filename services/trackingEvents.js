function formatDateValue(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
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
      occurredAt: shipment.created_at,
      status: "done",
      source: "shipone"
    })
  );

  if (shipment.shipment_success) {
    events.push(
      createEvent({
        code: "shipment_created",
        title: "Fraktsedel skapad",
        description: "Shipment skapades framgångsrikt hos vald transportör.",
        occurredAt: shipment.created_at,
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
        occurredAt: shipment.completed_at || shipment.updated_at,
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
        occurredAt: shipment.updated_at || shipment.created_at,
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
        description: `Trackingnummer ${shipment.tracking_number} är registrerat för försändelsen.`,
        occurredAt: shipment.updated_at || shipment.created_at,
        status: "done",
        source: "carrier"
      })
    );
  }

  if (shipment.status === "completed") {
    events.push(
      createEvent({
        code: "shipment_completed",
        title: "Shipment klart för spårning",
        description: "Försändelsen är klar och tracking-sidan kan visas för kunden.",
        occurredAt: shipment.completed_at || shipment.updated_at,
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
        occurredAt: shipment.updated_at || shipment.created_at,
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
        occurredAt: shipment.failed_at || shipment.updated_at || shipment.created_at,
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
    }));
}

function sortEventsAscending(events) {
  return [...events].sort((a, b) => {
    const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
    const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
    return aTime - bTime;
  });
}

function buildTrackingEvents({ shipment, externalEvents = [] }) {
  const internalEvents = buildInternalTrackingEvents(shipment);
  const normalizedExternalEvents = normalizeExternalEvents(externalEvents, "postnord");

  return sortEventsAscending([...internalEvents, ...normalizedExternalEvents]);
}

module.exports = {
  buildTrackingEvents
};
