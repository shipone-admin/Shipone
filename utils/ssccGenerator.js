// ========================================
// SSCC GENERATOR — CLEAN VERSION
// ========================================

function generateSSCC() {

  const customer = process.env.POSTNORD_CUSTOMER_NUMBER;

  if (!customer) {
    throw new Error("POSTNORD_CUSTOMER_NUMBER missing");
  }

  // Extension digit (3 for shipments)
  const extensionDigit = "3";

  // Customer block (9 digits)
  const customerBlock = String(customer).padStart(9, "0");

  // Unique serial (7 digits from timestamp)
  const serial = String(Date.now()).slice(-7);

  const base17 = extensionDigit + customerBlock + serial;

  // MOD10 checksum
  let sum = 0;
  let multiplyByThree = true;

  for (let i = base17.length - 1; i >= 0; i--) {
    const digit = parseInt(base17[i], 10);
    sum += multiplyByThree ? digit * 3 : digit;
    multiplyByThree = !multiplyByThree;
  }

  const checkDigit = (10 - (sum % 10)) % 10;

  const sscc = base17 + checkDigit;

  console.log("✅ Generated SSCC:", sscc);
  console.log("Length:", sscc.length);

  return sscc;
}

module.exports = { generateSSCC };
