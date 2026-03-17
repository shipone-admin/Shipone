const { query } = require("./db");

const SUPPORTED_CARRIERS = ["postnord", "dhl", "budbee"];

function normalizeMerchantId(value) {
  const text = String(value || "").trim().toLowerCase();
  return text || "default";
}

function normalizeCarrierKey(value) {
  const text = String(value || "").trim().toLowerCase();
  return text || null;
}

function isSupportedCarrier(carrierKey) {
  return SUPPORTED_CARRIERS.includes(normalizeCarrierKey(carrierKey));
}

/**
 * 🔥 NY: säkerställ att merchant finns innan vi använder den
 */
async function ensureMerchantExists(merchantId) {
  const safeMerchantId = normalizeMerchantId(merchantId);

  await query(
    `
      INSERT INTO merchants (id, name, status, created_at, updated_at)
      VALUES ($1, $2, 'active', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `,
    [safeMerchantId, safeMerchantId]
  );

  return safeMerchantId;
}

async function ensureMerchantCarrierDefaults(merchantId) {
  const safeMerchantId = await ensureMerchantExists(merchantId);

  for (const carrierKey of SUPPORTED_CARRIERS) {
    await query(
      `
        INSERT INTO merchant_carrier_settings (
          merchant_id,
          carrier_key,
          shipments_enabled,
          rates_enabled,
          tracking_enabled,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          true,
          true,
          true,
          NOW(),
          NOW()
        )
        ON CONFLICT (merchant_id, carrier_key) DO NOTHING
      `,
      [safeMerchantId, carrierKey]
    );
  }
}

async function listMerchantCarrierSettings() {
  const result = await query(`
    SELECT
      s.id,
      s.merchant_id,
      s.carrier_key,
      s.shipments_enabled,
      s.rates_enabled,
      s.tracking_enabled,
      s.created_at,
      s.updated_at,
      m.name AS merchant_name,
      m.status AS merchant_status
    FROM merchant_carrier_settings s
    INNER JOIN merchants m
      ON m.id = s.merchant_id
    ORDER BY s.merchant_id ASC, s.carrier_key ASC
  `);

  return result.rows;
}

async function listMerchantCarrierSettingsByMerchantId(merchantId) {
  const safeMerchantId = normalizeMerchantId(merchantId);

  await ensureMerchantCarrierDefaults(safeMerchantId);

  const result = await query(
    `
      SELECT *
      FROM merchant_carrier_settings
      WHERE merchant_id = $1
      ORDER BY carrier_key ASC
    `,
    [safeMerchantId]
  );

  return result.rows;
}

async function getMerchantCarrierMatrix() {
  const result = await query(`
    SELECT
      m.id AS merchant_id,
      m.name AS merchant_name,
      m.status AS merchant_status,
      c.carrier_key,
      COALESCE(s.shipments_enabled, true) AS shipments_enabled,
      COALESCE(s.rates_enabled, true) AS rates_enabled,
      COALESCE(s.tracking_enabled, true) AS tracking_enabled
    FROM merchants m
    CROSS JOIN (
      SELECT UNNEST(ARRAY['postnord', 'dhl', 'budbee']) AS carrier_key
    ) c
    LEFT JOIN merchant_carrier_settings s
      ON s.merchant_id = m.id
     AND s.carrier_key = c.carrier_key
    ORDER BY m.id ASC, c.carrier_key ASC
  `);

  return result.rows;
}

async function getMerchantCarrierSettingsMap(merchantId) {
  const safeMerchantId = normalizeMerchantId(merchantId);

  await ensureMerchantCarrierDefaults(safeMerchantId);

  const result = await query(
    `
      SELECT
        carrier_key,
        shipments_enabled,
        rates_enabled,
        tracking_enabled
      FROM merchant_carrier_settings
      WHERE merchant_id = $1
    `,
    [safeMerchantId]
  );

  const map = {};

  for (const carrierKey of SUPPORTED_CARRIERS) {
    map[carrierKey] = {
      carrier_key: carrierKey,
      shipments_enabled: true,
      rates_enabled: true,
      tracking_enabled: true
    };
  }

  for (const row of result.rows) {
    const key = normalizeCarrierKey(row.carrier_key);

    if (!key) continue;

    map[key] = {
      carrier_key: key,
      shipments_enabled: Boolean(row.shipments_enabled),
      rates_enabled: Boolean(row.rates_enabled),
      tracking_enabled: Boolean(row.tracking_enabled)
    };
  }

  return map;
}

