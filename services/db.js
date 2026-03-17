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
      merchant_id TEXT DEFAULT 'default',
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
      carrier_next_sync_at TIMESTAMPTZ,
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
    ADD COLUMN IF NOT EXISTS merchant_id TEXT DEFAULT 'default'
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
    ADD COLUMN IF NOT EXISTS carrier_next_sync_at TIMESTAMPTZ
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
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS shopify_stores (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT UNIQUE NOT NULL,
      merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      is_active BOOLEAN NOT NULL DEFAULT true,
      shopify_admin_access_token TEXT,
      shopify_webhook_secret TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    ALTER TABLE shopify_stores
    ADD COLUMN IF NOT EXISTS shopify_admin_access_token TEXT
  `);

  await query(`
    ALTER TABLE shopify_stores
    ADD COLUMN IF NOT EXISTS shopify_webhook_secret TEXT
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS merchant_carrier_settings (
      id SERIAL PRIMARY KEY,
      merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      carrier_key TEXT NOT NULL,
      shipments_enabled BOOLEAN NOT NULL DEFAULT true,
      rates_enabled BOOLEAN NOT NULL DEFAULT true,
      tracking_enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (merchant_id, carrier_key)
    )
  `);

  await query(`
    INSERT INTO merchants (id, name, status, created_at, updated_at)
    VALUES ('default', 'Default Merchant', 'active', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  console.log("✅ PostgreSQL tables ready");
}

module.exports = {
  pool,
  query,
  initDatabase
};
