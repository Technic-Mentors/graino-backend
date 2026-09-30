import { pool } from '../../config/db.js';

export async function listCartItems(customerId) {
  const [rows] = await pool.query(
    `SELECT ci.id AS cart_item_id, ci.quantity, pv.id AS variant_id, pv.size, pv.color, pv.sku,
       pv.stock_quantity, COALESCE(pv.price_override, p.base_price) AS unit_price,
       p.id AS product_id, p.name AS product_name, p.slug AS product_slug, p.is_active,
       (SELECT image_path FROM product_images pi WHERE pi.product_id = p.id
          ORDER BY is_primary DESC, sort_order ASC LIMIT 1) AS primary_image
     FROM cart_items ci
     JOIN product_variants pv ON pv.id = ci.product_variant_id
     JOIN products p ON p.id = pv.product_id
     WHERE ci.customer_id = ?
     ORDER BY ci.created_at DESC`,
    [customerId],
  );
  return rows;
}

export async function upsertCartItem(customerId, variantId, quantity) {
  await pool.query(
    `INSERT INTO cart_items (customer_id, product_variant_id, quantity)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = ?`,
    [customerId, variantId, quantity, quantity],
  );
}

export async function removeCartItem(customerId, variantId) {
  await pool.query('DELETE FROM cart_items WHERE customer_id = ? AND product_variant_id = ?', [
    customerId,
    variantId,
  ]);
}

export async function clearCart(customerId) {
  await pool.query('DELETE FROM cart_items WHERE customer_id = ?', [customerId]);
}

export async function clearCartInTransaction(connection, customerId) {
  await connection.query('DELETE FROM cart_items WHERE customer_id = ?', [customerId]);
}
