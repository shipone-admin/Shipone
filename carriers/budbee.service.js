const axios = require("axios");

// =====================================================
// BUDBEE SERVICE
// SAFE SANDBOX FOUNDATION
// FIRST REAL SANDBOX REQUEST VERSION
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
      String(process.env.BUDBEE_DEFAULT_COUNTRY_CODE || "SE")
        .trim()
        .toUpperCase() || "SE",
    timeoutMs: Number(process.env.BUDBEE_TIMEOUT_MS || 15000)
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

function getBudbeeConfigReadiness(config = getBudbeeConfig()) {
  const missingConfig = [];

  if (!config.baseUrl) missingConfig.push("baseUrl");
  if (!config.apiKey) missingConfig.push("apiKey");
  if (!config.apiSecret) missingConfig.push("apiSecret");

  return {
    ready: missingConfig.length === 0,
    missingConfig
  };
}

function getBudbeeShipmentReadiness(order) {
  const config = getBudbeeConfig();
  const draft = buildBudbeeShipmentDraft(order);
  const draftValidation = validateBudbeeDraft(draft);
  const configReadiness = getBudbeeConfigReadiness(config);

  const missingRequirements = [
    ...configReadiness.missingConfig.map((field) => `config.${field}`),
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

function mapBudbeeReadinessErrorCode(readiness) {
  const missingRequirements = Array.isArray(readiness?.missingRequirements)
    ? readiness.missingRequirements
    : [];

  if (missingRequirements.includes("config.baseUrl")) {
    return "missing_base_url";
  }

  if (missingRequirements.includes("config.apiKey")) {
    return "missing_api_key";
  }

  if (missingRequirements.includes("config.apiSecret")) {
    return "missing_api_secret";
  }

  if (missingRequirements.some((field) => field.startsWith("recipient."))) {
    return "missing_recipient_fields";
  }

  return "budbee_not_ready";
}

function buildBudbeeReadinessError(readiness) {
  const code = mapBudbeeReadinessErrorCode(readiness);
  const missingRequirements = Array.isArray(readiness?.missingRequirements)
    ? readiness.missingRequirements
    : [];

  const labels = {
    missing_base_url: "Budbee base URL saknas",
    missing_api_key: "Budbee API key saknas",
    missing_api_secret: "Budbee API secret saknas",
    missing_recipient_fields: "Budbee shipment saknar mottagarfält",
    budbee_not_ready: "Budbee är inte redo"
  };

  const messageBase = labels[code] || "Budbee är inte redo";

  return {
    code,
    message:
      missingRequirements.length > 0
        ? `${messageBase}: ${missingRequirements.join(", ")}`
        : messageBase
  };
}

function buildBudbeeAuthHeader(config) {
  const authString = `${config.apiKey}:${config.apiSecret}`;
  return `Basic ${Buffer.from(authString).toString("base64")}`;
}

function buildBudbeePostalValidationRequest(draft, config) {
  const countryCode = String(
    draft?.recipient?.countryCode || config.defaultCountryCode || "SE"
  )
    .trim()
    .toUpperCase();

  const postalCode = normalizeBudbeePostalCode(draft?.recipient?.postalCode);

  const path = `/postalcodes/validate/${encodeURIComponent(countryCode)}/${encodeURIComponent(postalCode)}`;
  const url = `${String(config.baseUrl || "").replace(/\/+$/, "")}${path}`;

  return {
    method: "GET",
    url,
    headers: {
      Authorization: buildBudbeeAuthHeader(config),
      "Content-Type": "application/vnd.budbee.postalcodes-v2+json"
    },
    timeout: config.timeoutMs
  };
}

async function validateBudbeePostalCode(draft, config = getBudbeeConfig()) {
  const requestConfig = buildBudbeePostalValidationRequest(draft, config);

  console.log("📮 Budbee postal validation request");
  console.log("📮 Budbee mode:", config.mode);
  console.log("📮 Budbee URL:", requestConfig.url);

  try {
    const response = await axios(requestConfig);

    return {
      success: true,
      statusCode: response.status,
      serviced: true,
      senderAddresses: Array.isArray(response.data) ? response.data : [],
      raw: response.data
    };
  } catch (error) {
    const statusCode = error?.response?.status || 500;
    const responseBody = error?.response?.data || null;

    if (statusCode === 404) {
      return {
        success: false,
        statusCode,
        serviced: false,
        errorCode: "postal_code_not_serviced",
        error: "Budbee does not service this postal code",
        raw: responseBody
      };
    }

    if (statusCode === 401) {
      return {
        success: false,
        statusCode,
        serviced: false,
        errorCode: "budbee_auth_failed",
        error: "Budbee authentication failed",
        raw: responseBody
      };
    }

    if (statusCode === 403) {
      return {
        success: false,
        statusCode,
        serviced: false,
        errorCode: "budbee_postal_validation_forbidden",
        error: "Budbee rejected the postal validation request",
        raw: responseBody
      };
    }

    return {
      success: false,
      statusCode,
      serviced: false,
      errorCode: "budbee_postal_validation_failed",
      error: error.message || "Budbee postal validation failed",
      raw: responseBody
    };
  }
}

function pickDefaultCollectionId(postalValidationResult) {
  const senderAddresses = Array.isArray(postalValidationResult?.senderAddresses)
    ? postalValidationResult.senderAddresses
    : [];

  const defaultSender =
    senderAddresses.find((item) => item?.defaultCollectionPoint === true) ||
    senderAddresses[0] ||
    null;

  return defaultSender?.id || null;
}

async function createBudbeeShipment(order) {
  const readiness = getBudbeeShipmentReadiness(order);
  const config = readiness.config;
  const draft = readiness.draft;

  console.log("📦 Budbee shipment requested");
  console.log("📦 Budbee mode:", config.mode);
  console.log("📦 Budbee base URL configured:", Boolean(config.baseUrl));
  console.log(
    "📦 Budbee API credentials configured:",
    Boolean(config.apiKey && config.apiSecret)
  );

  if (!readiness.ready) {
    const readinessError = buildBudbeeReadinessError(readiness);

    console.log("❌ Budbee readiness failed");
    console.log("Reason:", readinessError.message);

    return {
      success: false,
      carrier: "budbee",
      mode: config.mode,
      draft,
      errorCode: readinessError.code,
      error: readinessError.message,
      missingRequirements: readiness.missingRequirements,
      configReadiness: readiness.configReadiness,
      draftValidation: readiness.draftValidation
    };
  }

  const postalValidation = await validateBudbeePostalCode(draft, config);

  if (!postalValidation.success) {
    console.log("❌ Budbee postal validation failed");
    console.log("Reason:", postalValidation.error);

    return {
      success: false,
      carrier: "budbee",
      mode: config.mode,
      draft,
      postalValidation,
      errorCode: postalValidation.errorCode || "budbee_postal_validation_failed",
      error: postalValidation.error || "Budbee postal validation failed",
      missingRequirements: [],
      configReadiness: readiness.configReadiness,
      draftValidation: readiness.draftValidation
    };
  }

  const collectionId = pickDefaultCollectionId(postalValidation);

  console.log("✅ Budbee postal validation passed");
  console.log("📦 Budbee sender address count:", postalValidation.senderAddresses.length);
  console.log("📦 Budbee default collectionId:", collectionId || "none");

  return {
    success: false,
    carrier: "budbee",
    mode: config.mode,
    draft,
    postalValidation,
    suggestedCollectionId: collectionId,
    errorCode: "budbee_order_request_not_implemented",
    error:
      "Budbee postal validation succeeded, but order creation is not implemented yet",
    missingRequirements: [],
    configReadiness: readiness.configReadiness,
    draftValidation: readiness.draftValidation
  };
}

module.exports = {
  getBudbeeConfig,
  getBudbeePublicConfig,
  normalizeBudbeePostalCode,
  buildBudbeeRecipient,
  buildBudbeeShipmentDraft,
  validateBudbeeDraft,
  getBudbeeConfigReadiness,
  getBudbeeShipmentReadiness,
  mapBudbeeReadinessErrorCode,
  buildBudbeeReadinessError,
  buildBudbeeAuthHeader,
  buildBudbeePostalValidationRequest,
  validateBudbeePostalCode,
  pickDefaultCollectionId,
  createBudbeeShipment
};
