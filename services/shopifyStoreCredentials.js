const { query } = require("./db");

async function getShopifyCredentialsByShopDomain(shopDomain) {
  if (!shopDomain) {
    return null;
  }

  const result = await query(
    `
      SELECT
        shop_domain,
        shopify_admin_access_token,
        shopify_webhook_secret,
        is_active
      FROM shopify_stores
      WHERE shop_domain = $1
      LIMIT 1
    `,
    [String(shopDomain).toLowerCase()]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    shop_domain: row.shop_domain,
    access_token: row.shopify_admin_access_token,
    webhook_secret: row.shopify_webhook_secret,
    is_active: row.is_active === true
  };
}

module.exports = {
  getShopifyCredentialsByShopDomain
};
