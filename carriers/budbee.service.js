// =====================================================
// BUDBEE SERVICE
// SAFE MOCK + DEBUG SUPPORT VERSION
// =====================================================

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizePostalCode(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function getBudbeeConfig() {
  const mode = normalizeText(process.env.BUDBEE_MODE || "sandbox").toLowerCase() || "sandbox";

  const sandboxBaseUrl =
    normalizeText(process.env.BUDBEE_SANDBOX_BASE_URL) || null;

  const productionBaseUrl =
    normalizeText(process.env.BUDBEE_PRODUCTION_BASE_URL) || null;

  const baseUrl =
    mode === "production"
      ? (productionBaseUrl || sandboxBaseUrl || null)
      : (sandboxBaseUrl || productionBaseUrl || null);

  const apiKey = normalizeText(process.env.BUDBEE_API_KEY) || null;
  const apiSecret = normalizeText(process.env.BUDBEE_API_SECRET) || null;
  const timeoutMs = Number(process.env.BUDBEE_TIMEOUT_MS || 15000);

  return {
    carrier: "budbee",
    label: "Budbee",
    mode,
    baseUrl,
    sandboxBaseUrl,
    productionBaseUrl,
    apiKey,
    apiSecret,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000,
    defaultCountryCode: "SE"
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
    defaultCountryCode: config.defaultCountryCode,
    timeoutMs: config.timeoutMs
  };
}

function buildBudbeeRates() {
  return [
    {
      carrier: "budbee",
      id: "BUD_HOME",
      name: "Budbee Home",
      price: 89,
      eta_days: 2,
      co2: 1.2
    },
    {
      carrier: "budbee",
      id: "BUD_BOX",
      name: "Budbee Box",
      price: 69,
      eta_days: 2,
      co2: 0.8
    }
  ];
}

// =====================================================
// MOCK RATES
// =====================================================

async function getBudbeeRates(order) {
  console.log("📦 Budbee MOCK getRates called");
  const rates = buildBudbeeRates(order);
  console.log("📦 Budbee MOCK rates:", rates.length);
  return rates;
}

// =====================================================
// DRAFT / READINESS HELPERS
// =====================================================

function buildRecipientName(firstName, lastName) {
  const joined = [normalizeText(firstName), normalizeText(lastName)]
    .filter(Boolean)
    .join(" ")
    .trim();

  return joined || "ShipOne Recipient";
}

function buildBudbeeDraft(order = {}, config = getBudbeeConfig()) {
  const shipping = order.shipping_address || {};
  const customer = order.customer || {};

  const firstName =
    normalizeText(shipping.first_name) ||
    normalizeText(customer.first_name) ||
    "ShipOne";

  const lastName =
    normalizeText(shipping.last_name) ||
    normalizeText(customer.last_name) ||
    "Preview";

  const postalCode = normalizePostalCode(shipping.zip);
  const countryCode =
    normalizeText(shipping.country_code || config.defaultCountryCode).toUpperCase() ||
    config.defaultCountryCode;

  return {
    externalReference: normalizeText(order.id) || `budbee-${Date.now()}`,
    orderName: normalizeText(order.name) || "#BUDBEE",
    mode: config.mode,
    carrier: "budbee",
    recipient: {
      name: buildRecipientName(firstName, lastName),
      firstName,
      lastName,
      address1: normalizeText(shipping.address1) || null,
      address2: normalizeText(shipping.address2) || null,
      city: normalizeText(shipping.city) || null,
      postalCode: postalCode || null,
      countryCode: countryCode || config.defaultCountryCode,
      phone:
        normalizeText(shipping.phone) ||
        normalizeText(order.phone) ||
        normalizeText(customer.phone) ||
        null,
      email:
        normalizeText(order.email) ||
        normalizeText(customer.email) ||
        null
    },
    parcel: {
      weightGrams: null,
      heightCm: null,
      widthCm: null,
      lengthCm: null
    },
    metadata: {
      source: "shipone",
      createdFrom: "budbee.service",
      shopDomain: normalizeText(order.shop_domain) || null
    }
  };
}

function validateBudbeeDraft(draft) {
  const missingFields = [];

  if (!draft?.recipient?.city) {
    missingFields.push("recipient.city");
  }

  if (!draft?.recipient?.postalCode) {
    missingFields.push("recipient.postalCode");
  }

  if (!draft?.recipient?.countryCode) {
    missingFields.push("recipient.countryCode");
  }

  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

function getBudbeeShipmentReadiness(order = {}) {
  const config = getBudbeeConfig();
  const draft = buildBudbeeDraft(order, config);

  const missingConfig = [];

  if (!config.baseUrl) {
    missingConfig.push("baseUrl");
  }

  if (!config.apiKey) {
    missingConfig.push("apiKey");
  }

  if (!config.apiSecret) {
    missingConfig.push("apiSecret");
  }

  const configReadiness = {
    ready: missingConfig.length === 0,
    missingConfig
  };

  const draftValidation = validateBudbeeDraft(draft);

  const missingRequirements = [
    ...missingConfig.map((item) => `config.${item}`),
    ...draftValidation.missingFields
  ];

  return {
    ready: configReadiness.ready && draftValidation.valid,
    config,
    draft,
    configReadiness,
    draftValidation,
    missingRequirements
  };
}

// =====================================================
// SAFE DEBUG HELPERS
// =====================================================

async function validateBudbeePostalCode(draft, config = getBudbeeConfig()) {
  const postalCode = normalizePostalCode(draft?.recipient?.postalCode);
  const countryCode = normalizeText(draft?.recipient?.countryCode || config.defaultCountryCode).toUpperCase();

  if (!postalCode || !countryCode) {
    return {
      success: false,
      statusCode: 400,
      serviced: false,
      errorCode: "budbee_missing_postal_data",
      error: "Missing postal code or country code",
      raw: null
    };
  }

  if (!config.baseUrl || !config.apiKey || !config.apiSecret) {
    return {
      success: false,
      statusCode: 400,
      serviced: false,
      errorCode: "budbee_not_ready",
      error: "Budbee config is incomplete",
      raw: null
    };
  }

  // Safe mock validation for debug/test routes.
  // This keeps server.js routes working without live Budbee calls.
  return {
    success: true,
    statusCode: 200,
    serviced: true,
    errorCode: null,
    error: null,
    raw: {
      mock: true,
      validated: true,
      postalCode,
      countryCode,
      collections: [
        {
          id: "BUD_HOME",
          label: "Budbee Home"
        },
        {
          id: "BUD_BOX",
          label: "Budbee Box"
        }
      ]
    }
  };
}

function pickDefaultCollectionId(postalValidation) {
  const collections = Array.isArray(postalValidation?.raw?.collections)
    ? postalValidation.raw.collections
    : [];

  if (collections.length === 0) {
    return null;
  }

  return collections[0].id || null;
}

// =====================================================
// MOCK SHIPMENT
// =====================================================

async function createBudbeeShipment(order = {}) {
  console.log("📦 Budbee MOCK createShipment called");

  const draft = buildBudbeeDraft(order, getBudbeeConfig());
  const collectionId = pickDefaultCollectionId({
    raw: {
      collections: [
        { id: "BUD_HOME", label: "Budbee Home" },
        { id: "BUD_BOX", label: "Budbee Box" }
      ]
    }
  });

  return {
    success: true,
    carrier: "budbee",
    mode: "mock",
    data: {
      trackingNumber: "BUD" + Date.now(),
      trackingUrl: null
    },
    raw: {
      mock: true,
      draft,
      collectionId
    }
  };
}

module.exports = {
  getBudbeeConfig,
  getBudbeePublicConfig,
  getBudbeeRates,
  getBudbeeShipmentReadiness,
  validateBudbeePostalCode,
  pickDefaultCollectionId,
  createBudbeeShipment
};
