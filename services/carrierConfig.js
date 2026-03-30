// ================================
// SHIPONE CARRIER CONFIG
// SAFE MULTI-RATE STEP
// ================================

const carrierConfig = {
  postnord: {
    enabled: true,
    allowRates: true,
    allowShipment: true,
    allowTracking: true,
    label: "PostNord",
    status: "live",
    mode: "production"
  },

  dhl: {
    enabled: true,
    allowRates: true,
    allowShipment: false,
    allowTracking: true,
    label: "DHL",
    status: "in_progress",
    mode: "mock"
  },

  budbee: {
    enabled: true,
    allowRates: true,
    allowShipment: true,
    allowTracking: false,
    label: "Budbee",
    status: "planned",
    mode: "mock"
  }
};

function normalizeCarrierKey(carrier) {
  return String(carrier || "").trim().toLowerCase();
}

function getCarrierConfig(carrier) {
  return carrierConfig[normalizeCarrierKey(carrier)] || null;
}

function canUseCarrierForRates(carrier) {
  const c = getCarrierConfig(carrier);
  return Boolean(c && c.enabled && c.allowRates);
}

function canUseCarrierForShipment(carrier) {
  const c = getCarrierConfig(carrier);
  return Boolean(c && c.enabled && c.allowShipment);
}

function canUseCarrierForTracking(carrier) {
  const c = getCarrierConfig(carrier);
  return Boolean(c && c.enabled && c.allowTracking);
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

function getEnabledTrackingCarriers() {
  return Object.keys(carrierConfig).filter((carrier) => {
    const config = carrierConfig[carrier];
    return config.enabled && config.allowTracking;
  });
}

function getCarrierLabel(carrier) {
  const c = getCarrierConfig(carrier);
  return c?.label || String(carrier || "").toUpperCase();
}

function getCarrierStatus(carrier) {
  const c = getCarrierConfig(carrier);
  return c?.status || "unknown";
}

function getCarrierMode(carrier) {
  const c = getCarrierConfig(carrier);
  return c?.mode || "unknown";
}

function listCarrierConfigs() {
  return Object.keys(carrierConfig).map((carrierKey) => ({
    carrier_key: carrierKey,
    ...carrierConfig[carrierKey]
  }));
}

module.exports = {
  carrierConfig,
  normalizeCarrierKey,
  getCarrierConfig,
  canUseCarrierForRates,
  canUseCarrierForShipment,
  canUseCarrierForTracking,
  getEnabledRateCarriers,
  getEnabledShipmentCarriers,
  getEnabledTrackingCarriers,
  getCarrierLabel,
  getCarrierStatus,
  getCarrierMode,
  listCarrierConfigs
};
