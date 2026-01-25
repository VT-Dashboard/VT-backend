import express from "express";
import * as dashboardController from "../controllers/dashboardController.js";

const router = express.Router();

// Combined dashboard: summary + top items
router.get("/", dashboardController.getDashboard);
// Summary only (accepts optional `start` and `end` query params)
router.get("/summary", dashboardController.getSummary);
// Top selling items (optional `limit`, `start`, `end`)
router.get("/top-items", dashboardController.getTopItems);

export default router;
