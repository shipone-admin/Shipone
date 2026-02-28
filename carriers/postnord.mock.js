function getRates() {
  console.log("📡 PostNord mock rates requested");

  return [
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

module.exports = { getRates };
