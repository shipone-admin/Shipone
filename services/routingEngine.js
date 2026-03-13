// =====================================================
// ShipOne Routing Engine
// CommonJS version
// Handles Shopify choice normalization safely
// =====================================================

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeChoice(choice = "SMART") {
  const raw = String(choice || "").trim().toUpperCase();

  if (raw === "FASTEST") return "FAST";
  if (raw === "FAST") return "FAST";

  if (raw === "CHEAPEST") return "CHEAP";
  if (raw === "CHEAP") return "CHEAP";

  if (raw === "GREEN") return "GREEN";

  if (raw === "SMART") return "SMART";

  return "SMART";
}

function scoreSmartOption(option) {
  const price = normalizeNumber(option?.price, 999999);
  const etaDays = normalizeNumber(option?.eta_days, 999999);
  const co2 = normalizeNumber(option?.co2, 0);

  return price * 0.5 + etaDays * 30 + co2 * 10;
}

function scoreGreenOption(option) {
  const price = normalizeNumber(option?.price, 999999);
  const etaDays = normalizeNumber(option?.eta_days, 999999);
  const co2 = normalizeNumber(option?.co2, 999999);

  return co2 * 100 + etaDays * 15 + price * 0.15;
}

function chooseCheapest(options) {
  return options.reduce((currentBest, nextOption) => {
    return normalizeNumber(nextOption?.price, 999999) <
      normalizeNumber(currentBest?.price, 999999)
      ? nextOption
      : currentBest;
  });
}

function chooseFastest(options) {
  return options.reduce((currentBest, nextOption) => {
    return normalizeNumber(nextOption?.eta_days, 999999) <
      normalizeNumber(currentBest?.eta_days, 999999)
      ? nextOption
      : currentBest;
  });
}

function chooseGreenest(options) {
  return [...options]
    .map((option) => ({
      ...option,
      _shipone_green_score: scoreGreenOption(option)
    }))
    .sort((a, b) => a._shipone_green_score - b._shipone_green_score)[0];
}

function chooseSmartest(options) {
  return [...options]
    .map((option) => ({
      ...option,
      _shipone_smart_score: scoreSmartOption(option)
    }))
    .sort((a, b) => a._shipone_smart_score - b._shipone_smart_score)[0];
}

function chooseBestOption(options, choice = "SMART") {
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error("No shipping options provided");
  }

  const normalizedChoice = normalizeChoice(choice);

  console.log("🚚 ShipOne raw choice:", choice);
  console.log("🚚 ShipOne normalized choice:", normalizedChoice);

  if (normalizedChoice === "CHEAP") {
    return chooseCheapest(options);
  }

  if (normalizedChoice === "FAST") {
    return chooseFastest(options);
  }

  if (normalizedChoice === "GREEN") {
    return chooseGreenest(options);
  }

  return chooseSmartest(options);
}

module.exports = {
  normalizeChoice,
  chooseBestOption
};
