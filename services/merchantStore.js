const { query } = require("./db");

function normalizeMerchantId(value) {
  const text = String(value || "").trim().toLowerCase();
  return text || "default";
}

function normalizeShopDomain(value) {
  const text = String(value || "").trim().toLowerCase();
  return text || null;
}

function buildMerchantIdFromShopDomain(shopDomain) {
  const normalized = normalizeShopDomain(shopDomain);

  if (!normalized) {
    return null;
  }

  return normalized
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9.-]/g, "-");
}

async function findMerchantByShopDomain(shopDomain) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);

  if (!normalizedShopDomain) {
    return null;
  }

  const result = await query(
    `
      SELECT
        s.shop_domain,
        s.merchant_id,
        s.is_active,
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

async function upsertShopifyStore({ shop_domain, merchant_id, is_active = true }) {
  const normalizedShopDomain = normalizeShopDomain(shop_domain);
  const normalizedMerchantId = normalizeMerchantId(merchant_id);

  if (!normalizedShopDomain) {
    throw new Error("Missing shop domain");
  }

  if (!normalizedMerchantId) {
    throw new Error("Missing merchant id");
  }

  const result = await query(
    `
      INSERT INTO shopify_stores (
        shop_domain,
        merchant_id,
        is_active,
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
      ON CONFLICT (shop_domain)
      DO UPDATE SET
        merchant_id = EXCLUDED.merchant_id,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING *
    `,
    [normalizedShopDomain, normalizedMerchantId, Boolean(is_active)]
  );

  return result.rows[0] || null;
}

module.exports = {
  normalizeMerchantId,
  normalizeShopDomain,
  buildMerchantIdFromShopDomain,
  findMerchantByShopDomain,
  resolveMerchantContext,
  upsertMerchant,
  upsertShopifyStore
};
