require("dotenv").config();

const app = require("./app");
const connectToDB = require("./config/db");

connectToDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
