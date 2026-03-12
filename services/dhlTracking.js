const axios = require("axios");

const DEFAULT_DHL_TRACKING_URL =
  process.env.DHL_TRACKING_URL ||
  "https://api-eu.dhl.com/track/shipments";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toIsoOrNull(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function mapDHLEventStatus(statusCode, statusText, descriptionText) {
  const combined =
    `${safeString(statusCode)} ${safeString(statusText)} ${safeString(descriptionText)}`
      .toLowerCase()
      .trim();

  if (
    combined.includes("delivered") ||
    combined.includes("delivery") && combined.includes("successful") ||
    combined.includes("signed") ||
    combined.includes("completed")
  ) {
    return "done";
  }

  if (
    combined.includes("exception") ||
    combined.includes("failure") ||
    combined.includes("failed") ||
    combined.includes("return") ||
    combined.includes("undeliverable") ||
    combined.includes("customs") && combined.includes("hold")
  ) {
    return "failed";
  }

  if (
    combined.includes("transit") ||
    combined.includes("picked up") ||
    combined.includes("processed") ||
    combined.includes("departed") ||
    combined.includes("arrived") ||
    combined.includes("with delivery courier") ||
    combined.includes("out for delivery") ||
    combined.includes("pre-transit") ||
    combined.includes("information received") ||
    combined.includes("shipment information received")
  ) {
    return "active";
  }

  return "active";
}

function extractShipments(data) {
  if (Array.isArray(data?.shipments)) {
    return data.shipments;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}

function normalizeLocation(rawValue) {
  const candidates = [
    rawValue?.location?.address?.addressLocality,
    rawValue?.location?.address?.postalCode,
    rawValue?.location?.address?.countryCode,
    rawValue?.location?.addressLocality,
    rawValue?.location?.name,
    rawValue?.location?.displayName,
    rawValue?.location?.city,
    rawValue?.address?.addressLocality,
    rawValue?.address?.postalCode,
    rawValue?.city,
    rawValue?.name
  ];

  const value = candidates.find(Boolean);
  return safeString(value);
}

function buildDescription(rawEvent) {
  const description = safeString(
    rawEvent?.description ||
      rawEvent?.status ||
      rawEvent?.remark ||
      rawEvent?.message
  );

  const nextSteps = safeString(rawEvent?.nextSteps);
  const location = normalizeLocation(rawEvent);

  const parts = [];

  if (description) {
    parts.push(description);
  }

  if (location) {
    parts.push(location);
  }

  if (nextSteps) {
    parts.push(nextSteps);
  }

  if (parts.length === 0) {
    return "DHL har registrerat en ny tracking-händelse.";
  }

  return parts.join(" • ");
}

function buildTitle(rawEvent, index) {
  const candidates = [
    rawEvent?.status,
    rawEvent?.description,
    rawEvent?.statusCode,
    rawEvent?.code,
    rawEvent?.eventType
  ];

  const title = safeString(candidates.find(Boolean));

  return title || `DHL-händelse ${index + 1}`;
}

function buildOccurredAt(rawEvent) {
  const candidates = [
    rawEvent?.timestamp,
    rawEvent?.dateTime,
    rawEvent?.eventTime,
    rawEvent?.eventDate,
    rawEvent?.date
  ];

  return toIsoOrNull(candidates.find(Boolean));
}

function extractRawEventsFromShipment(shipment) {
  const directEvents = safeArray(shipment?.events);
  if (directEvents.length > 0) {
    return directEvents;
  }

  const checkpoints = safeArray(shipment?.checkpoints);
  if (checkpoints.length > 0) {
    return checkpoints;
  }

  const history = safeArray(shipment?.history);
  if (history.length > 0) {
    return history;
  }

  const timeline = safeArray(shipment?.timeline);
  if (timeline.length > 0) {
    return timeline;
  }

  const status = shipment?.status;
  if (status && typeof status === "object") {
    return [status];
  }

  return [];
}

function normalizeDHLShipmentEvents(shipment) {
  const rawEvents = extractRawEventsFromShipment(shipment);

  return rawEvents
    .map((rawEvent, index) => {
      const statusCode = safeString(rawEvent?.statusCode || rawEvent?.code);
      const statusText = safeString(rawEvent?.status);
      const description = buildDescription(rawEvent);
      const title = buildTitle(rawEvent, index);
      const occurredAt = buildOccurredAt(rawEvent);

      return {
        code: statusCode || `dhl_event_${index + 1}`,
        title,
        description,
        occurredAt,
        status: mapDHLEventStatus(statusCode, statusText, description),
        source: "carrier",
        rawType: statusCode || null
      };
    })
    .filter((event) => event.title || event.description)
    .sort((a, b) => {
      const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
      const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
      return aTime - bTime;
    });
}

function extractTopLevelStatus(shipment) {
  const status = shipment?.status;

  if (!status || typeof status !== "object") {
    return null;
  }

  const candidates = [
    status?.description,
    status?.status,
    status?.remark,
    status?.statusCode
  ];

  const value = safeString(candidates.find(Boolean));
  return value || null;
}

function getLatestEventAt(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return null;
  }

  const timestamps = events
    .map((event) => event?.occurredAt || null)
    .filter(Boolean)
    .sort();

  return timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;
}

async function fetchDHLTracking(trackingNumber) {
  const apiKey = safeString(process.env.DHL_API_KEY);
  const trackingNumberValue = safeString(trackingNumber);
  const service = safeString(process.env.DHL_TRACKING_SERVICE);

  if (!trackingNumberValue) {
    return {
      success: false,
      skipped: true,
      reason: "Missing tracking number",
      events: [],
      statusText: null,
      eventCount: 0,
      latestEventAt: null
    };
  }

  if (!apiKey) {
    return {
      success: false,
      skipped: true,
      reason: "DHL_API_KEY is not configured",
      events: [],
      statusText: null,
      eventCount: 0,
      latestEventAt: null
    };
  }

  try {
    const params = {
      trackingNumber: trackingNumberValue
    };

    if (service) {
      params.service = service;
    }

    const response = await axios.get(DEFAULT_DHL_TRACKING_URL, {
      params,
      headers: {
        Accept: "application/json",
        "DHL-API-Key": apiKey
      },
      timeout: 12000
    });

    const data = response.data || {};
    const shipments = extractShipments(data);
    const primaryShipment = shipments[0] || {};
    const events = normalizeDHLShipmentEvents(primaryShipment);
    const statusText = extractTopLevelStatus(primaryShipment);
    const latestEventAt = getLatestEventAt(events);

    return {
      success: true,
      skipped: false,
      reason: null,
      events,
      statusText,
      eventCount: events.length,
      latestEventAt,
      raw: data
    };
  } catch (error) {
    return {
      success: false,
      skipped: false,
      reason: error.response?.data || error.message || "DHL tracking request failed",
      events: [],
      statusText: null,
      eventCount: 0,
      latestEventAt: null
    };
  }
}

module.exports = {
  fetchDHLTracking
};
