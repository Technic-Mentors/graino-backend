import { pool } from '../../config/db.js';

export async function listCoupons({ limit, offset } = {}) {
  if (limit == null) {
    const [rows] = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
    return { rows, total: rows.length };
  }
  const [rows] = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
  const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM coupons');
  return { rows, total: countRows[0].total };
}

export async function findCouponByCode(code) {
  const [rows] = await pool.query('SELECT * FROM coupons WHERE code = ? LIMIT 1', [code]);
  return rows[0] || null;
}

export async function findCouponById(id) {
  const [rows] = await pool.query('SELECT * FROM coupons WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

/** Locks the coupon row for update — must be called with a transaction connection. */
export async function findCouponByCodeForUpdate(connection, code) {
  const [rows] = await connection.query('SELECT * FROM coupons WHERE code = ? FOR UPDATE', [code]);
  return rows[0] || null;
}

export async function createCoupon(data) {
  const [result] = await pool.query(
    `INSERT INTO coupons
       (code, type, value, min_order_value, max_discount_amount, usage_limit_total, usage_limit_per_customer, is_active, starts_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.code,
      data.type,
      data.value,
      data.minOrderValue || null,
      data.maxDiscountAmount || null,
      data.usageLimitTotal || null,
      data.usageLimitPerCustomer || null,
      data.isActive ?? true ? 1 : 0,
      data.startsAt || null,
      data.expiresAt || null,
    ],
  );
  return result.insertId;
}

export async function updateCoupon(id, data) {
  await pool.query(
    `UPDATE coupons SET
       code = ?, type = ?, value = ?, min_order_value = ?, max_discount_amount = ?,
       usage_limit_total = ?, usage_limit_per_customer = ?, is_active = ?, starts_at = ?, expires_at = ?
     WHERE id = ?`,
    [
      data.code,
      data.type,
      data.value,
      data.minOrderValue || null,
      data.maxDiscountAmount || null,
      data.usageLimitTotal || null,
      data.usageLimitPerCustomer || null,
      data.isActive ? 1 : 0,
      data.startsAt || null,
      data.expiresAt || null,
      id,
    ],
  );
}

export async function deleteCoupon(id) {
  await pool.query('DELETE FROM coupons WHERE id = ?', [id]);
}

export async function incrementTimesUsed(connection, id) {
  await connection.query('UPDATE coupons SET times_used = times_used + 1 WHERE id = ?', [id]);
}
