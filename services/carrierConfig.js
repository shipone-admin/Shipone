// ================================
// SHIPONE CARRIER CONFIG
// ================================

const carrierConfig = {
  postnord: {
    enabled: true,
    allowRates: true,
    allowShipment: true,
    label: "PostNord"
  },

  dhl: {
    enabled: false,
    allowRates: false,
    allowShipment: false,
    label: "DHL"
  },

  budbee: {
    enabled: false,
    allowRates: false,
    allowShipment: false,
    label: "Budbee"
  }
};

function canUseCarrierForRates(carrier) {
  const c = carrierConfig[String(carrier).toLowerCase()];
  return c && c.enabled && c.allowRates;
}

function canUseCarrierForShipment(carrier) {
  const c = carrierConfig[String(carrier).toLowerCase()];
  return c && c.enabled && c.allowShipment;
}

function getEnabledRateCarriers() {
  return Object.keys(carrierConfig).filter(
    (carrier) => carrierConfig[carrier].enabled && carrierConfig[carrier].allowRates
  );
}

function getEnabledShipmentCarriers() {
  return Object.keys(carrierConfig).filter(
    (carrier) => carrierConfig[carrier].enabled && carrierConfig[carrier].allowShipment
  );
}

module.exports = {
  carrierConfig,
  canUseCarrierForRates,
  canUseCarrierForShipment,
  getEnabledRateCarriers,
  getEnabledShipmentCarriers
};
