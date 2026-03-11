function toDate(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function diffMinutes(fromDate, toDate) {
  if (!fromDate || !toDate) return null;
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 60000);
}

function diffHours(fromDate, toDate) {
  if (!fromDate || !toDate) return null;
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 3600000);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function isWaitingCarrierText(text) {
  const normalized = normalizeText(text);

  if (!normalized) return false;

  return [
    "inväntar försändelse",
    "awaiting item",
    "pre-advice received",
    "shipment information received",
    "sender has booked shipment",
    "electronic shipment information received",
    "transportör inväntar gods",
  ].includes(normalized);
}

function buildHealthResult({
  level,
  label,
  reason,
  code,
  colorClass,
  bgClass,
  textClass,
}) {
  return {
    health: level,
    healthLabel: label,
    healthReason: reason,
    healthCode: code,
    healthColorClass: colorClass,
    healthBgClass: bgClass,
    healthTextClass: textClass,
  };
}

function getShipmentHealth(shipment) {
  const now = new Date();

  const trackingNumber = String(shipment?.tracking_number || "").trim();
  const carrier = String(shipment?.carrier || "").trim();
  const carrierStatusText = String(shipment?.carrier_status_text || "").trim();

  const createdAt = toDate(shipment?.created_at);
  const updatedAt = toDate(shipment?.updated_at);
  const syncedAt = toDate(
    shipment?.carrier_last_synced_at ||
      shipment?.last_synced_at ||
      shipment?.synced_at
  );
  const nextSyncAt = toDate(
    shipment?.carrier_next_sync_at ||
      shipment?.next_sync_at
  );

  const syncAttempts = Number(shipment?.carrier_sync_attempts || 0);
  const syncStatus = normalizeText(
    shipment?.carrier_last_sync_status ||
      shipment?.sync_status
  );

  const hoursSinceSync = diffHours(syncedAt, now);
  const hoursSinceUpdate = diffHours(updatedAt || createdAt, now);
  const minutesUntilNextSync = diffMinutes(now, nextSyncAt);

  if (!trackingNumber) {
    return buildHealthResult({
      level: "problem",
      label: "Problem",
      reason: "Trackingnummer saknas på shipment.",
      code: "missing_tracking_number",
      colorClass: "health-problem",
      bgClass: "background:#fee2e2;",
      textClass: "color:#991b1b;",
    });
  }

  if (!carrier) {
    return buildHealthResult({
      level: "problem",
      label: "Problem",
      reason: "Carrier saknas på shipment.",
      code: "missing_carrier",
      colorClass: "health-problem",
      bgClass: "background:#fee2e2;",
      textClass: "color:#991b1b;",
    });
  }

  if (syncStatus === "error" || syncStatus === "failed" || syncStatus === "failure") {
    return buildHealthResult({
      level: "problem",
      label: "Problem",
      reason: "Senaste tracking-sync misslyckades.",
      code: "sync_failed",
      colorClass: "health-problem",
      bgClass: "background:#fee2e2;",
      textClass: "color:#991b1b;",
    });
  }

  if (syncAttempts >= 8) {
    return buildHealthResult({
      level: "warning",
      label: "Varning",
      reason: `Många syncförsök registrerade (${syncAttempts}).`,
      code: "high_sync_attempts",
      colorClass: "health-warning",
      bgClass: "background:#fef3c7;",
      textClass: "color:#92400e;",
    });
  }

  if (nextSyncAt && minutesUntilNextSync !== null && minutesUntilNextSync < -30) {
    return buildHealthResult({
      level: "warning",
      label: "Varning",
      reason: "Nästa sync-tid ligger mer än 30 minuter i det förflutna.",
      code: "overdue_next_sync",
      colorClass: "health-warning",
      bgClass: "background:#fef3c7;",
      textClass: "color:#92400e;",
    });
  }

  if (isWaitingCarrierText(carrierStatusText)) {
    return buildHealthResult({
      level: "waiting",
      label: "Väntar",
      reason: "Transportören har ännu inte registrerat progression i flödet.",
      code: "awaiting_progress",
      colorClass: "health-waiting",
      bgClass: "background:#dbeafe;",
      textClass: "color:#1d4ed8;",
    });
  }

  if (!syncedAt && hoursSinceUpdate !== null && hoursSinceUpdate >= 1) {
    return buildHealthResult({
      level: "warning",
      label: "Varning",
      reason: "Shipment finns men har ännu inte någon registrerad tracking-sync.",
      code: "never_synced",
      colorClass: "health-warning",
      bgClass: "background:#fef3c7;",
      textClass: "color:#92400e;",
    });
  }

  if (hoursSinceSync !== null && hoursSinceSync >= 24) {
    return buildHealthResult({
      level: "warning",
      label: "Varning",
      reason: `Shipment har inte synkats på ${hoursSinceSync} timmar.`,
      code: "stale_sync",
      colorClass: "health-warning",
      bgClass: "background:#fef3c7;",
      textClass: "color:#92400e;",
    });
  }

  return buildHealthResult({
    level: "ok",
    label: "OK",
    reason: "Shipment ser frisk ut och senaste sync-status är normal.",
    code: "healthy",
    colorClass: "health-ok",
    bgClass: "background:#dcfce7;",
    textClass: "color:#166534;",
  });
}

function enrichShipmentWithHealth(shipment) {
  if (!shipment || typeof shipment !== "object") {
    return shipment;
  }

  return {
    ...shipment,
    ...getShipmentHealth(shipment),
  };
}

function enrichShipmentsWithHealth(shipments) {
  if (!Array.isArray(shipments)) {
    return [];
  }

  return shipments.map(enrichShipmentWithHealth);
}

module.exports = {
  getShipmentHealth,
  enrichShipmentWithHealth,
  enrichShipmentsWithHealth,
};
