import { sql, poolPromise } from "../config/db.js";

async function getSequelizePos() {
  try {
    const mod = await import("../models/index.js");
    const exported = mod.default || mod;
    if (exported.models && exported.models.PointOfSale) return exported.models.PointOfSale;
    if (exported.PointOfSale) return exported.PointOfSale;
    if (exported.default && exported.default.PointOfSale) return exported.default.PointOfSale;
    return null;
  } catch (e) {
    return null;
  }
}

export const getPOSList = async (req, res) => {
  try {
    const Pos = await getSequelizePos();
    const { page = 1, limit = 50, q } = req.query;
    if (Pos) {
      const where = {};
      if (q) {
        const { Op } = (await import("sequelize")).default || (await import("sequelize"));
        where[Op.or] = [
          { name: { [Op.iLike]: `%${q}%` } },
          { code: { [Op.iLike]: `%${q}%` } },
          { location: { [Op.iLike]: `%${q}%` } },
        ];
      }
      const offset = (Number(page) - 1) * Number(limit);
      const { count, rows } = await Pos.findAndCountAll({ where, limit: Number(limit), offset, order: [["name", "ASC"]] });
      return res.json({ meta: { total: count, page: Number(page), limit: Number(limit) }, data: rows });
    }

    const pool = await poolPromise;
    const clauses = [];
    const inputs = {};
    if (q) { clauses.push("(name LIKE @q OR code LIKE @q OR location LIKE @q)"); inputs.q = `%${q}%`; }
    const whereSQL = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const offset = (Number(page) - 1) * Number(limit);
    const query = `SELECT COUNT(*) OVER() AS total, * FROM points_of_sale ${whereSQL} ORDER BY name OFFSET ${offset} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`;
    const request = pool.request();
    Object.entries(inputs).forEach(([k, v]) => request.input(k, v));
    const result = await request.query(query);
    const total = result.recordset.length ? Number(result.recordset[0].total) : 0;
    return res.json({ meta: { total, page: Number(page), limit: Number(limit) }, data: result.recordset });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getPOS = async (req, res) => {
  try {
    const Pos = await getSequelizePos();
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id required" });
    if (Pos) {
      const inst = await Pos.findByPk(id);
      if (!inst) return res.status(404).json({ error: "Point of Sale not found" });
      return res.json(inst);
    }

    const pool = await poolPromise;
    const request = pool.request();
    request.input("id", sql.UniqueIdentifier, id);
    const result = await request.query("SELECT * FROM points_of_sale WHERE id = @id");
    if (!result.recordset.length) return res.status(404).json({ error: "Point of Sale not found" });
    return res.json(result.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const createPOS = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.name) return res.status(400).json({ error: "name is required" });
    const Pos = await getSequelizePos();
    if (Pos) {
      const created = await Pos.create(payload);
      return res.status(201).json(created);
    }

    const pool = await poolPromise;
    const request = pool.request();
    request.input("name", sql.NVarChar(255), payload.name);
    request.input("code", sql.NVarChar(64), payload.code || null);
    request.input("location", sql.NVarChar(255), payload.location || null);
    request.input("address", sql.NVarChar, payload.address || null);
    request.input("contact", sql.NVarChar(128), payload.contact || null);
    request.input("is_active", sql.Bit, payload.isActive === false ? 0 : 1);
    const insertQ = `INSERT INTO points_of_sale (name, code, location, address, contact, is_active) OUTPUT inserted.* VALUES (@name,@code,@location,@address,@contact,@is_active)`;
    const inserted = await request.query(insertQ);
    return res.status(201).json(inserted.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const updatePOS = async (req, res) => {
  try {
    const payload = req.body;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id required" });
    const Pos = await getSequelizePos();
    if (Pos) {
      const inst = await Pos.findByPk(id);
      if (!inst) return res.status(404).json({ error: "Point of Sale not found" });
      await inst.update(payload);
      return res.json(inst);
    }

    const pool = await poolPromise;
    const allowedCols = ["name","code","location","address","contact","is_active"];
    const request = pool.request();
    const fields = [];

    for (const col of allowedCols) {
      const camel = col.includes('_') ? col.split('_').map((s,i)=> i===0?s: s.charAt(0).toUpperCase()+s.slice(1)).join('') : col;
      let val;
      if (Object.prototype.hasOwnProperty.call(payload, camel)) val = payload[camel];
      else if (Object.prototype.hasOwnProperty.call(payload, col)) val = payload[col];
      else continue;

      fields.push(`${col} = @${col}`);
      if (col === 'is_active') request.input(col, sql.Bit, val === false ? 0 : 1);
      else request.input(col, val === null ? sql.NVarChar : sql.NVarChar, val);
    }

    if (!fields.length) return res.status(400).json({ error: "no updatable fields provided" });
    request.input("id", sql.UniqueIdentifier, id);
    const updateQ = `UPDATE points_of_sale SET ${fields.join(', ')} OUTPUT inserted.* WHERE id = @id`;
    const result = await request.query(updateQ);
    if (!result.recordset.length) return res.status(404).json({ error: "Point of Sale not found" });
    return res.json(result.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const deletePOS = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id required" });
    const Pos = await getSequelizePos();
    if (Pos) {
      const inst = await Pos.findByPk(id);
      if (!inst) return res.status(404).json({ error: "Point of Sale not found" });
      await inst.destroy({ force: true });
      return res.json({ success: true });
    }

    const pool = await poolPromise;
    const request = pool.request();
    request.input("id", sql.UniqueIdentifier, id);
    const result = await request.query("DELETE FROM points_of_sale WHERE id = @id; SELECT @@ROWCOUNT AS affected;");
    if (!result.recordset.length || result.recordset[0].affected === 0) return res.status(404).json({ error: "Point of Sale not found" });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
