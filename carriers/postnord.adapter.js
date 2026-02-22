// 🔌 This file will contain the REAL PostNord API connection later.
// Right now we don't use it.

module.exports = {
  name: "PostNord",
  type: "adapter",

  async getRates(order) {
    throw new Error("PostNord adapter not activated yet");
  }
};
