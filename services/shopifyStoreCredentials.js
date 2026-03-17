const { query } = require("./db");

function normalizeShopDomain(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  return text || null;
}

async function getShopifyCredentialsByShopDomain(shopDomain) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);

  if (!normalizedShopDomain) {
    return null;
  }

  const result = await query(
    `
      SELECT
        shop_domain,
        merchant_id,
        is_active,
        shopify_admin_access_token,
        shopify_webhook_secret,
        created_at,
        updated_at
      FROM shopify_stores
      WHERE shop_domain = $1
      LIMIT 1
    `,
    [normalizedShopDomain]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    shop_domain: row.shop_domain,
    merchant_id: row.merchant_id,
    is_active: row.is_active === true,
    access_token: String(row.shopify_admin_access_token || "").trim() || null,
    webhook_secret: String(row.shopify_webhook_secret || "").trim() || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

module.exports = {
  normalizeShopDomain,
  getShopifyCredentialsByShopDomain
};
