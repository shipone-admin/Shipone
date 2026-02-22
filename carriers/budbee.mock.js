module.exports = {
  name: "Budbee",
  type: "mock",

  async getRates(order) {
    console.log("📦 Budbee MOCK called");

    return [
      {
        id: "BUD_EVENING",
        name: "Evening Delivery",
        price: 79,
        eta_days: 2,
        co2: 0.9
      },
      {
        id: "BUD_LOCKER",
        name: "Locker Delivery",
        price: 59,
        eta_days: 2,
        co2: 0.6
      }
    ];
  }
};
