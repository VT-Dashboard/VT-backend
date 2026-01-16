import express from "express";
import * as supplierController from "../controllers/supplierController.js";

const router = express.Router();

router.get("/", supplierController.getSuppliers);
router.get("/:id", supplierController.getSupplier);
router.post("/", supplierController.createSupplier);
router.put("/:id", supplierController.updateSupplier);
router.delete("/:id", supplierController.deleteSupplier);

export default router;
