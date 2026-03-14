function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function toDate(value) {
  if (!value) return null;

  try {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  } catch (error) {
    return null;
  }
}

function diffHours(fromDate, toDate) {
  if (!fromDate || !toDate) {
    return null;
  }

  return Math.floor((toDate.getTime() - fromDate.getTime()) / 3600000);
}

function isWaitingCarrierText(text) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return false;
  }

  return [
    "inväntar försändelse",
    "awaiting item",
    "pre-advice received",
    "shipment information received",
    "sender has booked shipment",
    "electronic shipment information received",
    "transportör inväntar gods"
  ].includes(normalized);
}

function getHealthBadgeClass(health) {
  if (health === "ok") return "health-ok";
  if (health === "waiting") return "health-waiting";
  if (health === "warning") return "health-warning";
  if (health === "problem") return "health-problem";
  return "health-neutral";
}

function getShipmentHealth(shipment) {
  const now = new Date();

  const trackingNumber = String(shipment?.tracking_number || "").trim();
  const carrier = String(shipment?.actual_carrier || "").trim();
  const shipmentStatus = normalizeText(shipment?.status);
  const syncStatus = normalizeText(shipment?.carrier_last_sync_status);
  const carrierStatusText = String(shipment?.carrier_status_text || "").trim();

  const carrierLastSyncedAt = toDate(shipment?.carrier_last_synced_at);
  const carrierNextSyncAt = toDate(shipment?.carrier_next_sync_at);

  const hoursSinceLastSync = diffHours(carrierLastSyncedAt, now);
  const carrierEventCount = Number(shipment?.carrier_event_count ?? 0);
  const syncAttempts = Number(shipment?.carrier_sync_attempts ?? 0);

  const hasAnySyncData =
    Boolean(syncStatus) ||
    Boolean(carrierLastSyncedAt) ||
    Boolean(carrierNextSyncAt) ||
    carrierEventCount > 0 ||
    Boolean(carrierStatusText);

  if (!trackingNumber) {
    return {
      health: "problem",
      healthLabel: "Problem",
      healthCode: "missing_tracking_number",
      healthReason: "Trackingnummer saknas på shipment.",
      healthClass: getHealthBadgeClass("problem")
    };
  }

  if (shipmentStatus === "failed" || syncStatus === "failed") {
    return {
      health: "problem",
      healthLabel: "Problem",
      healthCode: "failed_state",
      healthReason: "Shipment eller tracking-sync är markerad som misslyckad.",
      healthClass: getHealthBadgeClass("problem")
    };
  }

  if (!hasAnySyncData && shipmentStatus === "completed") {
    return {
      health: "waiting",
      healthLabel: "Väntar",
      healthCode: "awaiting_first_sync",
      healthReason: "Shipmentet är skapat men väntar ännu på första tracking-sync från transportören.",
      healthClass: getHealthBadgeClass("waiting")
    };
  }

  if (isWaitingCarrierText(carrierStatusText)) {
    return {
      health: "waiting",
      healthLabel: "Väntar",
      healthCode: "awaiting_progress",
      healthReason: "Transportören har ännu inte registrerat progression i flödet.",
      healthClass: getHealthBadgeClass("waiting")
    };
  }

  if (!carrier && syncStatus === "success") {
    return {
      health: "warning",
      healthLabel: "Varning",
      healthCode: "missing_actual_carrier",
      healthReason: "actual_carrier saknas trots att shipmentet i övrigt verkar fungera.",
      healthClass: getHealthBadgeClass("warning")
    };
  }

  if (carrierNextSyncAt && carrierNextSyncAt.getTime() < now.getTime() - 30 * 60 * 1000) {
    return {
      health: "warning",
      healthLabel: "Varning",
      healthCode: "next_sync_overdue",
      healthReason: "Nästa sync-tid ligger mer än 30 minuter i det förflutna.",
      healthClass: getHealthBadgeClass("warning")
    };
  }

  if (syncAttempts >= 8 && syncStatus !== "success") {
    return {
      health: "warning",
      healthLabel: "Varning",
      healthCode: "high_sync_attempts",
      healthReason: `Många syncförsök registrerade (${syncAttempts}).`,
      healthClass: getHealthBadgeClass("warning")
    };
  }

  if (carrierLastSyncedAt && hoursSinceLastSync !== null && hoursSinceLastSync >= 24) {
    return {
      health: "warning",
      healthLabel: "Varning",
      healthCode: "stale_sync",
      healthReason: `Shipmentet har inte synkats på ${hoursSinceLastSync} timmar.`,
      healthClass: getHealthBadgeClass("warning")
    };
  }

  if (syncStatus === "success" && carrierEventCount === 0 && shipmentStatus === "processing") {
    return {
      health: "waiting",
      healthLabel: "Väntar",
      healthCode: "processing_without_events",
      healthReason: "Shipmentet behandlas men saknar ännu registrerade carrier-events.",
      healthClass: getHealthBadgeClass("waiting")
    };
  }

  if (syncStatus === "success" && carrierEventCount === 0 && shipmentStatus === "completed") {
    return {
      health: "waiting",
      healthLabel: "Väntar",
      healthCode: "completed_without_events",
      healthReason: "Shipmentet är slutfört men transportören har ännu inte visat någon första händelse.",
      healthClass: getHealthBadgeClass("waiting")
    };
  }

  return {
    health: "ok",
    healthLabel: "OK",
    healthCode: "healthy",
    healthReason: "Shipmentet ser friskt ut och senaste sync-status är normal.",
    healthClass: getHealthBadgeClass("ok")
  };
}

function enrichShipmentWithHealth(shipment) {
  if (!shipment || typeof shipment !== "object") {
    return shipment;
  }

  return {
    ...shipment,
    ...getShipmentHealth(shipment)
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
  enrichShipmentsWithHealth
};
