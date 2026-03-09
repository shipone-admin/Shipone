// ================================
// SHOPIFY WEBHOOK HMAC VERIFICATION
// ================================

const crypto = require("crypto");

function verifyShopifyWebhook(rawBody, hmacHeader, secret) {
  if (!rawBody || !hmacHeader || !secret) {
    return false;
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  const generatedBuffer = Buffer.from(digest, "utf8");
  const receivedBuffer = Buffer.from(hmacHeader, "utf8");

  if (generatedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(generatedBuffer, receivedBuffer);
}

module.exports = { verifyShopifyWebhook };
