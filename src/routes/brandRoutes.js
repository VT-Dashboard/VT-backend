import express from "express";
import * as brandController from "../controllers/brandController.js";

const router = express.Router();

router.get("/", brandController.getBrands);
router.get("/:id", brandController.getBrand);
router.post("/", brandController.createBrand);
router.put("/:id", brandController.updateBrand);
router.patch("/:id", brandController.updateBrand);
router.delete("/:id", brandController.deleteBrand);

export default router;
