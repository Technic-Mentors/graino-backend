import { pool } from '../../config/db.js';

function statusCondition(status) {
  return status ? { clause: 'o.status = ?', param: status } : { clause: "o.status != 'cancelled'", param: null };
}

export async function getSalesSummary(start, end, status) {
  const { clause, param } = statusCondition(status);
  const params = [start, end, ...(param ? [param] : [])];
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(total), 0) AS revenue, COALESCE(SUM(discount_amount), 0) AS totalDiscount, COUNT(*) AS orderCount
     FROM orders o WHERE o.created_at >= ? AND o.created_at <= ? AND ${clause}`,
    params,
  );
  const revenue = Number(rows[0].revenue);
  const orderCount = rows[0].orderCount;
  return {
    revenue,
    totalDiscount: Number(rows[0].totalDiscount),
    orderCount,
    averageOrderValue: orderCount > 0 ? Math.round((revenue / orderCount) * 100) / 100 : 0,
  };
}

export async function getSalesTrendRange(start, end, status) {
  const { clause, param } = statusCondition(status);
  const params = [start, end, ...(param ? [param] : [])];
  const [rows] = await pool.query(
    `SELECT DATE(o.created_at) AS date, COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orderCount
     FROM orders o
     WHERE o.created_at >= ? AND o.created_at <= ? AND ${clause}
     GROUP BY DATE(o.created_at)
     ORDER BY date ASC`,
    params,
  );
  return rows.map((row) => ({ date: row.date, revenue: Number(row.revenue), orderCount: row.orderCount }));
}

export async function getTopProductsRange(start, end, limit, status) {
  const { clause, param } = statusCondition(status);
  const params = [start, end, ...(param ? [param] : []), limit];
  const [rows] = await pool.query(
    `SELECT oi.product_id, oi.product_name, SUM(oi.quantity) AS unitsSold, SUM(oi.line_total) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.created_at >= ? AND o.created_at <= ? AND ${clause}
     GROUP BY oi.product_id, oi.product_name
     ORDER BY revenue DESC
     LIMIT ?`,
    params,
  );
  return rows.map((row) => ({ ...row, revenue: Number(row.revenue) }));
}

export async function getOrdersForExport(start, end, status) {
  const conditions = ['o.created_at >= ?', 'o.created_at <= ?'];
  const params = [start, end];
  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }

  const [rows] = await pool.query(
    `SELECT o.order_number, o.created_at, c.name AS customer_name, c.email AS customer_email,
       o.status, o.subtotal, o.discount_amount, o.shipping_charge, o.total, o.shipping_city
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY o.created_at ASC`,
    params,
  );
  return rows;
}
