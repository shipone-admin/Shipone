import fetch from "node-fetch";

export async function getPostNordLabel(printId) {
  try {
    const response = await fetch(
      "https://api2.postnord.com/rest/shipment/v3/labels",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            process.env.POSTNORD_API_KEY + ":" + process.env.POSTNORD_API_SECRET
          ).toString("base64")}`,
        },
        body: JSON.stringify({
          printIds: [printId],
          format: "PDF",
        }),
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
