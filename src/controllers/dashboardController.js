import { sql, poolPromise } from "../config/db.js";

async function getSequelizeModels() {
  try {
    const mod = await import("../models/index.js");
    const exported = mod.default || mod;
    const Order = exported.models && exported.models.Order ? exported.models.Order : exported.Order || (exported.default && exported.default.Order);
    const OrderItem = exported.models && exported.models.OrderItem ? exported.models.OrderItem : exported.OrderItem || (exported.default && exported.default.OrderItem);
    const Product = exported.models && exported.models.Product ? exported.models.Product : exported.Product || (exported.default && exported.default.Product);
    return { Order, OrderItem, Product };
  } catch (e) {
    return { Order: null, OrderItem: null, Product: null };
  }
}

function startOfDay(date) {
  const d = new Date(date || Date.now());
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date || Date.now());
  d.setHours(23, 59, 59, 999);
  return d;
}

export const getSummary = async (req, res) => {
  try {
    const { start = null, end = null } = req.query;
    const startDate = start ? new Date(start) : startOfDay();
    const endDate = end ? new Date(end) : endOfDay();

    const { Order } = await getSequelizeModels();
    if (Order) {
      const Sequelize = (await import('sequelize')).default || (await import('sequelize'));
      const { Op } = Sequelize;
      const totalSales = await Order.sum('totalAmount', { where: { createdAt: { [Op.between]: [startDate, endDate] } } }) || 0;
      const ordersCount = await Order.count({ where: { createdAt: { [Op.between]: [startDate, endDate] } } }) || 0;
      const paidCount = await Order.count({ where: { createdAt: { [Op.between]: [startDate, endDate] }, isPaid: true } }) || 0;
      const avgOrder = ordersCount ? (Number(totalSales) / ordersCount) : 0;
      return res.json({ totalSales: Number(totalSales), ordersCount, paidCount, avgOrder: Number(avgOrder) });
    }

    // raw SQL fallback (mssql)
    const pool = await poolPromise;
    const request = pool.request();
    request.input('start', sql.DateTime, startDate);
    request.input('end', sql.DateTime, endDate);
    const q = `SELECT SUM(total_amount) AS totalSales, COUNT(*) AS ordersCount, SUM(CASE WHEN is_paid = 1 THEN 1 ELSE 0 END) AS paidCount FROM orders WHERE created_at >= @start AND created_at <= @end`;
    const r = await request.query(q);
    const row = r.recordset && r.recordset[0] ? r.recordset[0] : { totalSales: 0, ordersCount: 0, paidCount: 0 };
    const avgOrder = row.ordersCount ? (Number(row.totalSales) / Number(row.ordersCount)) : 0;
    return res.json({ totalSales: Number(row.totalSales || 0), ordersCount: Number(row.ordersCount || 0), paidCount: Number(row.paidCount || 0), avgOrder: Number(avgOrder) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getTopItems = async (req, res) => {
  try {
    const { limit = 10, start = null, end = null } = req.query;
    const startDate = start ? new Date(start) : startOfDay();
    const endDate = end ? new Date(end) : endOfDay();

    const { OrderItem, Order, Product } = await getSequelizeModels();
    if (OrderItem && Order) {
      const Sequelize = (await import('sequelize')).default || (await import('sequelize'));
      const { Op, fn, col, literal } = Sequelize;

      // Aggregate via Sequelize (works across dialects)
      const rows = await OrderItem.findAll({
        attributes: [
          'productId',
          'productName',
          [fn('SUM', col('quantity')), 'quantitySold'],
          [fn('SUM', col('total_price')), 'salesAmount']
        ],
        include: [{ model: Order, as: 'order', attributes: [], where: { createdAt: { [Op.between]: [startDate, endDate] } } }],
        group: ['OrderItem.productId', 'OrderItem.productName'],
        order: [[literal('quantitySold'), 'DESC']],
        limit: Number(limit)
      });

      const mapped = rows.map(r => ({ productId: r.productId, productName: r.productName, quantitySold: Number(r.get('quantitySold') || 0), salesAmount: Number(r.get('salesAmount') || 0) }));
      return res.json(mapped);
    }

    // raw SQL fallback (MSSQL)
    const pool = await poolPromise;
    const request = pool.request();
    request.input('start', sql.DateTime, startDate);
    request.input('end', sql.DateTime, endDate);
    request.input('limit', sql.Int, Number(limit));
    const q = `SELECT TOP (@limit) oi.product_id AS productId, oi.product_name AS productName, SUM(oi.quantity) AS quantitySold, SUM(oi.total_price) AS salesAmount FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.created_at >= @start AND o.created_at <= @end GROUP BY oi.product_id, oi.product_name ORDER BY SUM(oi.quantity) DESC`;
    const r = await request.query(q);
    return res.json(r.recordset.map(row => ({ productId: row.productId, productName: row.productName, quantitySold: Number(row.quantitySold || 0), salesAmount: Number(row.salesAmount || 0) })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getDashboard = async (req, res) => {
  try {
    // return summary + top items
    const summary = await (async () => {
      const fakeReq = { query: req.query };
      const fakeRes = { json: (d) => d, status: (s) => ({ json: (d) => d }) };
      return await getSummary(fakeReq, fakeRes);
    })();

    const top = await (async () => {
      const fakeReq = { query: req.query };
      const fakeRes = { json: (d) => d, status: (s) => ({ json: (d) => d }) };
      return await getTopItems(fakeReq, fakeRes);
    })();

    // If getSummary/getTopItems returned via res.json they returned data; otherwise they may have sent the response already
    return res.json({ summary, top });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
