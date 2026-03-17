const { query } = require("./db");
const {
  normalizeMerchantId,
  normalizeShopDomain,
  buildMerchantIdFromShopDomain,
  findMerchantByShopDomain,
  upsertMerchant
} = require("./merchantStore");

async function loadAllShipments() {
  const result = await query(
    `
      SELECT
        id,
        order_id,
        merchant_id,
        shop_domain,
        order_name,
        tracking_number,
        created_at
      FROM shipments
      ORDER BY created_at ASC, id ASC
    `
  );

  return result.rows;
}

async function resolveCanonicalMerchantIdForShipment(shipment) {
  const safeShopDomain = normalizeShopDomain(shipment.shop_domain);
  const currentMerchantId = normalizeMerchantId(shipment.merchant_id);

  if (safeShopDomain) {
    const storeRecord = await findMerchantByShopDomain(safeShopDomain);

    if (storeRecord && storeRecord.merchant_id) {
      return normalizeMerchantId(storeRecord.merchant_id);
    }

    return buildMerchantIdFromShopDomain(safeShopDomain);
  }

  return currentMerchantId || "default";
}

async function migrateShipmentMerchantIds() {
  const shipments = await loadAllShipments();

  let scanned = 0;
  let updated = 0;
  let unchanged = 0;
  const changes = [];

  for (const shipment of shipments) {
    scanned += 1;

    const rawBeforeMerchantId = String(shipment.merchant_id || "").trim();
    const canonicalAfterMerchantId = await resolveCanonicalMerchantIdForShipment(
      shipment
    );

    await upsertMerchant({
      id: canonicalAfterMerchantId,
      name: canonicalAfterMerchantId,
      status: "active"
    });

    if (rawBeforeMerchantId === canonicalAfterMerchantId) {
      unchanged += 1;
      continue;
    }

    await query(
      `
        UPDATE shipments
        SET
          merchant_id = $2,
          updated_at = NOW()
        WHERE id = $1
      `,
      [shipment.id, canonicalAfterMerchantId]
    );

    updated += 1;

    changes.push({
      id: shipment.id,
      order_id: shipment.order_id,
      order_name: shipment.order_name || null,
      tracking_number: shipment.tracking_number || null,
      shop_domain: shipment.shop_domain || null,
      merchant_id_before: rawBeforeMerchantId,
      merchant_id_after: canonicalAfterMerchantId
    });
  }

  return {
    success: true,
    scanned,
    updated,
    unchanged,
    changes
  };
}

module.exports = {
  migrateShipmentMerchantIds
};
