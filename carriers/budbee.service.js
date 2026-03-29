// =====================================================
// BUDBEE SERVICE
// SAFE SANDBOX FOUNDATION
// =====================================================

function getBudbeeConfig() {
  const mode = String(process.env.BUDBEE_MODE || "sandbox")
    .trim()
    .toLowerCase();

  const sandboxBaseUrl =
    String(process.env.BUDBEE_SANDBOX_BASE_URL || "").trim() || null;

  const productionBaseUrl =
    String(process.env.BUDBEE_PRODUCTION_BASE_URL || "").trim() || null;

  const fallbackBaseUrl =
    String(process.env.BUDBEE_BASE_URL || "").trim() || null;

  const resolvedBaseUrl =
    mode === "production"
      ? productionBaseUrl || fallbackBaseUrl
      : sandboxBaseUrl || fallbackBaseUrl;

  return {
    carrier: "budbee",
    label: "Budbee",
    mode,
    baseUrl: resolvedBaseUrl,
    sandboxBaseUrl,
    productionBaseUrl,
    apiKey: String(process.env.BUDBEE_API_KEY || "").trim() || null,
    apiSecret: String(process.env.BUDBEE_API_SECRET || "").trim() || null,
    defaultCountryCode:
      String(process.env.BUDBEE_DEFAULT_COUNTRY_CODE || "SE").trim().toUpperCase() || "SE"
  };
}

function getBudbeePublicConfig() {
  const config = getBudbeeConfig();

  return {
    carrier: config.carrier,
    label: config.label,
    mode: config.mode,
    hasBaseUrl: Boolean(config.baseUrl),
    hasSandboxBaseUrl: Boolean(config.sandboxBaseUrl),
    hasProductionBaseUrl: Boolean(config.productionBaseUrl),
    hasApiKey: Boolean(config.apiKey),
    hasApiSecret: Boolean(config.apiSecret),
    defaultCountryCode: config.defaultCountryCode
  };
}

function normalizeBudbeePostalCode(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "");
}

function buildBudbeeRecipient(order, config) {
  const shippingAddress = order?.shipping_address || {};
  const customer = order?.customer || {};

  const firstName = String(
    shippingAddress.first_name || customer.first_name || ""
  ).trim();

  const lastName = String(
    shippingAddress.last_name || customer.last_name || ""
  ).trim();

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    name: fullName || "ShipOne Customer",
    firstName: firstName || null,
    lastName: lastName || null,
    address1: String(shippingAddress.address1 || "").trim() || null,
    address2: String(shippingAddress.address2 || "").trim() || null,
    city: String(shippingAddress.city || "").trim() || null,
    postalCode: normalizeBudbeePostalCode(shippingAddress.zip),
    countryCode: String(
      shippingAddress.country_code || config.defaultCountryCode || "SE"
    )
      .trim()
      .toUpperCase(),
    phone: String(
      shippingAddress.phone || order?.phone || customer.phone || ""
    ).trim() || null,
    email: String(order?.email || customer.email || "").trim() || null
  };
}

function buildBudbeeShipmentDraft(order) {
  const config = getBudbeeConfig();
  const recipient = buildBudbeeRecipient(order, config);

  return {
    externalReference:
      String(order?.id || order?.order_number || order?.name || "preview-order").trim(),
    orderName: String(order?.name || "").trim() || null,
    mode: config.mode,
    carrier: config.carrier,
    recipient,
    parcel: {
      weightGrams: null,
      heightCm: null,
      widthCm: null,
      lengthCm: null
    },
    metadata: {
      source: "shipone",
      createdFrom: "budbee.service",
      shopDomain: String(order?.shop_domain || "").trim() || null
    }
  };
}

function validateBudbeeDraft(draft) {
  const missingFields = [];

  if (!draft?.recipient?.postalCode) missingFields.push("recipient.postalCode");
  if (!draft?.recipient?.city) missingFields.push("recipient.city");
  if (!draft?.recipient?.countryCode) missingFields.push("recipient.countryCode");

  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

async function createBudbeeShipment(order) {
  const config = getBudbeeConfig();
  const draft = buildBudbeeShipmentDraft(order);
  const validation = validateBudbeeDraft(draft);

  console.log("📦 Budbee shipment requested");
  console.log("📦 Budbee mode:", config.mode);
  console.log("📦 Budbee base URL configured:", Boolean(config.baseUrl));
  console.log("📦 Budbee API credentials configured:", Boolean(config.apiKey && config.apiSecret));

  if (!validation.valid) {
    return {
      success: false,
      carrier: "budbee",
      mode: config.mode,
      draft,
      error: `Budbee shipment draft is missing required fields: ${validation.missingFields.join(", ")}`
    };
  }

  return {
    success: false,
    carrier: "budbee",
    mode: config.mode,
    draft,
    error: "Budbee shipment service is not implemented yet"
  };
}

module.exports = {
  getBudbeeConfig,
  getBudbeePublicConfig,
  normalizeBudbeePostalCode,
  buildBudbeeRecipient,
  buildBudbeeShipmentDraft,
  validateBudbeeDraft,
  createBudbeeShipment
};
