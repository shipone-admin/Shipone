// =====================================================
// POSTNORD MOCK (ESM)
// =====================================================

export default {
  async getRates(order) {
    console.log("📡 PostNord mock rates requested");

    return [
      {
        carrier: "postnord",
        id: "PN_EXPRESS",
        name: "Express",
        price: 109,
        eta_days: 1,
        co2: 2.4
      },
      {
        carrier: "postnord",
        id: "PN_STANDARD",
        name: "MyPack Collect",
        price: 79,
        eta_days: 2,
        co2: 1.8
      }
    ];
  }
};
