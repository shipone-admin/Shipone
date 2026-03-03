// ========================================
// GS1 SSCC GENERATOR (Valid for PostNord)
// ========================================

function calculateCheckDigit(number) {
  const digits = number.split('').map(Number);
  let sum = 0;

  for (let i = digits.length - 1; i >= 0; i--) {
    const positionFromRight = digits.length - i;
    const digit = digits[i];

    if (positionFromRight % 2 === 0) {
      sum += digit * 3;
    } else {
      sum += digit;
    }
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

const sscc = generateSSCC("7300000");

console.log("✅ Generated SSCC:", sscc);
console.log("Length:", sscc.length);


  // Serial reference (9 digits random)
  const serial = Math.floor(Math.random() * 1e9)
    .toString()
    .padStart(9, "0");

  const base = extension + companyPrefix + serial;
  const checkDigit = calculateCheckDigit(base);

  return base + checkDigit;
}

module.exports = { generateSSCC };

