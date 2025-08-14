const express = require("express");
const cors = require("cors");
const mainRouter = require("./routes/main.js");

const port = process.env.PORT || 3000;
const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://spendquest.vercel.app"
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use("/api/v1", mainRouter);

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
