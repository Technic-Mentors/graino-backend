import { pool } from '../../config/db.js';

export async function listShippingZones({ activeOnly = false } = {}) {
  const where = activeOnly ? 'WHERE is_active = 1' : '';
  const [rows] = await pool.query(`SELECT * FROM shipping_zones ${where} ORDER BY city ASC`);
  return rows;
}

export async function findShippingZoneByCity(city) {
  // Trim + lowercase on both sides so "Lahore ", " lahore", "LAHORE" etc. all match
  // the same configured zone instead of silently falling back to the default rate.
  const [rows] = await pool.query(
    'SELECT * FROM shipping_zones WHERE LOWER(TRIM(city)) = LOWER(TRIM(?)) AND is_active = 1 LIMIT 1',
    [city || ''],
  );
  return rows[0] || null;
}

export async function findShippingZoneById(id) {
  const [rows] = await pool.query('SELECT * FROM shipping_zones WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function createShippingZone({ city, charge }) {
  const [result] = await pool.query('INSERT INTO shipping_zones (city, charge) VALUES (?, ?)', [city, charge]);
  return result.insertId;
}

export async function updateShippingZone(id, { city, charge, isActive }) {
  await pool.query('UPDATE shipping_zones SET city = ?, charge = ?, is_active = ? WHERE id = ?', [
    city,
    charge,
    isActive ? 1 : 0,
    id,
  ]);
}

export async function deleteShippingZone(id) {
  await pool.query('DELETE FROM shipping_zones WHERE id = ?', [id]);
}
