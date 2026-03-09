// ================================
// SHOPIFY WEBHOOK HMAC VERIFICATION
// BUFFER-SAFE VERSION
// ================================

const crypto = require("crypto");

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

module.exports = { verifyShopifyWebhook };
