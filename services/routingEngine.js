function chooseBestOption(options, shiponeChoice) {
  console.log("🚚 ShipOne Choice:", shiponeChoice);

  let sorted;

  if (shiponeChoice === "FAST") {
    sorted = options.sort((a, b) => a.eta_days - b.eta_days);
  }

  else if (shiponeChoice === "CHEAPEST") {
    sorted = options.sort((a, b) => a.price - b.price);
  }

  else {
    // SMART default
    sorted = options.sort((a, b) =>
      (a.price + a.eta_days * 10) - (b.price + b.eta_days * 10)
    );
  }

  return sorted[0];
}

module.exports = { chooseBestOption };
