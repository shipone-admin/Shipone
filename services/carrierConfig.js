// ================================
// SHIPONE CARRIER CONFIG
// SAFE MULTI-RATE STEP
// ================================

const carrierConfig = {
  postnord: {
    enabled: true,
    allowRates: true,
    allowShipment: true,
    label: "PostNord"
  },

  dhl: {
    enabled: true,
    allowRates: true,
    allowShipment: false,
    label: "DHL"
  },

  budbee: {
    enabled: true,
    allowRates: true,
    allowShipment: false,
    label: "Budbee"
  }
};

function canUseCarrierForRates(carrier) {
  const c = carrierConfig[String(carrier || "").toLowerCase()];
  return Boolean(c && c.enabled && c.allowRates);
}

function canUseCarrierForShipment(carrier) {
  const c = carrierConfig[String(carrier || "").toLowerCase()];
  return Boolean(c && c.enabled && c.allowShipment);
}

function getEnabledRateCarriers() {
  return Object.keys(carrierConfig).filter((carrier) => {
    const config = carrierConfig[carrier];
    return config.enabled && config.allowRates;
  });
}

function getEnabledShipmentCarriers() {
  return Object.keys(carrierConfig).filter((carrier) => {
    const config = carrierConfig[carrier];
    return config.enabled && config.allowShipment;
  });
}

function getCarrierLabel(carrier) {
  const c = carrierConfig[String(carrier || "").toLowerCase()];
  return c?.label || String(carrier || "").toUpperCase();
}

module.exports = {
  carrierConfig,
  canUseCarrierForRates,
  canUseCarrierForShipment,
  getEnabledRateCarriers,
  getEnabledShipmentCarriers,
  getCarrierLabel
};
