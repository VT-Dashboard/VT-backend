import { sql, poolPromise } from "../config/db.js";

async function getSequelizeBrand() {
  try {
    const mod = await import("../models/index.js");
    const exported = mod.default || mod;
    if (exported.models && exported.models.Brand) return exported.models.Brand;
    if (exported.Brand) return exported.Brand;
    if (exported.default && exported.default.Brand) return exported.default.Brand;
    return null;
  } catch (e) {
    return null;
  }
}

export const getBrands = async (req, res) => {
  try {
    const Brand = await getSequelizeBrand();
    const { page = 1, limit = 50, q } = req.query;
    if (Brand) {
      const where = {};
      if (q) {
        const { Op } = (await import("sequelize")).default || (await import("sequelize"));
        where[Op.or] = [
          { name: { [Op.iLike]: `%${q}%` } },
          { description: { [Op.iLike]: `%${q}%` } },
        ];
      }
      const offset = (Number(page) - 1) * Number(limit);
      const { count, rows } = await Brand.findAndCountAll({ where, limit: Number(limit), offset, order: [["name", "ASC"]] });
      return res.json({ meta: { total: count, page: Number(page), limit: Number(limit) }, data: rows });
    }

    const pool = await poolPromise;
    const clauses = [];
    const inputs = {};
    if (q) { clauses.push("(name LIKE @q OR description LIKE @q)"); inputs.q = `%${q}%`; }
    const whereSQL = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const offset = (Number(page) - 1) * Number(limit);
    const query = `SELECT COUNT(*) OVER() AS total, * FROM brands ${whereSQL} ORDER BY name OFFSET ${offset} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`;
    const request = pool.request();
    Object.entries(inputs).forEach(([k, v]) => request.input(k, v));
    const result = await request.query(query);
    const total = result.recordset.length ? Number(result.recordset[0].total) : 0;
    return res.json({ meta: { total, page: Number(page), limit: Number(limit) }, data: result.recordset });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getBrand = async (req, res) => {
  try {
    const Brand = await getSequelizeBrand();
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id required" });
    if (Brand) {
      const inst = await Brand.findByPk(id);
      if (!inst) return res.status(404).json({ error: "Brand not found" });
      return res.json(inst);
    }

    const pool = await poolPromise;
    const request = pool.request();
    request.input("id", sql.UniqueIdentifier, id);
    const result = await request.query("SELECT * FROM brands WHERE id = @id");
    if (!result.recordset.length) return res.status(404).json({ error: "Brand not found" });
    return res.json(result.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const createBrand = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.name) return res.status(400).json({ error: "name is required" });
    const Brand = await getSequelizeBrand();
    if (Brand) {
      const created = await Brand.create(payload);
      return res.status(201).json(created);
    }

    const pool = await poolPromise;
    const request = pool.request();
    request.input("name", sql.NVarChar(255), payload.name);
    request.input("description", sql.NVarChar, payload.description || null);
    request.input("website", sql.NVarChar(255), payload.website || null);
    request.input("is_active", sql.Bit, payload.isActive === false ? 0 : 1);
    const insertQ = `INSERT INTO brands (name, description, website, is_active) OUTPUT inserted.* VALUES (@name,@description,@website,@is_active)`;
    const inserted = await request.query(insertQ);
    return res.status(201).json(inserted.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const updateBrand = async (req, res) => {
  try {
    const payload = req.body;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id required" });
    const Brand = await getSequelizeBrand();
    if (Brand) {
      const inst = await Brand.findByPk(id);
      if (!inst) return res.status(404).json({ error: "Brand not found" });
      await inst.update(payload);
      return res.json(inst);
    }

    const pool = await poolPromise;
    const allowed = ["name","description","website","is_active"];
    const fields = [];
    const request = pool.request();
    for (const key of allowed) {
      const bodyKey = key;
      if (Object.prototype.hasOwnProperty.call(payload, bodyKey)) {
        const val = payload[bodyKey];
        fields.push(`${key} = @${key}`);
        request.input(key, val === null ? sql.NVarChar : (typeof val === 'number' ? sql.Decimal(18,2) : sql.NVarChar), val);
      }
    }
    if (!fields.length) return res.status(400).json({ error: "no updatable fields provided" });
    request.input("id", sql.UniqueIdentifier, id);
    const updateQ = `UPDATE brands SET ${fields.join(', ')} OUTPUT inserted.* WHERE id = @id`;
    const result = await request.query(updateQ);
    if (!result.recordset.length) return res.status(404).json({ error: "Brand not found" });
    return res.json(result.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const deleteBrand = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id required" });
    const Brand = await getSequelizeBrand();
    if (Brand) {
      const inst = await Brand.findByPk(id);
      if (!inst) return res.status(404).json({ error: "Brand not found" });
      await inst.destroy({ force: true });
      return res.json({ success: true });
    }

    const pool = await poolPromise;
    const request = pool.request();
    request.input("id", sql.UniqueIdentifier, id);
    const result = await request.query("DELETE FROM brands WHERE id = @id; SELECT @@ROWCOUNT AS affected;");
    if (!result.recordset.length || result.recordset[0].affected === 0) return res.status(404).json({ error: "Brand not found" });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