async function getEnabledShipmentCarriersForMerchant(merchantId) {
  const settingsMap = await getMerchantCarrierSettingsMap(merchantId);

  return SUPPORTED_CARRIERS.filter(
    (carrierKey) => settingsMap[carrierKey]?.shipments_enabled !== false
  );
}

async function getEnabledRateCarriersForMerchant(merchantId) {
  const settingsMap = await getMerchantCarrierSettingsMap(merchantId);

  return SUPPORTED_CARRIERS.filter(
    (carrierKey) => settingsMap[carrierKey]?.rates_enabled !== false
  );
}

async function getEnabledTrackingCarriersForMerchant(merchantId) {
  const settingsMap = await getMerchantCarrierSettingsMap(merchantId);

  return SUPPORTED_CARRIERS.filter(
    (carrierKey) => settingsMap[carrierKey]?.tracking_enabled !== false
  );
}

async function isShipmentCarrierEnabledForMerchant(merchantId, carrierKey) {
  const normalizedCarrierKey = normalizeCarrierKey(carrierKey);

  if (!normalizedCarrierKey || !isSupportedCarrier(normalizedCarrierKey)) {
    return false;
  }

  const settingsMap = await getMerchantCarrierSettingsMap(merchantId);

  return settingsMap[normalizedCarrierKey]?.shipments_enabled !== false;
}

async function isRateCarrierEnabledForMerchant(merchantId, carrierKey) {
  const normalizedCarrierKey = normalizeCarrierKey(carrierKey);

  if (!normalizedCarrierKey || !isSupportedCarrier(normalizedCarrierKey)) {
    return false;
  }

  const settingsMap = await getMerchantCarrierSettingsMap(merchantId);

  return settingsMap[normalizedCarrierKey]?.rates_enabled !== false;
}

async function isTrackingCarrierEnabledForMerchant(merchantId, carrierKey) {
  const normalizedCarrierKey = normalizeCarrierKey(carrierKey);

  if (!normalizedCarrierKey || !isSupportedCarrier(normalizedCarrierKey)) {
    return false;
  }

  const settingsMap = await getMerchantCarrierSettingsMap(merchantId);

  return settingsMap[normalizedCarrierKey]?.tracking_enabled !== false;
}

async function upsertMerchantCarrierSetting({
  merchant_id,
  carrier_key,
  shipments_enabled = true,
  rates_enabled = true,
  tracking_enabled = true
}) {
  const safeMerchantId = await ensureMerchantExists(merchant_id);
  const safeCarrierKey = normalizeCarrierKey(carrier_key);

  if (!safeCarrierKey) {
    throw new Error("Missing carrier key");
  }

  if (!isSupportedCarrier(safeCarrierKey)) {
    throw new Error(`Unsupported carrier key: ${safeCarrierKey}`);
  }

  const result = await query(
    `
      INSERT INTO merchant_carrier_settings (
        merchant_id,
        carrier_key,
        shipments_enabled,
        rates_enabled,
        tracking_enabled,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (merchant_id, carrier_key)
      DO UPDATE SET
        shipments_enabled = EXCLUDED.shipments_enabled,
        rates_enabled = EXCLUDED.rates_enabled,
        tracking_enabled = EXCLUDED.tracking_enabled,
        updated_at = NOW()
      RETURNING *
    `,
    [
      safeMerchantId,
      safeCarrierKey,
      Boolean(shipments_enabled),
      Boolean(rates_enabled),
      Boolean(tracking_enabled)
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  SUPPORTED_CARRIERS,
  normalizeMerchantId,
  normalizeCarrierKey,
  isSupportedCarrier,
  ensureMerchantCarrierDefaults,
  listMerchantCarrierSettings,
  listMerchantCarrierSettingsByMerchantId,
  getMerchantCarrierMatrix,
  getMerchantCarrierSettingsMap,
  getEnabledShipmentCarriersForMerchant,
  getEnabledRateCarriersForMerchant,
  getEnabledTrackingCarriersForMerchant,
  isShipmentCarrierEnabledForMerchant,
  isRateCarrierEnabledForMerchant,
  isTrackingCarrierEnabledForMerchant,
  upsertMerchantCarrierSetting
};
