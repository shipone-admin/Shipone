// ================================
// SHIPONE DATABASE
// POSTGRES VERSION
// ================================

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL is missing");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? {
        rejectUnauthorized: false
      }
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
      status TEXT NOT NULL DEFAULT 'processing',
      retry_count INTEGER NOT NULL DEFAULT 0,
      shipone_choice TEXT,
      selected_option JSONB,
      selected_carrier TEXT,
      selected_service TEXT,
      actual_carrier TEXT,
      fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
      fallback_from TEXT,
      tracking_number TEXT,
      tracking_url TEXT,
      shipment_success BOOLEAN NOT NULL DEFAULT FALSE,
      fulfillment_success BOOLEAN NOT NULL DEFAULT FALSE,
      shipment_result JSONB,
      fulfillment_result JSONB,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      failed_at TIMESTAMPTZ
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_shipments_order_id
    ON shipments(order_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_shipments_status
    ON shipments(status);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_shipments_updated_at
    ON shipments(updated_at DESC);
  `);

  console.log("✅ PostgreSQL shipments table ready");
}

module.exports = {
  pool,
  query,
  initDatabase
};
