import { pool } from '../../config/db.js';

const NOT_CANCELLED = "status != 'cancelled'";

export async function getRevenueBetween(start, end) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orderCount
     FROM orders WHERE ${NOT_CANCELLED} AND created_at >= ? AND created_at < ?`,
    [start, end],
  );
  return { revenue: Number(rows[0].revenue), orderCount: rows[0].orderCount };
}

export async function getOrderStatusCounts() {
  const [rows] = await pool.query('SELECT status, COUNT(*) AS count FROM orders GROUP BY status');
  return Object.fromEntries(rows.map((row) => [row.status, row.count]));
}

export async function getSalesTrend(days) {
  const [rows] = await pool.query(
    `SELECT DATE(created_at) AS date, COALESCE(SUM(total), 0) AS revenue
     FROM orders
     WHERE ${NOT_CANCELLED} AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [days],
  );
  return rows.map((row) => ({ date: row.date, revenue: Number(row.revenue) }));
}

export async function getTopProducts(days, limit) {
  const [rows] = await pool.query(
    `SELECT oi.product_id, oi.product_name, SUM(oi.quantity) AS unitsSold, SUM(oi.line_total) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.${NOT_CANCELLED} AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY oi.product_id, oi.product_name
     ORDER BY unitsSold DESC
     LIMIT ?`,
    [days, limit],
  );
  return rows.map((row) => ({ ...row, revenue: Number(row.revenue) }));
}

export async function countNewCustomersBetween(start, end) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS count FROM customers WHERE created_at >= ? AND created_at < ?',
    [start, end],
  );
  return rows[0].count;
}

export async function getNewVsReturningCounts(days) {
  const [rows] = await pool.query(
    `SELECT
       SUM(CASE WHEN first_order_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 ELSE 0 END) AS newCustomers,
       SUM(CASE WHEN first_order_at < DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 ELSE 0 END) AS returningCustomers
     FROM (
       SELECT customer_id, MIN(created_at) AS first_order_at
       FROM orders
       WHERE customer_id IN (
         SELECT DISTINCT customer_id FROM orders
         WHERE ${NOT_CANCELLED} AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       )
       GROUP BY customer_id
     ) AS first_orders`,
    [days, days, days],
  );
  return {
    newCustomers: Number(rows[0].newCustomers || 0),
    returningCustomers: Number(rows[0].returningCustomers || 0),
  };
}

export async function getRecentOrders(limit) {
  const [rows] = await pool.query(
    `SELECT o.id, o.order_number, o.status, o.total, o.created_at, c.name AS customer_name
     FROM orders o JOIN customers c ON c.id = o.customer_id
     ORDER BY o.created_at DESC LIMIT ?`,
    [limit],
  );
  return rows;
}

export async function getTopCoupons(limit) {
  const [rows] = await pool.query(
    `SELECT co.code, co.times_used, COALESCE(SUM(cu.discount_amount), 0) AS totalDiscountGiven
     FROM coupons co
     LEFT JOIN coupon_usages cu ON cu.coupon_id = co.id
     GROUP BY co.id, co.code, co.times_used
     ORDER BY co.times_used DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map((row) => ({ ...row, totalDiscountGiven: Number(row.totalDiscountGiven) }));
}
