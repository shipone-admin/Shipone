// =====================================================
// BUDBEE MOCK
// =====================================================

module.exports = {
  async getRates(order) {
    console.log("📦 Budbee MOCK called");

    return [
      {
        carrier: "budbee",
        id: "BUD_HOME",
        name: "Budbee Home",
        price: 89,
        eta_days: 2,
        co2: 1.2
      }
    ];
  }
};
