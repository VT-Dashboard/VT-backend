import { sql, poolPromise } from "../config/db.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadToCloudinary(localPath, folder = "vt-products") {
  const res = await cloudinary.uploader.upload(localPath, { folder, use_filename: true, unique_filename: false });
  // remove local file if exists
  await fs.unlink(localPath).catch(() => {});
  return { url: res.secure_url, public_id: res.public_id };
}

function normalizeImageFields(obj) {
  if (!obj) return obj;
  // prefer snake_case storage field `image_url`, fall back to camelCase `imageUrl` or other names
  if (!obj.image_url && obj.imageUrl) obj.image_url = obj.imageUrl;
  if (!obj.image_public_id && obj.imagePublicId) obj.image_public_id = obj.imagePublicId;
  return obj;
}

/**
 * Helper: try load Sequelize Product model (works if you have src/models/index.js).
 * Falls back to null if not available.
 */
async function getSequelizeProduct() {
  try {
    const mod = await import("../models/index.js");
    // common index exports: default / models / Product
    const exported = mod.default || mod;
    if (exported.models && exported.models.Product) return exported.models.Product;
    if (exported.Product) return exported.Product;
    if (exported.default && exported.default.Product) return exported.default.Product;
    return null;
  } catch (e) {
    return null;
  }
}

async function getSequelizeModels() {
  try {
    const mod = await import("../models/index.js");
    const exported = mod.default || mod;
    // prefer exported.models map
    if (exported.models) return exported.models;
    // fallback named exports
    return { Product: exported.Product || exported.Product, Supplier: exported.Supplier || exported.Supplier, Brand: exported.Brand || exported.Brand };
  } catch (e) {
    return null;
  }
}

