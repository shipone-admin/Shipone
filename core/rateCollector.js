// =====================================================
// Collect rates from mock carriers (ESM)
// =====================================================

import postnord from "../carriers/postnord.mock.js";
import dhl from "../carriers/dhl.mock.js";
import budbee from "../carriers/budbee.mock.js";

export async function collectRates(order) {
  const postnordRates = await postnord.getRates(order);
  const dhlRates = await dhl.getRates(order);
  const budbeeRates = await budbee.getRates(order);

  return [
    ...postnordRates,
    ...dhlRates,
    ...budbeeRates
  ];
}
