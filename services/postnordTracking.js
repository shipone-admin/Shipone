const axios = require("axios");

const DEFAULT_POSTNORD_TRACKING_URL =
  process.env.POSTNORD_TRACKING_URL ||
  "https://api2.postnord.com/rest/shipment/v5/trackandtrace/findByIdentifier.json";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toIsoOrNull(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function mapPostNordEventStatus(type, code, text) {
  const combined = `${safeString(type)} ${safeString(code)} ${safeString(text)}`.toLowerCase();

  if (
    combined.includes("delivered") ||
    combined.includes("utlämnad") ||
    combined.includes("levererad")
  ) {
    return "done";
  }

  if (
    combined.includes("failed") ||
    combined.includes("stopped") ||
    combined.includes("error") ||
    combined.includes("misslyck")
  ) {
    return "failed";
  }

  if (
    combined.includes("en_route") ||
    combined.includes("transit") ||
    combined.includes("transport") ||
    combined.includes("informed") ||
    combined.includes("terminal")
  ) {
    return "active";
  }

  return "done";
}

function normalizeLocation(rawEvent) {
  const candidates = [
    rawEvent?.location?.name,
    rawEvent?.location?.displayName,
    rawEvent?.location?.city,
    rawEvent?.eventLocation?.name,
    rawEvent?.eventLocation?.displayName,
    rawEvent?.eventLocation?.city
  ];

  const value = candidates.find(Boolean);
  return safeString(value);
}

function normalizeDescription(rawEvent) {
  const candidates = [
    rawEvent?.eventDescription,
    rawEvent?.description,
    rawEvent?.message,
    rawEvent?.eventText,
    rawEvent?.statusText?.header,
    rawEvent?.statusText?.body
  ];

  const description = safeString(candidates.find(Boolean));
  const location = normalizeLocation(rawEvent);

  if (description && location) {
    return `${description} (${location})`;
  }

  if (description) {
    return description;
  }

  if (location) {
    return `Händelse registrerad i ${location}.`;
  }

  return "PostNord har registrerat en ny tracking-händelse.";
}

function normalizeTitle(rawEvent) {
  const candidates = [
    rawEvent?.eventDescription,
    rawEvent?.displayText,
    rawEvent?.header,
    rawEvent?.statusText?.header,
    rawEvent?.eventType,
    rawEvent?.type
  ];

  const title = safeString(candidates.find(Boolean));
  return title || "PostNord-händelse";
}

function normalizeOccurredAt(rawEvent) {
  const candidates = [
    rawEvent?.eventTime,
    rawEvent?.dateTime,
    rawEvent?.eventDate,
    rawEvent?.date,
    rawEvent?.registeredAt
  ];

  const value = candidates.find(Boolean);
  return toIsoOrNull(value);
}

function getRawEventsFromResponse(data) {
  const responseRoot = data?.TrackingInformationResponse || data || {};
  const shipments = safeArray(responseRoot.shipments);

  const events = [];

  for (const shipment of shipments) {
    const shipmentEvents = safeArray(shipment?.events);
    for (const event of shipmentEvents) {
      events.push(event);
    }

    const items = safeArray(shipment?.items);
    for (const item of items) {
      const itemEvents = safeArray(item?.events);
      for (const event of itemEvents) {
        events.push(event);
      }
    }
  }

  return events;
}

function normalizePostNordEvents(data) {
  const rawEvents = getRawEventsFromResponse(data);

  return rawEvents
    .map((rawEvent, index) => {
      const type = safeString(rawEvent?.eventType || rawEvent?.type);
      const code = safeString(rawEvent?.eventCode || rawEvent?.code);
      const title = normalizeTitle(rawEvent);
      const description = normalizeDescription(rawEvent);
      const occurredAt = normalizeOccurredAt(rawEvent);

      return {
        code: code || `postnord_event_${index + 1}`,
        title,
        description,
        occurredAt,
        status: mapPostNordEventStatus(type, code, `${title} ${description}`),
        source: "postnord",
        rawType: type || null
      };
    })
    .filter((event) => event.title || event.description)
    .sort((a, b) => {
      const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
      const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
      return aTime - bTime;
    });
}

function extractTopLevelStatus(data) {
  const responseRoot = data?.TrackingInformationResponse || data || {};
  const shipment = safeArray(responseRoot.shipments)[0] || {};
  const item = safeArray(shipment?.items)[0] || {};

  const candidates = [
    item?.statusText?.header,
    item?.statusText?.body,
    item?.status,
    shipment?.statusText?.header,
    shipment?.statusText?.body,
    shipment?.status
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

async function fetchPostNordTracking(trackingNumber) {
  const apiKey = safeString(process.env.POSTNORD_API_KEY);
  const locale = safeString(process.env.POSTNORD_TRACKING_LOCALE || "sv");
  const id = safeString(trackingNumber);

  if (!id) {
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
      reason: "POSTNORD_API_KEY is not configured",
      events: [],
      statusText: null,
      eventCount: 0,
      latestEventAt: null
    };
  }

  try {
    const response = await axios.get(DEFAULT_POSTNORD_TRACKING_URL, {
      params: {
        apikey: apiKey,
        id,
        locale
      },
      timeout: 12000
    });

    const data = response.data;
    const events = normalizePostNordEvents(data);
    const statusText = extractTopLevelStatus(data);
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
      reason: error.response?.data || error.message || "PostNord tracking request failed",
      events: [],
      statusText: null,
      eventCount: 0,
      latestEventAt: null
    };
  }
}

module.exports = {
  fetchPostNordTracking
};