// GET ALL PRODUCTS (with optional pagination/search)
export const getProducts = async (req, res) => {
  try {
    const Product = await getSequelizeProduct();
    const { page = 1, limit = 50, q, barcode, sku, lowStock } = req.query;
    if (Product) {
      const where = {};
      if (barcode) where.barcode = barcode.trim();
      if (sku) where.sku = sku.trim().toUpperCase();
      if (q) {
        const { Op } = (await import("sequelize")).default || (await import("sequelize"));
        where[Op.or] = [
          { name: { [Op.iLike]: `%${q}%` } },
          { description: { [Op.iLike]: `%${q}%` } },
          { barcode: { [Op.iLike]: `%${q}%` } },
          { sku: { [Op.iLike]: `%${q}%` } },
        ];
      }
      if (lowStock === "true") where.quantity = { [(await import("sequelize")).Op.lte]:  (Number(req.query.threshold) || 5) };

      const offset = (Number(page) - 1) * Number(limit);
      const models = await getSequelizeModels();
      const Brand = models && models.Brand;
      const include = Brand ? [{ model: Brand, as: 'brand' }] : [];
      const { count, rows } = await Product.findAndCountAll({
        where,
        limit: Number(limit),
        offset,
        order: [["name", "ASC"]],
        include,
      });
      // normalize instances to plain objects and ensure image fields present
      const data = rows.map(r => normalizeImageFields(typeof r.toJSON === 'function' ? r.toJSON() : r));
      return res.json({ meta: { total: count, page: Number(page), limit: Number(limit) }, data });
    }

    // Fallback: raw SQL
    const pool = await poolPromise;
    const clauses = [];
    const inputs = {};
    if (barcode) { clauses.push("barcode = @barcode"); inputs.barcode = barcode.trim(); }
    if (sku) { clauses.push("sku = @sku"); inputs.sku = sku.trim().toUpperCase(); }
    if (q) { clauses.push("(name LIKE @q OR description LIKE @q OR barcode LIKE @q OR sku LIKE @q)"); inputs.q = `%${q}%`; }
    if (lowStock === "true") { clauses.push("quantity <= @threshold"); inputs.threshold = Number(req.query.threshold) || 5; }
    const whereSQL = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const offset = (Number(page) - 1) * Number(limit);
    const query = `SELECT COUNT(*) OVER() AS total, * FROM products ${whereSQL} ORDER BY name OFFSET ${offset} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`;
    const request = pool.request();
    Object.entries(inputs).forEach(([k, v]) => request.input(k, v));
    const result = await request.query(query);
    const total = result.recordset.length ? Number(result.recordset[0].total) : 0;
    return res.json({ meta: { total, page: Number(page), limit: Number(limit) }, data: result.recordset });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET single product (by id or barcode)
export const getProduct = async (req, res) => {
  try {
    const Product = await getSequelizeProduct();
    const idOrBarcode = req.params.id || req.query.barcode;
    if (!idOrBarcode) return res.status(400).json({ error: "id or barcode required" });

    if (Product) {
      const models = await getSequelizeModels();
      const Brand = models && models.Brand;
      const include = Brand ? [{ model: Brand, as: 'brand' }] : [];
      const byPk = await Product.findByPk(idOrBarcode, { include });
      if (byPk) return res.json(normalizeImageFields(typeof byPk.toJSON === 'function' ? byPk.toJSON() : byPk));
      const byBarcode = await Product.findOne({ where: { barcode: idOrBarcode }, include });
      if (byBarcode) return res.json(normalizeImageFields(typeof byBarcode.toJSON === 'function' ? byBarcode.toJSON() : byBarcode));
      return res.status(404).json({ error: "Product not found" });
    }

    const pool = await poolPromise;
    const request = pool.request();
    request.input("id", sql.UniqueIdentifier, idOrBarcode);
    request.input("barcode", sql.NVarChar, idOrBarcode);
    const result = await request.query("SELECT * FROM products WHERE id = @id OR barcode = @barcode");
    if (!result.recordset.length) return res.status(404).json({ error: "Product not found" });
    return res.json(result.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// CREATE product
export const createProduct = async (req, res) => {
  try {
    const payload = req.body || {};
    // if upload middleware used, multer attaches file to req.file
    if (req.file) {
      const { url, public_id } = await uploadToCloudinary(req.file.path);
      payload.image_url = url;
      payload.image_public_id = public_id;
      payload.imageUrl = url;
      payload.imagePublicId = public_id;
    }
    if (!payload.name || !payload.barcode) return res.status(400).json({ error: "name and barcode are required" });

    const Product = await getSequelizeProduct();
    if (Product) {
      // normalize
      payload.barcode = String(payload.barcode).trim();
      if (payload.sku) payload.sku = String(payload.sku).trim().toUpperCase();
      const existing = await Product.findOne({ where: { barcode: payload.barcode } });
      if (existing) return res.status(409).json({ error: "barcode already exists" });
      const created = await Product.create(payload);
      return res.status(201).json(created);
    }

    // SQL fallback
    const pool = await poolPromise;
    const request = pool.request();
    request.input("name", sql.NVarChar(255), payload.name);
    request.input("description", sql.NVarChar, payload.description || null);
    request.input("sku", sql.NVarChar(64), payload.sku || null);
    request.input("barcode", sql.NVarChar(128), String(payload.barcode).trim());
    request.input("price", sql.Decimal(12, 2), payload.price || 0.0);
    request.input("cost", sql.Decimal(12, 2), payload.cost || 0.0);
    request.input("quantity", sql.Int, payload.quantity || 0);
    request.input("unit", sql.NVarChar(32), payload.unit || null);
    request.input("category_id", sql.UniqueIdentifier, payload.categoryId || null);
    request.input("brand_id", sql.UniqueIdentifier, payload.brandId || null);
    request.input("image_url", sql.NVarChar(255), payload.image_url || null);
    request.input("image_public_id", sql.NVarChar(255), payload.image_public_id || null);
    request.input("supplier_id", sql.UniqueIdentifier, payload.supplierId || null);
    request.input("reorder_level", sql.Int, payload.reorderLevel || 0);
    request.input("tax_rate", sql.Decimal(5, 2), payload.taxRate || 0.0);
    request.input("is_active", sql.Bit, payload.isActive === false ? 0 : 1);

    const check = await pool.request().input("barcode", sql.NVarChar(128), String(payload.barcode).trim()).query("SELECT 1 FROM products WHERE barcode = @barcode");
    if (check.recordset.length) return res.status(409).json({ error: "barcode already exists" });

    const insertQ = `
      INSERT INTO products (name, description, sku, barcode, price, cost, quantity, unit, category_id, brand_id, supplier_id, reorder_level, tax_rate, is_active, image_url, image_public_id)
      OUTPUT inserted.*
      VALUES (@name, @description, @sku, @barcode, @price, @cost, @quantity, @unit, @category_id, @brand_id, @supplier_id, @reorder_level, @tax_rate, @is_active, @image_url, @image_public_id)
    `;
    const inserted = await request.query(insertQ);
    return res.status(201).json(inserted.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// UPDATE product by id or barcode
export const updateProduct = async (req, res) => {
  try {
    const payload = req.body || {};
    if (req.file) {
      const { url, public_id } = await uploadToCloudinary(req.file.path);
      payload.image_url = url;
      payload.image_public_id = public_id;
      payload.imageUrl = url;
      payload.imagePublicId = public_id;
    }
    const id = req.params.id || req.query.barcode;
    if (!id) return res.status(400).json({ error: "id or barcode required" });

    const Product = await getSequelizeProduct();
    if (Product) {
      const models = await getSequelizeModels();
      const Brand = models && models.Brand;
      const include = Brand ? [{ model: Brand, as: 'brand' }] : [];
      const byPk = await Product.findByPk(id, { include });
      const instance = byPk || (await Product.findOne({ where: { barcode: id }, include }));
      if (!instance) return res.status(404).json({ error: "Product not found" });
      if (payload.sku) payload.sku = String(payload.sku).trim().toUpperCase();
      if (payload.barcode) payload.barcode = String(payload.barcode).trim();
      await instance.update(payload);
      return res.json(instance);
    }

    // SQL fallback - simple update (partial)
    const pool = await poolPromise;
    const fields = [];
    const request = pool.request();
    const allowed = ["name","description","sku","barcode","price","cost","quantity","unit","category_id","brand_id","supplier_id","reorder_level","tax_rate","is_active","image_url","image_public_id"];
    for (const key of allowed) {
      const bodyKey = key === "category_id" ? "categoryId" : key === "brand_id" ? "brandId" : key === "supplier_id" ? "supplierId" : key;
      if (Object.prototype.hasOwnProperty.call(payload, bodyKey)) {
        const val = payload[bodyKey];
        fields.push(`${key} = @${key}`);
        // infer type minimally
        // image_url / image_public_id should be string
        if (key === "image_url" || key === "image_public_id") request.input(key, sql.NVarChar(255), val || null);
        else request.input(key, val === null ? sql.NVarChar : (typeof val === "number" ? sql.Decimal(18,2) : sql.NVarChar), val);
      }
    }
    if (!fields.length) return res.status(400).json({ error: "no updatable fields provided" });
    // where
    request.input("idOrBarcode", sql.NVarChar, id);
    const updateQuery = `UPDATE products SET ${fields.join(", ")} OUTPUT inserted.* WHERE id = @idOrBarcode OR barcode = @idOrBarcode`;
    const result = await request.query(updateQuery);
    if (!result.recordset.length) return res.status(404).json({ error: "Product not found" });
    return res.json(result.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// DELETE product (soft or hard depending on backend)
export const deleteProduct = async (req, res) => {
  try {
    const id = req.params.id || req.query.barcode;
    if (!id) return res.status(400).json({ error: "id or barcode required" });

    const Product = await getSequelizeProduct();
    if (Product) {
      const byPk = await Product.findByPk(id);
      const instance = byPk || (await Product.findOne({ where: { barcode: id } }));
      if (!instance) return res.status(404).json({ error: "Product not found" });
      // Permanently remove record even when model is paranoid
      await instance.destroy({ force: true });
      return res.json({ success: true });
    }

    const pool = await poolPromise;
    const request = pool.request();
    request.input("idOrBarcode", sql.NVarChar, id);
    // Hard delete from table in raw SQL fallback
    const result = await request.query("DELETE FROM products WHERE id = @idOrBarcode OR barcode = @idOrBarcode; SELECT @@ROWCOUNT AS affected;");
    if (!result.recordset.length || result.recordset[0].affected === 0) return res.status(404).json({ error: "Product not found" });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ADJUST stock (delta can be negative for sale)
export const adjustStock = async (req, res) => {
  try {
    const { barcode, id, delta } = req.body;
    if (typeof delta !== "number") return res.status(400).json({ error: "delta (number) required" });
    const identifier = id || barcode;
    if (!identifier) return res.status(400).json({ error: "id or barcode required" });

    const Product = await getSequelizeProduct();
    if (Product) {
      const product = (await Product.findByPk(identifier)) || (await Product.findOne({ where: { barcode: identifier } }));
      if (!product) return res.status(404).json({ error: "Product not found" });
      product.quantity = (Number(product.quantity) || 0) + Number(delta);
      if (product.quantity < 0) product.quantity = 0;
      await product.save();
      return res.json(product);
    }

    const pool = await poolPromise;
    const request = pool.request();
    request.input("idOrBarcode", sql.NVarChar, identifier);
    request.input("delta", sql.Int, delta);
    const q = `
      UPDATE products
      SET quantity = CASE WHEN (quantity + @delta) < 0 THEN 0 ELSE (quantity + @delta) END
      OUTPUT inserted.*
      WHERE id = @idOrBarcode OR barcode = @idOrBarcode
    `;
    const result = await request.query(q);
    if (!result.recordset.length) return res.status(404).json({ error: "Product not found" });
    return res.json(result.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
