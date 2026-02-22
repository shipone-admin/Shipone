// Central registry of available carriers

const postnord = require("./postnord.mock");
const dhl = require("./dhl.mock");
const budbee = require("./budbee.mock");

// Later we will swap mock → adapter without touching anything else.

const carriers = [
  postnord,
  dhl,
  budbee
];

module.exports = carriers;

