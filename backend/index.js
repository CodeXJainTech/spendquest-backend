const express = require("express");
const mainRouter = require("./routes/main.js");
const cors = require("cors");

const port = process.env.PORT || 3000;
const app = express();

// Allow only your frontend URL
const allowedOrigins = [
  "https://spendquest.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error("Not allowed by CORS"), false);
    }
    return callback(null, true);
  }
}));

app.use(express.json());
app.use("/api/v1", mainRouter);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
