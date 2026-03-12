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
      description: "Försändelsen rör sig genom transportörens nätverk."
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

function getDHLStage(statusText) {
  const text = normalizeText(statusText);

  if (!text) {
    return {
      key: "unknown",
      label: null,
      description: null
    };
  }

  if (
    text.includes("information received") ||
    text.includes("shipment information received") ||
    text.includes("pre-transit") ||
    text.includes("label created")
  ) {
    return {
      key: "registered",
      label: "Registrerad",
      description: "Försändelsen är registrerad hos DHL men har ännu inte kommit vidare i transportflödet."
    };
  }

  if (
    text.includes("picked up") ||
    text.includes("processed") ||
    text.includes("received")
  ) {
    return {
      key: "received",
      label: "Mottagen av DHL",
      description: "DHL har tagit emot försändelsen och den är nu inne i transportflödet."
    };
  }

  if (
    text.includes("in transit") ||
    text.includes("transit") ||
    text.includes("departed") ||
    text.includes("arrived")
  ) {
    return {
      key: "in_transit",
      label: "Under transport",
      description: "Försändelsen rör sig genom DHL:s nätverk."
    };
  }

  if (
    text.includes("out for delivery") ||
    text.includes("with delivery courier")
  ) {
    return {
      key: "out_for_delivery",
      label: "Ute för leverans",
      description: "Försändelsen är ute för leverans."
    };
  }

  if (
    text.includes("delivered") ||
    text.includes("delivery successful") ||
    text.includes("signed")
  ) {
    return {
      key: "delivered",
      label: "Levererad",
      description: "Försändelsen har levererats till mottagaren."
    };
  }

  if (
    text.includes("exception") ||
    text.includes("failed") ||
    text.includes("undeliverable") ||
    text.includes("return")
  ) {
    return {
      key: "issue",
      label: "Leveransproblem",
      description: "Det finns ett leveransproblem eller en avvikelse i DHL-flödet."
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

function getCarrierStage(actualCarrier, statusText) {
  const carrier = normalizeText(actualCarrier);

  if (carrier === "postnord") {
    return getPostNordStage(statusText);
  }

  if (carrier === "dhl") {
    return getDHLStage(statusText);
  }

  return {
    key: "unknown",
    label: null,
    description: null
  };
}

function getDisplayStatus({ shipment, carrierTracking }) {
  const carrierStatusText = carrierTracking?.statusText || "";
  const carrierStage = getCarrierStage(shipment?.actual_carrier, carrierStatusText);

  if (carrierStage.key !== "unknown") {
    return {
      source: normalizeText(shipment?.actual_carrier) || "carrier",
      stage: carrierStage.key,
      label: carrierStage.label,
      description: carrierStage.description,
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
