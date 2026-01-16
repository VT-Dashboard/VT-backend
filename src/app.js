import express from "express";
import cors from "cors";
import productRoutes from "./routes/productRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import brandRoutes from "./routes/brandRoutes.js";

const app = express();

// enable CORS for all origins (dev only)
app.use(cors());

app.use(express.json());

// serve uploaded files
app.use("/uploads", express.static("uploads"));

// Mount product routes
app.use("/api/products", productRoutes);
// Mount supplier routes
app.use("/api/suppliers", supplierRoutes);
// Mount brand routes
app.use("/api/brands", brandRoutes);

// health
app.get("/health", (req, res) => res.json({ ok: true }));

export default app;