// =====================================================
// ShipOne Routing Engine (ESM VERSION)
// =====================================================

export function chooseBestOption(options, choice = "SMART") {
  if (!options || options.length === 0) {
    throw new Error("No shipping options provided");
  }

  console.log("🚚 ShipOne Choice:", choice);

  if (choice === "CHEAP") {
    return options.reduce((c, n) => (n.price < c.price ? n : c));
  }

  if (choice === "FAST") {
    return options.reduce((c, n) => (n.eta_days < c.eta_days ? n : c));
  }

  // SMART
  return options
    .map(o => ({
      ...o,
      score: o.price * 0.5 + o.eta_days * 30 + (o.co2 || 0) * 10
    }))
    .sort((a, b) => a.score - b.score)[0];
}
