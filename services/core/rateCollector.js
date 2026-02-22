// core/rateCollector.js

const postnord = require("../carriers/postnord.mock");
const dhl = require("../carriers/dhl.mock");
const budbee = require("../carriers/budbee.mock");

// Hämta alla fraktalternativ från alla carriers
async function collectRates(order) {
  let rates = [];

  const postnordRates = await postnord.getRates(order);
  const dhlRates = await dhl.getRates(order);
  const budbeeRates = await budbee.getRates(order);

  rates = [
    ...postnordRates,
    ...dhlRates,
    ...budbeeRates
  ];

  return rates;
}

module.exports = {
  collectRates
};
