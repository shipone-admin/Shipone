const fetch = require("node-fetch");

async function getPostNordLabel(printId) {
  try {
    const response = await fetch(
      "https://api2.postnord.com/rest/shipment/v3/labels",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-IBM-Client-Id": process.env.POSTNORD_API_KEY
        },
        body: JSON.stringify({
          printIds: [printId],
          format: "PDF"
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Label error:", data);
      return null;
    }

    console.log("✅ Label fetched from PostNord");
    return data;

  } catch (error) {
    console.error("❌ Label fetch failed:", error);
    return null;
  }
}

module.exports = { getPostNordLabel };
