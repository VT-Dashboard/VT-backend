import express from "express";
import * as categoryController from "../controllers/categoryController.js";

const router = express.Router();

router.get("/", categoryController.getCategories);
router.get("/:id", categoryController.getCategory);
router.post("/", categoryController.createCategory);
router.put("/:id", categoryController.updateCategory);
router.patch("/:id", categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);

export default router;
