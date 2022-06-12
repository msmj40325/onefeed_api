const express = require("express");
const cors = require("cors");
const PORT = process.env.PORT || 1337;
const app = express();
const apiRoutes = require("./routes");
const apiProxy = require("./proxy");

app.use(express.json());
app.use(cors());

app.use("/api", apiRoutes);
app.use("/proxy", apiProxy);

app.listen(PORT, () => {
  console.log(`It's alive on http://localhost:${PORT}`);
});