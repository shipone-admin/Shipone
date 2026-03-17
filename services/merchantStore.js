const { query } = require("./db");

function normalizeShopDomain(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  return text || null;
}

function normalizeMerchantId(value) {
  let text = String(value || "").trim().toLowerCase();

  if (!text) {
    return "default";
  }

  text = text
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  if (text.endsWith(".myshopify.com")) {
    text = text.slice(0, -".myshopify.com".length);
  }

  text = text
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return text || "default";
}

function buildMerchantIdFromShopDomain(shopDomain) {
  const normalized = normalizeShopDomain(shopDomain);

  if (!normalized) {
    return "default";
  }

  let merchantId = normalized;

  if (merchantId.endsWith(".myshopify.com")) {
    merchantId = merchantId.slice(0, -".myshopify.com".length);
  }

  merchantId = merchantId
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return merchantId || "default";
}

async function findMerchantById(merchantId) {
  const safeMerchantId = normalizeMerchantId(merchantId);

  const result = await query(
    `
      SELECT
        id,
        name,
        status,
        created_at,
        updated_at
      FROM merchants
      WHERE id = $1
      LIMIT 1
    `,
    [safeMerchantId]
  );

  return result.rows[0] || null;
}

async function findMerchantByShopDomain(shopDomain) {
  const safeShopDomain = normalizeShopDomain(shopDomain);

  if (!safeShopDomain) {
    return null;
  }

  const result = await query(
    `
      SELECT
        s.id,
        s.shop_domain,
        s.merchant_id,
        s.is_active,
        s.shopify_admin_access_token,
        s.shopify_webhook_secret,
        s.created_at,
        s.updated_at,
        m.name AS merchant_name,
        m.status AS merchant_status
      FROM shopify_stores s
      INNER JOIN merchants m
        ON m.id = s.merchant_id
      WHERE s.shop_domain = $1
      LIMIT 1
    `,
    [safeShopDomain]
  );

  return result.rows[0] || null;
}

async function resolveMerchantContext({
  explicitMerchantId,
  shopDomain,
  defaultMerchantId = "default"
} = {}) {
  const safeShopDomain = normalizeShopDomain(shopDomain);
  const safeExplicitMerchantId = normalizeMerchantId(explicitMerchantId);
  const safeDefaultMerchantId = normalizeMerchantId(defaultMerchantId);

  if (safeShopDomain) {
    const storeRecord = await findMerchantByShopDomain(safeShopDomain);

    if (
      storeRecord &&
      storeRecord.is_active === true &&
      String(storeRecord.merchant_status || "").toLowerCase() === "active"
    ) {
      return {
        merchant_id: normalizeMerchantId(storeRecord.merchant_id),
        shop_domain: safeShopDomain,
        source: "registry",
        merchant_name: storeRecord.merchant_name || null
      };
    }
  }

  if (safeExplicitMerchantId && safeExplicitMerchantId !== "default") {
    return {
      merchant_id: safeExplicitMerchantId,
      shop_domain: safeShopDomain,
      source: "explicit",
      merchant_name: null
    };
  }

  if (safeShopDomain) {
    return {
      merchant_id: buildMerchantIdFromShopDomain(safeShopDomain),
      shop_domain: safeShopDomain,
      source: "shop_domain_fallback",
      merchant_name: null
    };
  }

  return {
    merchant_id: safeDefaultMerchantId,
    shop_domain: null,
    source: "default_fallback",
    merchant_name: null
  };
}

async function upsertMerchant({ id, name, status = "active" }) {
  const merchantId = normalizeMerchantId(id);

  if (!merchantId) {
    throw new Error("Missing merchant id");
  }

  const merchantName = String(name || merchantId).trim() || merchantId;
  const merchantStatus = String(status || "active").trim().toLowerCase() || "active";

  const result = await query(
    `
      INSERT INTO merchants (
        id,
        name,
        status,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        NOW(),
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *
    `,
    [merchantId, merchantName, merchantStatus]
  );

  return result.rows[0] || null;
}

