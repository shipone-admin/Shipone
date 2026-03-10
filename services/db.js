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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      failed_at TIMESTAMPTZ
    )
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

  console.log("✅ PostgreSQL shipments table ready");
}

module.exports = {
  pool,
  query,
  initDatabase
};
