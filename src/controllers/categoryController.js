import { sql, poolPromise } from "../config/db.js";

async function getSequelizeCategory() {
  try {
    const mod = await import("../models/index.js");
    const exported = mod.default || mod;
    if (exported.models && exported.models.Category) return exported.models.Category;
    if (exported.Category) return exported.Category;
    if (exported.default && exported.default.Category) return exported.default.Category;
    return null;
  } catch (e) {
    return null;
  }
}

export const getCategories = async (req, res) => {
  try {
    const Category = await getSequelizeCategory();
    const { page = 1, limit = 50, q } = req.query;
    if (Category) {
      const where = {};
      if (q) {
        const { Op } = (await import("sequelize")).default || (await import("sequelize"));
        where[Op.or] = [
          { name: { [Op.iLike]: `%${q}%` } },
          { description: { [Op.iLike]: `%${q}%` } },
        ];
      }
      const offset = (Number(page) - 1) * Number(limit);
      const { count, rows } = await Category.findAndCountAll({ where, limit: Number(limit), offset, order: [["name", "ASC"]] });
      return res.json({ meta: { total: count, page: Number(page), limit: Number(limit) }, data: rows });
    }

    const pool = await poolPromise;
    const clauses = [];
    const inputs = {};
    if (q) { clauses.push("(name LIKE @q OR description LIKE @q)"); inputs.q = `%${q}%`; }
    const whereSQL = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const offset = (Number(page) - 1) * Number(limit);
    const query = `SELECT COUNT(*) OVER() AS total, * FROM categories ${whereSQL} ORDER BY name OFFSET ${offset} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`;
    const request = pool.request();
    Object.entries(inputs).forEach(([k, v]) => request.input(k, v));
    const result = await request.query(query);
    const total = result.recordset.length ? Number(result.recordset[0].total) : 0;
    return res.json({ meta: { total, page: Number(page), limit: Number(limit) }, data: result.recordset });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getCategory = async (req, res) => {
  try {
    const Category = await getSequelizeCategory();
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id required" });
    if (Category) {
      const inst = await Category.findByPk(id);
      if (!inst) return res.status(404).json({ error: "Category not found" });
      return res.json(inst);
    }

    const pool = await poolPromise;
    const request = pool.request();
    request.input("id", sql.UniqueIdentifier, id);
    const result = await request.query("SELECT * FROM categories WHERE id = @id");
    if (!result.recordset.length) return res.status(404).json({ error: "Category not found" });
    return res.json(result.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.name) return res.status(400).json({ error: "name is required" });
    const Category = await getSequelizeCategory();
    if (Category) {
      const created = await Category.create(payload);
      return res.status(201).json(created);
    }

    const pool = await poolPromise;
    const request = pool.request();
    request.input("name", sql.NVarChar(255), payload.name);
    request.input("description", sql.NVarChar, payload.description || null);
    request.input("parent_id", sql.UniqueIdentifier, payload.parentId || null);
    request.input("is_active", sql.Bit, payload.isActive === false ? 0 : 1);
    const insertQ = `INSERT INTO categories (name, description, parent_id, is_active) OUTPUT inserted.* VALUES (@name,@description,@parent_id,@is_active)`;
    const inserted = await request.query(insertQ);
    return res.status(201).json(inserted.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const payload = req.body;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id required" });
    const Category = await getSequelizeCategory();
    if (Category) {
      const inst = await Category.findByPk(id);
      if (!inst) return res.status(404).json({ error: "Category not found" });
      await inst.update(payload);
      return res.json(inst);
    }

    const pool = await poolPromise;
    const allowedCols = ["name","description","parent_id","is_active"];
    const request = pool.request();
    const fields = [];

    const toSnake = (k) => k.replace(/([A-Z])/g, "_$1").toLowerCase();

    for (const col of allowedCols) {
      const camel = col.includes('_') ? col.split('_').map((s,i)=> i===0?s: s.charAt(0).toUpperCase()+s.slice(1)).join('') : col;
      let val;
      if (Object.prototype.hasOwnProperty.call(payload, camel)) val = payload[camel];
      else if (Object.prototype.hasOwnProperty.call(payload, col)) val = payload[col];
      else continue;

      fields.push(`${col} = @${col}`);
      if (col === 'is_active') request.input(col, sql.Bit, val === false ? 0 : 1);
      else if (col === 'parent_id') request.input(col, sql.UniqueIdentifier, val || null);
      else request.input(col, val === null ? sql.NVarChar : (typeof val === 'number' ? sql.Decimal(18,2) : sql.NVarChar), val);
    }

    if (!fields.length) return res.status(400).json({ error: "no updatable fields provided" });
    request.input("id", sql.UniqueIdentifier, id);
    const updateQ = `UPDATE categories SET ${fields.join(', ')} OUTPUT inserted.* WHERE id = @id`;
    const result = await request.query(updateQ);
    if (!result.recordset.length) return res.status(404).json({ error: "Category not found" });
    return res.json(result.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id required" });
    const Category = await getSequelizeCategory();
    if (Category) {
      const inst = await Category.findByPk(id);
      if (!inst) return res.status(404).json({ error: "Category not found" });
      await inst.destroy({ force: true });
      return res.json({ success: true });
    }

    const pool = await poolPromise;
    const request = pool.request();
    request.input("id", sql.UniqueIdentifier, id);
    const result = await request.query("DELETE FROM categories WHERE id = @id; SELECT @@ROWCOUNT AS affected;");
    if (!result.recordset.length || result.recordset[0].affected === 0) return res.status(404).json({ error: "Category not found" });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
