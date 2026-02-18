const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("ShipOne backend is running");
});

app.post("/book", async (req, res) => {
  console.log("Order received:", req.body);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
