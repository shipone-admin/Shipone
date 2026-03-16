const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function initDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS shipments (
      id SERIAL PRIMARY KEY,
      order_id BIGINT UNIQUE NOT NULL,
      merchant_id TEXT NOT NULL DEFAULT 'default',
      shop_domain TEXT,
      order_name TEXT,
      order_number INTEGER,
      email TEXT,
      customer_name TEXT,
      shipping_city TEXT,
      shipping_zip TEXT,
      shipping_country TEXT,
      status TEXT,
      retry_count INTEGER DEFAULT 0,
      shipone_choice TEXT,
      selected_option JSONB,
      selected_carrier TEXT,
      selected_service TEXT,
      actual_carrier TEXT,
      fallback_used BOOLEAN DEFAULT false,
      fallback_from TEXT,
      tracking_number TEXT,
      tracking_url TEXT,
      shipment_success BOOLEAN DEFAULT false,
      fulfillment_success BOOLEAN DEFAULT false,
      shipment_result JSONB,
      fulfillment_result JSONB,
      error TEXT,
      carrier_status_text TEXT,
      carrier_last_event_at TIMESTAMPTZ,
      carrier_event_count INTEGER DEFAULT 0,
      carrier_last_synced_at TIMESTAMPTZ,
      carrier_next_sync_at TIMESTAMP,
      carrier_sync_attempts INTEGER DEFAULT 0,
      carrier_last_sync_status TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      failed_at TIMESTAMPTZ
    )
  `);

  await query(`
    ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS merchant_id TEXT NOT NULL DEFAULT 'default'
  `);

  await query(`
    ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS shop_domain TEXT
  `);

  await query(`
    ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS carrier_status_text TEXT
  `);

  await query(`
    ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS carrier_last_event_at TIMESTAMPTZ
  `);

  await query(`
    ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS carrier_event_count INTEGER DEFAULT 0
  `);

  await query(`
    ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS carrier_last_synced_at TIMESTAMPTZ
  `);

  await query(`
    ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS carrier_next_sync_at TIMESTAMP
  `);

  await query(`
    ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS carrier_sync_attempts INTEGER DEFAULT 0
  `);

  await query(`
    ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS carrier_last_sync_status TEXT
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_shipments_merchant_id
    ON shipments (merchant_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_shipments_shop_domain
    ON shipments (shop_domain)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS shopify_stores (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT NOT NULL UNIQUE,
      merchant_id TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_shopify_stores_merchant
        FOREIGN KEY (merchant_id)
        REFERENCES merchants (id)
        ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_merchants_status
    ON merchants (status)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_shopify_stores_merchant_id
    ON shopify_stores (merchant_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_shopify_stores_is_active
    ON shopify_stores (is_active)
  `);

  await query(`
    INSERT INTO merchants (id, name, status)
    VALUES ('default', 'Default Merchant', 'active')
    ON CONFLICT (id) DO NOTHING
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS merchant_carrier_settings (
      id SERIAL PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      carrier_key TEXT NOT NULL,
      shipments_enabled BOOLEAN NOT NULL DEFAULT true,
      rates_enabled BOOLEAN NOT NULL DEFAULT true,
      tracking_enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_merchant_carrier_settings_merchant
        FOREIGN KEY (merchant_id)
        REFERENCES merchants (id)
        ON DELETE CASCADE,
      CONSTRAINT uq_merchant_carrier_settings_unique
        UNIQUE (merchant_id, carrier_key)
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_merchant_carrier_settings_merchant_id
    ON merchant_carrier_settings (merchant_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_merchant_carrier_settings_carrier_key
    ON merchant_carrier_settings (carrier_key)
  `);

  await query(`
    INSERT INTO merchant_carrier_settings (
      merchant_id,
      carrier_key,
      shipments_enabled,
      rates_enabled,
      tracking_enabled
    )
    VALUES
      ('default', 'postnord', true, true, true),
      ('default', 'dhl', true, true, true),
      ('default', 'budbee', true, true, true)
    ON CONFLICT (merchant_id, carrier_key) DO NOTHING
  `);

  console.log("✅ PostgreSQL shipments table ready");
  console.log("✅ Merchant registry tables ready");
  console.log("✅ Merchant carrier settings table ready");
}

module.exports = {
  pool,
  query,
  initDatabase
};
