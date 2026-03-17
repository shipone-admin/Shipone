const { query } = require("./db");

function normalizeMerchantId(value) {
  const text = String(value || "").trim().toLowerCase();
  return text || "default";
}

function normalizeShopDomain(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  return text || null;
}

function buildMerchantIdFromShopDomain(shopDomain) {
  const normalized = normalizeShopDomain(shopDomain);

  if (!normalized) {
    return null;
  }

  return normalized.replace(/[^a-z0-9.-]/g, "-");
}

function maskSecret(value) {
  const text = String(value || "").trim();

  if (!text) {
    return null;
  }

  if (text.length <= 8) {
    return "********";
  }

  return `${text.slice(0, 4)}********${text.slice(-4)}`;
}

async function findMerchantByShopDomain(shopDomain) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);

  if (!normalizedShopDomain) {
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
    [normalizedShopDomain]
  );

  return result.rows[0] || null;
}

async function resolveMerchantContext({
  explicitMerchantId,
  shopDomain,
  defaultMerchantId = "default"
} = {}) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);
  const normalizedExplicitMerchantId = normalizeMerchantId(explicitMerchantId);
  const normalizedDefaultMerchantId = normalizeMerchantId(defaultMerchantId);

  if (normalizedShopDomain) {
    const storeRecord = await findMerchantByShopDomain(normalizedShopDomain);

    if (
      storeRecord &&
      storeRecord.is_active === true &&
      String(storeRecord.merchant_status || "").toLowerCase() === "active"
    ) {
      return {
        merchant_id: normalizeMerchantId(storeRecord.merchant_id),
        shop_domain: normalizedShopDomain,
        source: "registry",
        merchant_name: storeRecord.merchant_name || null
      };
    }
  }

  if (normalizedExplicitMerchantId && normalizedExplicitMerchantId !== "default") {
    return {
      merchant_id: normalizedExplicitMerchantId,
      shop_domain: normalizedShopDomain,
      source: "explicit",
      merchant_name: null
    };
  }

  return {
    merchant_id:
      buildMerchantIdFromShopDomain(normalizedShopDomain) || normalizedDefaultMerchantId,
    shop_domain: normalizedShopDomain,
    source: normalizedShopDomain ? "shop_domain_fallback" : "default_fallback",
    merchant_name: null
  };
}

async function resolveShopifyStoreCredentials({
  shopDomain,
  merchantId
} = {}) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);
  const normalizedMerchantId = normalizeMerchantId(merchantId);

  if (normalizedShopDomain) {
    const store = await findMerchantByShopDomain(normalizedShopDomain);

    if (store && store.is_active === true) {
      return {
        source: "store_registry",
        shop_domain: normalizeShopDomain(store.shop_domain),
        merchant_id: normalizeMerchantId(store.merchant_id),
        access_token: String(store.shopify_admin_access_token || "").trim() || null,
        webhook_secret: String(store.shopify_webhook_secret || "").trim() || null,
        is_active: Boolean(store.is_active)
      };
    }
  }

  if (normalizedMerchantId && normalizedMerchantId !== "default") {
    const result = await query(
      `
        SELECT
          s.shop_domain,
          s.merchant_id,
          s.is_active,
          s.shopify_admin_access_token,
          s.shopify_webhook_secret
        FROM shopify_stores s
        WHERE s.merchant_id = $1
          AND s.is_active = true
        ORDER BY s.id ASC
        LIMIT 1
      `,
      [normalizedMerchantId]
    );

    const row = result.rows[0] || null;

    if (row) {
      return {
        source: "merchant_store_fallback",
        shop_domain: normalizeShopDomain(row.shop_domain),
        merchant_id: normalizeMerchantId(row.merchant_id),
        access_token: String(row.shopify_admin_access_token || "").trim() || null,
        webhook_secret: String(row.shopify_webhook_secret || "").trim() || null,
        is_active: Boolean(row.is_active)
      };
    }
  }

  return {
    source: "env_fallback",
    shop_domain: normalizeShopDomain(process.env.SHOPIFY_STORE_URL || ""),
    merchant_id: normalizedMerchantId || "default",
    access_token: String(process.env.SHOPIFY_ACCESS_TOKEN || "").trim() || null,
    webhook_secret: String(process.env.SHOPIFY_WEBHOOK_SECRET || "").trim() || null,
    is_active: true
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
  shopify_admin_access_token,
  shopify_webhook_secret
}) {
  const normalizedShopDomain = normalizeShopDomain(shop_domain);
  const normalizedMerchantId = normalizeMerchantId(merchant_id);

  if (!normalizedShopDomain) {
    throw new Error("Missing shop domain");
  }

  if (!normalizedMerchantId) {
    throw new Error("Missing merchant id");
  }

  const accessToken =
    shopify_admin_access_token !== undefined
      ? String(shopify_admin_access_token || "").trim() || null
      : null;

  const webhookSecret =
    shopify_webhook_secret !== undefined
      ? String(shopify_webhook_secret || "").trim() || null
      : null;

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
      normalizedShopDomain,
      normalizedMerchantId,
      Boolean(is_active),
      accessToken,
      webhookSecret
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

  return result.rows.map((row) => ({
    ...row,
    shopify_admin_access_token_masked: maskSecret(row.shopify_admin_access_token),
    shopify_webhook_secret_masked: maskSecret(row.shopify_webhook_secret)
  }));
}

module.exports = {
  normalizeMerchantId,
  normalizeShopDomain,
  buildMerchantIdFromShopDomain,
  findMerchantByShopDomain,
  resolveMerchantContext,
  resolveShopifyStoreCredentials,
  upsertMerchant,
  upsertShopifyStore,
  listMerchants,
  listShopifyStores
};
