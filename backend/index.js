const express = require("express");
const mainRouter = require("./routes/main.js");
const cors = require('cors')
const port = 3000;
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/v1', mainRouter);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
