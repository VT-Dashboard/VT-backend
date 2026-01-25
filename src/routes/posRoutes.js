import express from "express";
import * as posController from "../controllers/posController.js";

const router = express.Router();

router.get("/", posController.getPOSList);
router.get("/:id", posController.getPOS);
router.post("/", posController.createPOS);
router.put("/:id", posController.updatePOS);
router.patch("/:id", posController.updatePOS);
router.delete("/:id", posController.deletePOS);

export default router;
