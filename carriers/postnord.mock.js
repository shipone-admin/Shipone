// carriers/postnord.mock.js

// Mock version of PostNord rates (used until API is live)

async function getRates(order) {
  console.log("📡 PostNord mock rates requested");

  return [
    {
      carrier: "postnord",
      id: "PN_SERVICE_POINT",
      name: "Service Point",
      price: 59,
      eta_days: 2,
      co2: 1.2
    },
    {
      carrier: "postnord",
      id: "PN_HOME",
      name: "Home Delivery",
      price: 79,
      eta_days: 2,
      co2: 1.6
    },
    {
      carrier: "postnord",
      id: "PN_EXPRESS",
      name: "Express",
      price: 109,
      eta_days: 1,
      co2: 2.4
    }
  ];
}

module.exports = {
  getRates
};
