const crypto = require("crypto");
const { resolveShopifyStoreCredentials } = require("./merchantStore");

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
  const hmacBuffer = Buffer.from(hmacHeader, "utf8");

  if (digestBuffer.length !== hmacBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuffer, hmacBuffer);
}

async function resolveShopifyWebhookSecret({
  shopDomain,
  merchantId
} = {}) {
  const credentials = await resolveShopifyStoreCredentials({
    shopDomain,
    merchantId
  });

  return {
    source: credentials.source,
    shop_domain: credentials.shop_domain,
    merchant_id: credentials.merchant_id,
    webhook_secret: credentials.webhook_secret || null
  };
}

module.exports = {
  verifyShopifyWebhook,
  resolveShopifyWebhookSecret
};
