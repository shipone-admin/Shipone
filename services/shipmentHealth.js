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

function diffHours(fromDate, toDateValue) {
  if (!fromDate || !toDateValue) {
    return null;
  }

  return Math.floor((toDateValue.getTime() - fromDate.getTime()) / 3600000);
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

function isTrackingBlockedStatus(syncStatus) {
  const normalized = normalizeText(syncStatus);
  return normalized === "disabled_by_merchant" || normalized === "disabled";
}

function isDummyDHLShipment(shipment) {
  const carrier = normalizeText(shipment?.actual_carrier);
  const statusText = normalizeText(shipment?.carrier_status_text);

  if (carrier !== "dhl") {
    return false;
  }

  return (
    statusText.includes("(dummy)") ||
    statusText.includes("dummy") ||
    statusText.includes("testläge")
  );
}

function getHealthBadgeClass(health) {
  if (health === "ok") return "health-ok";
  if (health === "waiting") return "health-waiting";
  if (health === "warning") return "health-warning";
  if (health === "problem") return "health-problem";
  return "health-neutral";
}

function buildHealthResult({
  health,
  healthLabel,
  healthCode,
  healthReason
}) {
  return {
    health,
    healthLabel,
    healthCode,
    healthReason,
    healthClass: getHealthBadgeClass(health)
  };
}

function getWaitingReason(shipment, fallbackUsed) {
  const shipmentStatus = normalizeText(shipment?.status);
  const carrierEventCount = Number(shipment?.carrier_event_count ?? 0);

  if (fallbackUsed && shipmentStatus === "completed" && carrierEventCount === 0) {
    return buildHealthResult({
      health: "waiting",
      healthLabel: "Väntar",
      healthCode: "fallback_awaiting_first_event",
      healthReason:
        "Fallback till faktisk transportör användes korrekt, men första carrier-händelsen har ännu inte registrerats."
    });
  }

  if (fallbackUsed) {
    return buildHealthResult({
      health: "waiting",
      healthLabel: "Väntar",
      healthCode: "fallback_awaiting_progress",
      healthReason:
        "Fallback till faktisk transportör användes korrekt. Transportören har ännu inte registrerat progression i flödet."
    });
  }

  return buildHealthResult({
    health: "waiting",
    healthLabel: "Väntar",
    healthCode: "awaiting_progress",
    healthReason: "Transportören har ännu inte registrerat progression i flödet."
  });
}

function hasFirstSyncMissingState(shipment) {
  const shipmentStatus = normalizeText(shipment?.status);
  const syncStatus = normalizeText(shipment?.carrier_last_sync_status);
  const carrierStatusText = normalizeText(shipment?.carrier_status_text);
  const carrierEventCount = Number(shipment?.carrier_event_count ?? 0);
  const carrierLastSyncedAt = toDate(shipment?.carrier_last_synced_at);

  if (shipmentStatus !== "completed" && shipmentStatus !== "processing") {
    return false;
  }

  if (syncStatus) {
    return false;
  }

  if (carrierStatusText) {
    return false;
  }

  if (carrierEventCount > 0) {
    return false;
  }

  if (carrierLastSyncedAt) {
    return false;
  }

  return true;
}

function hasMeaningfulSyncBaseline(shipment) {
  const syncStatus = normalizeText(shipment?.carrier_last_sync_status);
  const carrierStatusText = normalizeText(shipment?.carrier_status_text);
  const carrierEventCount = Number(shipment?.carrier_event_count ?? 0);
  const carrierLastSyncedAt = toDate(shipment?.carrier_last_synced_at);

  return (
    Boolean(syncStatus) ||
    Boolean(carrierStatusText) ||
    carrierEventCount > 0 ||
    Boolean(carrierLastSyncedAt)
  );
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
  const fallbackUsed = Boolean(shipment?.fallback_used);

  const hasAnySyncData =
    Boolean(syncStatus) ||
    Boolean(carrierLastSyncedAt) ||
    Boolean(carrierNextSyncAt) ||
    carrierEventCount > 0 ||
    Boolean(carrierStatusText);

  const hasSyncBaseline = hasMeaningfulSyncBaseline(shipment);

  if (!trackingNumber) {
    return buildHealthResult({
      health: "problem",
      healthLabel: "Problem",
      healthCode: "missing_tracking_number",
      healthReason: "Trackingnummer saknas på shipment."
    });
  }

  if (shipmentStatus === "failed" || syncStatus === "failed") {
    return buildHealthResult({
      health: "problem",
      healthLabel: "Problem",
      healthCode: "failed_state",
      healthReason: "Shipment eller tracking-sync är markerad som misslyckad."
    });
  }

  if (isTrackingBlockedStatus(syncStatus)) {
    return buildHealthResult({
      health: "warning",
      healthLabel: "Blockerad",
      healthCode: "tracking_blocked_by_policy",
      healthReason:
        "Merchant-policy stoppar live tracking för denna carrier. Shipmentet kan fortfarande vara korrekt skapat, men tracking-sync körs inte."
    });
  }

  if (isDummyDHLShipment(shipment)) {
    return buildHealthResult({
      health: "warning",
      healthLabel: "Testläge",
      healthCode: "dhl_dummy_tracking",
      healthReason:
        "DHL tracking körs i dummy-läge just nu. Flödet fungerar för test och admin, men riktig DHL API är ännu inte aktiv."
    });
  }

  if (hasFirstSyncMissingState(shipment)) {
    if (fallbackUsed) {
      return buildHealthResult({
        health: "waiting",
        healthLabel: "Väntar",
        healthCode: "fallback_awaiting_first_sync",
        healthReason:
          "Fallback till faktisk transportör användes korrekt, men första tracking-sync har ännu inte registrerats."
      });
    }

    return buildHealthResult({
      health: "waiting",
      healthLabel: "Väntar",
      healthCode: "awaiting_first_sync",
      healthReason:
        "Shipmentet väntar ännu på första tracking-sync från transportören."
    });
  }

  if (!hasAnySyncData && shipmentStatus === "completed") {
    if (fallbackUsed) {
      return buildHealthResult({
        health: "waiting",
        healthLabel: "Väntar",
        healthCode: "fallback_awaiting_first_sync",
        healthReason:
          "Fallback till faktisk transportör användes korrekt, men första tracking-sync har ännu inte registrerats."
      });
    }

    return buildHealthResult({
      health: "waiting",
      healthLabel: "Väntar",
      healthCode: "awaiting_first_sync",
      healthReason:
        "Shipmentet är skapat men väntar ännu på första tracking-sync från transportören."
    });
  }

  if (isWaitingCarrierText(carrierStatusText)) {
    return getWaitingReason(shipment, fallbackUsed);
  }

  if (!carrier && syncStatus === "success") {
    return buildHealthResult({
      health: "warning",
      healthLabel: "Varning",
      healthCode: "missing_actual_carrier",
      healthReason:
        "actual_carrier saknas trots att shipmentet i övrigt verkar fungera."
    });
  }

  if (
    hasSyncBaseline &&
    carrierNextSyncAt &&
    carrierNextSyncAt.getTime() < now.getTime() - 30 * 60 * 1000
  ) {
    return buildHealthResult({
      health: "warning",
      healthLabel: "Varning",
      healthCode: "next_sync_overdue",
      healthReason: "Nästa sync-tid ligger mer än 30 minuter i det förflutna."
    });
  }

  if (syncAttempts >= 8 && syncStatus !== "success") {
    return buildHealthResult({
      health: "warning",
      healthLabel: "Varning",
      healthCode: "high_sync_attempts",
      healthReason: `Många syncförsök registrerade (${syncAttempts}).`
    });
  }

  if (carrierLastSyncedAt && hoursSinceLastSync !== null && hoursSinceLastSync >= 24) {
    return buildHealthResult({
      health: "warning",
      healthLabel: "Varning",
      healthCode: "stale_sync",
      healthReason: `Shipmentet har inte synkats på ${hoursSinceLastSync} timmar.`
    });
  }

  if (syncStatus === "success" && carrierEventCount === 0 && shipmentStatus === "processing") {
    if (fallbackUsed) {
      return buildHealthResult({
        health: "waiting",
        healthLabel: "Väntar",
        healthCode: "fallback_processing_without_events",
        healthReason:
          "Fallback till faktisk transportör användes korrekt, men shipmentet saknar ännu registrerade carrier-events."
      });
    }

    return buildHealthResult({
      health: "waiting",
      healthLabel: "Väntar",
      healthCode: "processing_without_events",
      healthReason:
        "Shipmentet behandlas men saknar ännu registrerade carrier-events."
    });
  }

  if (syncStatus === "success" && carrierEventCount === 0 && shipmentStatus === "completed") {
    if (fallbackUsed) {
      return buildHealthResult({
        health: "waiting",
        healthLabel: "Väntar",
        healthCode: "fallback_completed_without_events",
        healthReason:
          "Fallback till faktisk transportör användes korrekt, men transportören har ännu inte visat någon första händelse."
      });
    }

    return buildHealthResult({
      health: "waiting",
      healthLabel: "Väntar",
      healthCode: "completed_without_events",
      healthReason:
        "Shipmentet är slutfört men transportören har ännu inte visat någon första händelse."
    });
  }

  return buildHealthResult({
    health: "ok",
    healthLabel: "OK",
    healthCode: "healthy",
    healthReason: "Shipmentet ser friskt ut och senaste sync-status är normal."
  });
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
