// =====================================================
// BUDBEE SERVICE
// SAFE SANDBOX FOUNDATION
// =====================================================

function getBudbeeConfig() {
  return {
    carrier: "budbee",
    label: "Budbee",
    mode: String(process.env.BUDBEE_MODE || "sandbox").trim().toLowerCase(),
    baseUrl: String(process.env.BUDBEE_BASE_URL || "").trim() || null,
    apiKey: String(process.env.BUDBEE_API_KEY || "").trim() || null,
    apiSecret: String(process.env.BUDBEE_API_SECRET || "").trim() || null
  };
}

function getBudbeePublicConfig() {
  const config = getBudbeeConfig();

  return {
    carrier: config.carrier,
    label: config.label,
    mode: config.mode,
    hasBaseUrl: Boolean(config.baseUrl),
    hasApiKey: Boolean(config.apiKey),
    hasApiSecret: Boolean(config.apiSecret)
  };
}

async function createBudbeeShipment(order) {
  const config = getBudbeeConfig();

  return {
    success: false,
    carrier: "budbee",
    mode: config.mode,
    error: "Budbee shipment service is not implemented yet"
  };
}

module.exports = {
  getBudbeeConfig,
  getBudbeePublicConfig,
  createBudbeeShipment
};
