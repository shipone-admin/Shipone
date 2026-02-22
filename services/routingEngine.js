// services/routingEngine.js

/**
 * ShipOne Intelligence Engine
 * Bestämmer vilken frakt som ska väljas
 */

function chooseBestOption(options, choice = "SMART") {
  if (!options || options.length === 0) {
    throw new Error("No shipping options provided");
  }

  console.log("🚚 ShipOne Choice:", choice);

  // -------------------------
  // CHEAPEST
  // -------------------------
  if (choice === "CHEAP") {
    return options.reduce((cheapest, current) =>
      current.price < cheapest.price ? current : cheapest
    );
  }

  // -------------------------
  // FASTEST
  // -------------------------
  if (choice === "FAST") {
    return options.reduce((fastest, current) =>
      current.eta_days < fastest.eta_days ? current : fastest
    );
  }

  // -------------------------
  // SMART (default)
  // -------------------------
  return options
    .map(option => ({
      ...option,
      score:
        option.price * 0.5 +
        option.eta_days * 30 +
        (option.co2 || 0) * 10
    }))
    .sort((a, b) => a.score - b.score)[0];
}

module.exports = {
  chooseBestOption
};
