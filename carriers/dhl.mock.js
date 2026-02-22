module.exports = {
  name: "DHL",
  type: "mock",

  async getRates(order) {
    console.log("📦 DHL MOCK called");

    return [
      {
        id: "DHL_PARCEL",
        name: "DHL Parcel",
        price: 69,
        eta_days: 2,
        co2: 1.8
      },
      {
        id: "DHL_EXPRESS",
        name: "DHL Express",
        price: 129,
        eta_days: 1,
        co2: 2.9
      }
    ];
  }
};
