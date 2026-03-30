// ========================================
// DHL FREIGHT SERVICE
// STEP 1: FREIGHT TOKEN TEST
// ========================================

const fetch = require("node-fetch");

function getDHLFreightConfig() {
  return {
    carrier: "dhl",
    label: "DHL Freight",
    mode: String(process.env.DHL_MODE || "sandbox").trim().toLowerCase(),
    apiKey: String(process.env.DHL_API_KEY || "").trim(),
    apiSecret: String(process.env.DHL_API_SECRET || "").trim(),
    sandboxBaseUrl: "https://api-sandbox.dhl.com/freight/shipping/orders/v1",
    productionBaseUrl: "https://api.dhl.com/freight/shipping/orders/v1"
  };
}

function getDHLFreightBaseUrl(config) {
  if (config.mode === "production") {
    return config.productionBaseUrl;
  }

  return config.sandboxBaseUrl;
}

function getDHLFreightPublicConfig() {
  const config = getDHLFreightConfig();

  return {
    carrier: config.carrier,
    label: config.label,
    mode: config.mode,
    hasApiKey: Boolean(config.apiKey),
    hasApiSecret: Boolean(config.apiSecret),
    baseUrl: getDHLFreightBaseUrl(config)
  };
}

async function getDHLFreightBearerToken() {
  const config = getDHLFreightConfig();

  if (!config.apiKey || !config.apiSecret) {
    throw new Error("DHL Freight credentials missing");
  }

  const tokenUrl = `${getDHLFreightBaseUrl(config)}/token`;

  const basicAuth = Buffer.from(
    `${config.apiKey}:${config.apiSecret}`,
    "utf8"
  ).toString("base64");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: "grant_type=client_credentials"
  });

  const responseText = await response.text();

  let parsed = null;

  try {
    parsed = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    parsed = null;
  }

  if (!response.ok) {
    const message =
      parsed?.error_description ||
      parsed?.error ||
      responseText ||
      `DHL Freight token request failed with status ${response.status}`;

    const authError = new Error(message);
    authError.statusCode = response.status;
    authError.raw = parsed || responseText;
    throw authError;
  }

  const accessToken =
    parsed?.access_token ||
    parsed?.token ||
    null;

  if (!accessToken) {
    const tokenError = new Error("DHL Freight token missing in response");
    tokenError.statusCode = response.status;
    tokenError.raw = parsed || responseText;
    throw tokenError;
  }

  return {
    success: true,
    accessToken,
    tokenType: parsed?.token_type || "Bearer",
    expiresIn: parsed?.expires_in || null,
    raw: parsed || responseText
  };
}

function buildDHLFreightDraft(order) {
  const safeOrder = order || {};
  const shippingAddress = safeOrder.shipping_address || {};
  const customer = safeOrder.customer || {};

  const firstName = String(
    shippingAddress.first_name ||
      customer.first_name ||
      ""
  ).trim();

  const lastName = String(
    shippingAddress.last_name ||
      customer.last_name ||
      ""
  ).trim();

  const customerName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    orderId: String(safeOrder.id || "").trim() || null,
    orderName: String(safeOrder.name || "").trim() || null,
    customerName: customerName || null,
    email: String(safeOrder.email || customer.email || "").trim() || null,
    city: String(shippingAddress.city || "").trim() || null,
    zip: String(shippingAddress.zip || "").trim() || null,
    country: String(
      shippingAddress.country_code ||
        shippingAddress.country ||
        ""
    ).trim() || null
  };
}

async function createDHLShipment(order) {
  console.log("📦 DHL Freight token test start");

  const config = getDHLFreightConfig();
  const draft = buildDHLFreightDraft(order);

  if (!config.apiKey || !config.apiSecret) {
    throw new Error("DHL Freight credentials missing");
  }

  const tokenResult = await getDHLFreightBearerToken();

  console.log("✅ DHL Freight bearer token received");

  return {
    success: true,
    carrier: "dhl",
    mode: "freight_token_test",
    data: {
      trackingNumber: "DHL" + Date.now(),
      trackingUrl: null
    },
    debug: {
      config: getDHLFreightPublicConfig(),
      token: {
        received: true,
        tokenType: tokenResult.tokenType,
        expiresIn: tokenResult.expiresIn
      },
      orderDraft: draft,
      nextStep:
        "Freight bearer token works. Next step is building POST /sendtransportinstruction payload."
    }
  };
}

module.exports = {
  createDHLShipment,
  getDHLFreightConfig,
  getDHLFreightPublicConfig,
  getDHLFreightBearerToken
};
