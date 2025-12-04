import { sql, poolPromise } from "../config/db.js";


// GET ALL PRODUCTS
export const getProducts = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM products");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
