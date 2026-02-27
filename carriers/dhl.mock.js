// =====================================================
// DHL MOCK (ESM)
// =====================================================

export default {
  async getRates(order) {
    console.log("📦 DHL MOCK called");

    return [
      {
        carrier: "dhl",
        id: "DHL_PARCEL",
        name: "DHL Parcel",
        price: 95,
        eta_days: 2,
        co2: 3.1
      }
    ];
  }
};
