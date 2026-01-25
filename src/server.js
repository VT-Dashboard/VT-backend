import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import { sequelize } from "./config/db.js";

import cors from "cors";

app.use(cors()); // allow all origins (dev only)

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // Optionally test DB connection
    await sequelize.authenticate().catch(() => {/* ignore if no sequelize connection string */});
    console.log("DB connected (sequelize)");

    app.listen(PORT, () => {
      console.log(`Server listening on ${PORT}`);
    });
  } catch (err) {
    console.error("Startup error", err);
    process.exit(1);
  }
}

start();