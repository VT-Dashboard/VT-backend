import express from "express";
import multer from "multer";
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
} from "../controllers/productController.js";

const router = express.Router();

// basic disk storage for uploads (stored in project /uploads)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random()*1e9)}`;
    const ext = (file.originalname || "").split('.').pop();
    cb(null, `${unique}.${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// List products (pagination/search)
router.get("/", getProducts);

// Get single product by id or barcode (id path param can be UUID or barcode)
router.get("/:id", getProduct);

// Convenience route to get by barcode (param named id so controller finds it)
router.get("/barcode/:id", getProduct);

// Create product (accepts optional `image` file multipart/form-data)
router.post("/", upload.single("image"), createProduct);

// Update product by id or barcode (PUT/PATCH)
router.put("/:id", upload.single("image"), updateProduct);
router.patch("/:id", upload.single("image"), updateProduct);

// Delete product by id or barcode
router.delete("/:id", deleteProduct);

// Adjust stock (body: { id?, barcode?, delta })
router.post("/adjust-stock", adjustStock);

export default router;
