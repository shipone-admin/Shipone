const fetch = require("node-fetch");

async function getPostNordLabel(printId) {

  const response = await fetch(
    "https://api2.postnord.com/rest/shipment/v3/labels/ids/pdf",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-IBM-Client-Id": process.env.POSTNORD_API_KEY
      },
      body: JSON.stringify({
        ids: [printId]
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Label error:", errorText);
    return null;
  }

  const pdfBuffer = await response.buffer();

  console.log("✅ Label PDF received");

  return pdfBuffer;
}

module.exports = { getPostNordLabel };
