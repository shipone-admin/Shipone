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

  return carrier || "Transportör";
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
  return shipment?.completed_at || shipment
