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
    (combined.includes("delivery") && combined.includes("successful")) ||
    combined.includes("signed") ||
    combined.includes("completed") ||
    combined.includes("picked up by receiver")
  ) {
    return "done";
  }

  if (
    combined.includes("exception") ||
    combined.includes("failure") ||
    combined.includes("failed") ||
    combined.includes("return") ||
    combined.includes("undeliverable") ||
    (combined.includes("customs") && combined.includes("hold"))
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

  if (!status) {
    return null;
  }

  if (typeof status === "string") {
    return safeString(status) || null;
  }

  if (typeof status === "object") {
    const candidates = [
      status?.description,
      status?.status,
      status?.remark,
      status?.statusCode
    ];

    const value = safeString(candidates.find(Boolean));
    return value || null;
  }

  return null;
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

function extractErrorMessage(error) {
  const apiData = error?.response?.data;

  if (typeof apiData === "string" && apiData.trim()) {
    return apiData.trim();
  }

  if (apiData?.detail) {
    return safeString(apiData.detail);
  }

  if (apiData?.title) {
    return safeString(apiData.title);
  }

  if (apiData?.message) {
    return safeString(apiData.message);
  }

  if (error?.message) {
    return safeString(error.message);
  }

  return "DHL tracking request failed";
}

function buildDummyEvents(trackingNumberValue) {
  const now = new Date();
  const event1 = new Date(now.getTime() - 1000 * 60 * 60 * 18).toISOString();
  const event2 = new Date(now.getTime() - 1000 * 60 * 60 * 8).toISOString();
  const event3 = new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString();

  return [
    {
      code: "shipment_information_received",
      title: "Shipment information received",
      description: `DHL har mottagit sändningsinformation för ${trackingNumberValue}.`,
      occurredAt: event1,
      status: "active",
      source: "dummy",
      rawType: "shipment_information_received"
    },
    {
      code: "processed_at_terminal",
      title: "Processed at terminal",
      description: "Paketet har registrerats och processats i DHL-nätverket.",
      occurredAt: event2,
      status: "active",
      source: "dummy",
      rawType: "processed_at_terminal"
    },
    {
      code: "in_transit",
      title: "In transit",
      description: "Paketet är på väg genom DHL-nätverket.",
      occurredAt: event3,
      status: "active",
      source: "dummy",
      rawType: "in_transit"
    }
  ];
}

function buildDummyTrackingResponse(trackingNumberValue, reason) {
  const events = buildDummyEvents(trackingNumberValue);
  const latestEventAt = getLatestEventAt(events);

  return {
    success: true,
    skipped: false,
    reason: reason || "Using dummy DHL tracking",
    events,
    statusText: "In transit (dummy)",
    eventCount: events.length,
    latestEventAt,
    raw: {
      provider: "dummy_dhl",
      trackingNumber: trackingNumberValue,
      reason: reason || "Using dummy DHL tracking",
      generatedAt: new Date().toISOString()
    }
  };
}

async function fetchDHLTracking(trackingNumber) {
  const apiKey = safeString(process.env.DHL_API_KEY);
  const trackingNumberValue = safeString(trackingNumber);

  const configuredService = safeString(process.env.DHL_TRACKING_SERVICE);
  const service = configuredService || "freight";

  const requesterCountryCode =
    safeString(process.env.DHL_TRACKING_REQUESTER_COUNTRY_CODE) || "SE";
  const language = safeString(process.env.DHL_TRACKING_LANGUAGE) || "sv";
  const forceDummyMode =
    safeString(process.env.DHL_DUMMY_MODE).toLowerCase() === "true";

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

  if (forceDummyMode) {
    console.log("🟡 DHL dummy mode enabled");
    return buildDummyTrackingResponse(
      trackingNumberValue,
      "DHL_DUMMY_MODE is enabled"
    );
  }

  if (!apiKey) {
    console.log("🟡 DHL_API_KEY saknas, använder dummy tracking");
    return buildDummyTrackingResponse(
      trackingNumberValue,
      "DHL_API_KEY is not configured"
    );
  }

  try {
    const params = {
      trackingNumber: trackingNumberValue,
      service,
      requesterCountryCode,
      language
    };

    console.log("📡 DHL tracking request params:");
    console.log(
      JSON.stringify(
        {
          trackingNumber: trackingNumberValue,
          service,
          requesterCountryCode,
          language
        },
        null,
        2
      )
    );

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
    const statusText =
      extractTopLevelStatus(primaryShipment) ||
      safeString(primaryShipment?.status?.description) ||
      null;
    const latestEventAt = getLatestEventAt(events);

    console.log("✅ DHL tracking response status:", response.status);
    console.log("✅ DHL tracking shipments found:", shipments.length);
    console.log("✅ DHL tracking events found:", events.length);

    if (events.length === 0) {
      console.log("🟡 DHL svarade utan events, använder dummy tracking");
      return buildDummyTrackingResponse(
        trackingNumberValue,
        "DHL returned no tracking events"
      );
    }

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
    const errorMessage = extractErrorMessage(error);

    console.log("❌ DHL tracking failed");
    console.log(
      JSON.stringify(
        {
          trackingNumber: trackingNumberValue,
          service,
          status: error?.response?.status || null,
          error: errorMessage,
          data: error?.response?.data || null
        },
        null,
        2
      )
    );

    console.log("🟡 Falling back to dummy DHL tracking");

    return buildDummyTrackingResponse(trackingNumberValue, errorMessage);
  }
}

module.exports = {
  fetchDHLTracking
};
