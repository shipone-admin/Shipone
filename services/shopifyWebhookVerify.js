const crypto = require("crypto");
const {
  getShopifyCredentialsByShopDomain,
  normalizeShopDomain
} = require("./shopifyStoreCredentials");

function verifyShopifyWebhook(rawBodyBuffer, hmacHeader, secret) {
  if (!rawBodyBuffer || !Buffer.isBuffer(rawBodyBuffer)) {
    return false;
  }

  if (!hmacHeader || !secret) {
    return false;
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBodyBuffer)
    .digest("base64");

  const digestBuffer = Buffer.from(digest, "utf8");
  const hmacBuffer = Buffer.from(String(hmacHeader || "").trim(), "utf8");

  if (digestBuffer.length !== hmacBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuffer, hmacBuffer);
}

async function resolveShopifyWebhookSecret({ shopDomain } = {}) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);

  if (normalizedShopDomain) {
    const storeCredentials = await getShopifyCredentialsByShopDomain(
      normalizedShopDomain
    );

    if (
      storeCredentials &&
      storeCredentials.is_active &&
      storeCredentials.webhook_secret
    ) {
      return {
        source: "store_registry",
        shop_domain: storeCredentials.shop_domain,
        merchant_id: storeCredentials.merchant_id || null,
        webhook_secret: storeCredentials.webhook_secret
      };
    }
  }

  const fallbackSecret = String(process.env.SHOPIFY_API_SECRET || "").trim();

  return {
    source: "env_fallback",
    shop_domain: normalizedShopDomain,
    merchant_id: null,
    webhook_secret: fallbackSecret || null
  };
}

module.exports = {
  verifyShopifyWebhook,
  resolveShopifyWebhookSecret
};
