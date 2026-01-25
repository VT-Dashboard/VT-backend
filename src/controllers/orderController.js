import { sql, poolPromise } from "../config/db.js";

async function getSequelizeOrderModels() {
  try {
    const mod = await import("../models/index.js");
    const exported = mod.default || mod;
    const Order = exported.models && exported.models.Order ? exported.models.Order : exported.Order || (exported.default && exported.default.Order);
    const OrderItem = exported.models && exported.models.OrderItem ? exported.models.OrderItem : exported.OrderItem || (exported.default && exported.default.OrderItem);
    return { Order, OrderItem };
  } catch (e) {
    return { Order: null, OrderItem: null };
  }
}

export const listOrders = async (req, res) => {
  try {
    const { Order } = await getSequelizeOrderModels();
    const { page = 1, limit = 50, q } = req.query;
    if (Order) {
      const where = {};
      if (q) {
        const { Op } = (await import("sequelize")).default || (await import("sequelize"));
        where[Op.or] = [
          { orderNumber: { [Op.iLike]: `%${q}%` } },
          { status: { [Op.iLike]: `%${q}%` } }
        ];
      }
      const offset = (Number(page) - 1) * Number(limit);
      const { count, rows } = await Order.findAndCountAll({ where, limit: Number(limit), offset, order: [["createdAt", "DESC"]] });
      return res.json({ meta: { total: count, page: Number(page), limit: Number(limit) }, data: rows });
    }

    const pool = await poolPromise;
    const clauses = [];
    const inputs = {};
    if (q) { clauses.push("(order_number LIKE @q OR status LIKE @q)"); inputs.q = `%${q}%`; }
    const offset = (Number(page) - 1) * Number(limit);
    const query = `SELECT COUNT(*) OVER() AS total, * FROM orders ${clauses.length ? 'WHERE '+clauses.join(' AND ') : ''} ORDER BY created_at DESC OFFSET ${offset} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`;
    const request = pool.request();
    Object.entries(inputs).forEach(([k,v])=> request.input(k, v));
    const result = await request.query(query);
    const total = result.recordset.length ? Number(result.recordset[0].total) : 0;
    return res.json({ meta: { total, page: Number(page), limit: Number(limit) }, data: result.recordset });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getOrder = async (req, res) => {
  try {
    const { Order, OrderItem } = await getSequelizeOrderModels();
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id required" });
    if (Order) {
      const inst = await Order.findByPk(id, { include: [{ model: OrderItem, as: 'items' }] });
      if (!inst) return res.status(404).json({ error: "Order not found" });
      return res.json(inst);
    }

    const pool = await poolPromise;
    const request = pool.request();
    request.input("id", sql.UniqueIdentifier, id);
    const orderRes = await request.query("SELECT * FROM orders WHERE id = @id");
    if (!orderRes.recordset.length) return res.status(404).json({ error: "Order not found" });
    const order = orderRes.recordset[0];
    const itemsRes = await pool.request().input("orderId", sql.UniqueIdentifier, id).query("SELECT * FROM order_items WHERE order_id = @orderId");
    order.items = itemsRes.recordset;
    return res.json(order);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

function generateOrderNumber() {
  return `ORD-${Date.now()}`;
}

export const createOrder = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.items || !Array.isArray(payload.items) || !payload.items.length) return res.status(400).json({ error: "items required" });
    const { Order, OrderItem } = await getSequelizeOrderModels();
    if (Order && OrderItem) {
      const t = await Order.sequelize.transaction();
      try {
        const orderNumber = payload.orderNumber || generateOrderNumber();
        const created = await Order.create({ orderNumber, status: payload.status || 'pending', totalAmount: payload.totalAmount || 0, isPaid: !!payload.isPaid, notes: payload.notes || null, pointOfSaleId: payload.pointOfSaleId || null, createdBy: payload.createdBy || null }, { transaction: t });
        const items = payload.items.map((it) => ({ orderId: created.id, productId: it.productId, productName: it.productName || it.name || null, quantity: it.quantity || 1, unitPrice: it.unitPrice || 0, totalPrice: it.totalPrice || (it.quantity * it.unitPrice || 0) }));
        await OrderItem.bulkCreate(items, { transaction: t });
        await t.commit();
        const full = await Order.findByPk(created.id, { include: [{ model: OrderItem, as: 'items' }] });
        return res.status(201).json(full);
      } catch (e) { await t.rollback(); throw e; }
    }

    // raw SQL fallback
    const pool = await poolPromise;
    const request = pool.request();
    const orderNumber = payload.orderNumber || generateOrderNumber();
    request.input("order_number", sql.NVarChar(64), orderNumber);
    request.input("status", sql.NVarChar(32), payload.status || 'pending');
    request.input("total_amount", sql.Decimal(12,2), payload.totalAmount || 0);
    request.input("is_paid", sql.Bit, payload.isPaid ? 1 : 0);
    request.input("notes", sql.NVarChar, payload.notes || null);
    request.input("point_of_sale_id", sql.UniqueIdentifier, payload.pointOfSaleId || null);
    request.input("created_by", sql.NVarChar(128), payload.createdBy || null);
    const insertQ = `INSERT INTO orders (order_number, status, total_amount, is_paid, notes, point_of_sale_id, created_by) OUTPUT inserted.* VALUES (@order_number,@status,@total_amount,@is_paid,@notes,@point_of_sale_id,@created_by)`;
    const inserted = await request.query(insertQ);
    const order = inserted.recordset[0];
    // insert items
    const items = payload.items || [];
    for (const it of items) {
      await pool.request().input("order_id", sql.UniqueIdentifier, order.id)
        .input("product_id", sql.UniqueIdentifier, it.productId)
        .input("product_name", sql.NVarChar(255), it.productName || null)
        .input("quantity", sql.Decimal(10,2), it.quantity || 1)
        .input("unit_price", sql.Decimal(12,2), it.unitPrice || 0)
        .input("total_price", sql.Decimal(12,2), it.totalPrice || (it.quantity * it.unitPrice || 0))
        .query(`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (@order_id,@product_id,@product_name,@quantity,@unit_price,@total_price)`);
    }
    const itemsRes = await pool.request().input("orderId", sql.UniqueIdentifier, order.id).query("SELECT * FROM order_items WHERE order_id = @orderId");
    order.items = itemsRes.recordset;
    return res.status(201).json(order);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const updateOrder = async (req, res) => {
  try {
    const payload = req.body;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id required" });
    const { Order } = await getSequelizeOrderModels();
    if (Order) {
      const inst = await Order.findByPk(id);
      if (!inst) return res.status(404).json({ error: "Order not found" });
      await inst.update(payload);
      return res.json(inst);
    }

    const pool = await poolPromise;
    const allowed = ["status","total_amount","is_paid","notes","point_of_sale_id","created_by"];
    const request = pool.request();
    const fields = [];
    for (const col of allowed) {
      const camel = col.includes('_') ? col.split('_').map((s,i)=> i===0?s: s.charAt(0).toUpperCase()+s.slice(1)).join('') : col;
      let val;
      if (Object.prototype.hasOwnProperty.call(payload, camel)) val = payload[camel];
      else if (Object.prototype.hasOwnProperty.call(payload, col)) val = payload[col];
      else continue;
      fields.push(`${col} = @${col}`);
      if (col === 'is_paid') request.input(col, sql.Bit, val ? 1 : 0);
      else if (col === 'total_amount') request.input(col, sql.Decimal(12,2), val);
      else request.input(col, sql.NVarChar, val === null ? null : val);
    }
    if (!fields.length) return res.status(400).json({ error: "no updatable fields provided" });
    request.input("id", sql.UniqueIdentifier, id);
    const updateQ = `UPDATE orders SET ${fields.join(', ')} OUTPUT inserted.* WHERE id = @id`;
    const result = await request.query(updateQ);
    if (!result.recordset.length) return res.status(404).json({ error: "Order not found" });
    return res.json(result.recordset[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id required" });
    const { Order } = await getSequelizeOrderModels();
    if (Order) {
      const inst = await Order.findByPk(id);
      if (!inst) return res.status(404).json({ error: "Order not found" });
      await inst.destroy({ force: true });
      return res.json({ success: true });
    }
    const pool = await poolPromise;
    const request = pool.request();
    request.input("id", sql.UniqueIdentifier, id);
    // remove items first
    await pool.request().input("orderId", sql.UniqueIdentifier, id).query("DELETE FROM order_items WHERE order_id = @orderId");
    const result = await request.query("DELETE FROM orders WHERE id = @id; SELECT @@ROWCOUNT AS affected;");
    if (!result.recordset.length || result.recordset[0].affected === 0) return res.status(404).json({ error: "Order not found" });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
