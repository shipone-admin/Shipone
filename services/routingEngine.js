// 🚚 ShipOne Routing Engine
// This asks ALL carriers for rates and merges the result.

const carriers = require("../carriers");

async function getAllRates(order) {
  console.log("🚀 RoutingEngine started");

  const results = [];

  for (const carrier of carriers) {
    try {
      console.log(`➡️ Asking ${carrier.name} for rates...`);

      const rates = await carrier.getRates(order);

      rates.forEach(rate => {
        results.push({
          carrier: carrier.name,
          service_id: rate.id,
          service_name: `${carrier.name} – ${rate.name}`,
          price: rate.price,
          eta_days: rate.eta_days,
          co2: rate.co2
        });
      });

    } catch (err) {
      console.log(`⚠️ ${carrier.name} skipped: ${err.message}`);
    }
  }

  console.log("✅ Combined rates:", results);

  return results;
}

module.exports = {
  getAllRates
};