async function upsertShopifyStore({
  shop_domain,
  merchant_id,
  is_active = true,
  shopify_admin_access_token = null,
  shopify_webhook_secret = null
}) {
  const safeShopDomain = normalizeShopDomain(shop_domain);
  const safeMerchantId = normalizeMerchantId(merchant_id);

  if (!safeShopDomain) {
    throw new Error("Missing shop domain");
  }

  if (!safeMerchantId) {
    throw new Error("Missing merchant id");
  }

  await upsertMerchant({
    id: safeMerchantId,
    name: safeMerchantId,
    status: "active"
  });

  const result = await query(
    `
      INSERT INTO shopify_stores (
        shop_domain,
        merchant_id,
        is_active,
        shopify_admin_access_token,
        shopify_webhook_secret,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        NOW(),
        NOW()
      )
      ON CONFLICT (shop_domain)
      DO UPDATE SET
        merchant_id = EXCLUDED.merchant_id,
        is_active = EXCLUDED.is_active,
        shopify_admin_access_token = COALESCE(EXCLUDED.shopify_admin_access_token, shopify_stores.shopify_admin_access_token),
        shopify_webhook_secret = COALESCE(EXCLUDED.shopify_webhook_secret, shopify_stores.shopify_webhook_secret),
        updated_at = NOW()
      RETURNING *
    `,
    [
      safeShopDomain,
      safeMerchantId,
      Boolean(is_active),
      shopify_admin_access_token ? String(shopify_admin_access_token).trim() : null,
      shopify_webhook_secret ? String(shopify_webhook_secret).trim() : null
    ]
  );

  return result.rows[0] || null;
}

async function listMerchants() {
  const result = await query(
    `
      SELECT
        m.id,
        m.name,
        m.status,
        m.created_at,
        m.updated_at,
        COUNT(s.id)::int AS store_count
      FROM merchants m
      LEFT JOIN shopify_stores s
        ON s.merchant_id = m.id
      GROUP BY
        m.id,
        m.name,
        m.status,
        m.created_at,
        m.updated_at
      ORDER BY
        m.created_at DESC,
        m.id ASC
    `
  );

  return result.rows;
}

async function listShopifyStores() {
  const result = await query(
    `
      SELECT
        s.id,
        s.shop_domain,
        s.merchant_id,
        s.is_active,
        s.shopify_admin_access_token,
        s.shopify_webhook_secret,
        s.created_at,
        s.updated_at,
        m.name AS merchant_name,
        m.status AS merchant_status
      FROM shopify_stores s
      INNER JOIN merchants m
        ON m.id = s.merchant_id
      ORDER BY
        s.created_at DESC,
        s.id DESC
    `
  );

  return result.rows;
}

async function resolveShopifyStoreCredentials({
  shopDomain,
  merchantId
} = {}) {
  const safeShopDomain = normalizeShopDomain(shopDomain);
  const safeMerchantId = normalizeMerchantId(merchantId);

  if (safeShopDomain) {
    const storeByDomain = await findMerchantByShopDomain(safeShopDomain);

    if (storeByDomain && storeByDomain.is_active === true) {
      return {
        source: "store_registry",
        shop_domain: storeByDomain.shop_domain,
        merchant_id: normalizeMerchantId(storeByDomain.merchant_id),
        access_token: String(storeByDomain.shopify_admin_access_token || "").trim() || null,
        webhook_secret: String(storeByDomain.shopify_webhook_secret || "").trim() || null
      };
    }
  }

  if (safeMerchantId && safeMerchantId !== "default") {
    const result = await query(
      `
        SELECT
          shop_domain,
          merchant_id,
          is_active,
          shopify_admin_access_token,
          shopify_webhook_secret
        FROM shopify_stores
        WHERE merchant_id = $1
        ORDER BY id ASC
        LIMIT 1
      `,
      [safeMerchantId]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];

      return {
        source: "merchant_registry",
        shop_domain: row.shop_domain,
        merchant_id: normalizeMerchantId(row.merchant_id),
        access_token: String(row.shopify_admin_access_token || "").trim() || null,
        webhook_secret: String(row.shopify_webhook_secret || "").trim() || null
      };
    }
  }

  return {
    source: "env_fallback",
    shop_domain: safeShopDomain,
    merchant_id: safeMerchantId || "default",
    access_token: String(process.env.SHOPIFY_ACCESS_TOKEN || "").trim() || null,
    webhook_secret: String(process.env.SHOPIFY_API_SECRET || "").trim() || null
  };
}

module.exports = {
  normalizeMerchantId,
  normalizeShopDomain,
  buildMerchantIdFromShopDomain,
  findMerchantById,
  findMerchantByShopDomain,
  resolveMerchantContext,
  upsertMerchant,
  upsertShopifyStore,
  listMerchants,
  listShopifyStores,
  resolveShopifyStoreCredentials
};
