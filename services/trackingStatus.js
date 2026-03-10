function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getPostNordStage(statusText) {
  const text = normalizeText(statusText);

  if (!text) {
    return {
      key: "unknown",
      label: null,
      description: null
    };
  }

  if (
    text.includes("inväntar försändelse") ||
    text.includes("awaiting shipment") ||
    text.includes("elektronisk förhandsinformation") ||
    text.includes("aviinformation har mottagits")
  ) {
    return {
      key: "registered",
      label: "Registrerad",
      description: "Försändelsen är registrerad hos PostNord men har ännu inte kommit in i transportflödet."
    };
  }

  if (
    text.includes("ankommit till postnord") ||
    text.includes("mottagen av postnord") ||
    text.includes("inlämnad") ||
    text.includes("received by postnord")
  ) {
    return {
      key: "received",
      label: "Mottagen av PostNord",
      description: "PostNord har tagit emot försändelsen och den är nu inne i transportflödet."
    };
  }

  if (
    text.includes("under transport") ||
    text.includes("på väg") ||
    text.includes("in transit") ||
    text.includes("sorterad") ||
    text.includes("terminal")
  ) {
    return {
      key: "in_transit",
      label: "Under transport",
      description: "Försändelsen rör sig genom PostNords nätverk."
    };
  }

  if (
    text.includes("kan hämtas") ||
    text.includes("redo att hämtas") ||
    text.includes("ombud") ||
    text.includes("service point") ||
    text.includes("utlämningsställe")
  ) {
    return {
      key: "ready_for_pickup",
      label: "Redo att hämtas",
      description: "Försändelsen finns tillgänglig för mottagaren att hämta ut."
    };
  }

  if (
    text.includes("utdelad") ||
    text.includes("levererad") ||
    text.includes("delivered") ||
    text.includes("utlämnad")
  ) {
    return {
      key: "delivered",
      label: "Levererad",
      description: "Försändelsen har levererats eller lämnats ut till mottagaren."
    };
  }

  if (
    text.includes("misslyckad") ||
    text.includes("kunde inte levereras") ||
    text.includes("failed") ||
    text.includes("returnerad") ||
    text.includes("retur")
  ) {
    return {
      key: "issue",
      label: "Leveransproblem",
      description: "Det finns ett leveransproblem eller en avvikelse i transportflödet."
    };
  }

  return {
    key: "carrier_update",
    label: "Carrier-uppdatering",
    description: statusText
  };
}

function getFallbackShipmentStage(shipment) {
  const status = normalizeText(shipment?.status);

  if (status === "failed") {
    return {
      key: "issue",
      label: "Misslyckades",
      description: "Något gick fel i ShipOne-flödet och försändelsen kunde inte slutföras."
    };
  }

  if (status === "processing") {
    return {
      key: "processing",
      label: "Behandlas",
      description: "Försändelsen behandlas just nu i ShipOne."
    };
  }

  if (status === "completed") {
    return {
      key: "completed",
      label: "Skickad",
      description: "Försändelsen är skapad och klar för spårning."
    };
  }

  return {
    key: "unknown",
    label: "Okänd status",
    description: "Det finns ännu inte tillräcklig information för att avgöra leveransstatus."
  };
}

function getDisplayStatus({ shipment, carrierTracking }) {
  const carrierStatusText = carrierTracking?.statusText || "";
  const postNordStage = getPostNordStage(carrierStatusText);

  if (postNordStage.key !== "unknown") {
    return {
      source: "postnord",
      stage: postNordStage.key,
      label: postNordStage.label,
      description: postNordStage.description,
      rawCarrierStatus: carrierStatusText
    };
  }

  const fallbackStage = getFallbackShipmentStage(shipment);

  return {
    source: "shipone",
    stage: fallbackStage.key,
    label: fallbackStage.label,
    description: fallbackStage.description,
    rawCarrierStatus: carrierStatusText || null
  };
}

module.exports = {
  getDisplayStatus
};
