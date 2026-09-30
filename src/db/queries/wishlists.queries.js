import { pool } from '../../config/db.js';

export async function listWishlist(customerId) {
  const [rows] = await pool.query(
    `SELECT w.id AS wishlist_id, p.*,
       (SELECT image_path FROM product_images pi WHERE pi.product_id = p.id
          ORDER BY is_primary DESC, sort_order ASC LIMIT 1) AS primary_image,
       (SELECT MIN(COALESCE(pv.price_override, p.base_price)) FROM product_variants pv
          WHERE pv.product_id = p.id) AS min_price
     FROM wishlists w
     JOIN products p ON p.id = w.product_id
     WHERE w.customer_id = ?
     ORDER BY w.created_at DESC`,
    [customerId],
  );
  return rows;
}

export async function addToWishlist(customerId, productId) {
  await pool.query(
    'INSERT IGNORE INTO wishlists (customer_id, product_id) VALUES (?, ?)',
    [customerId, productId],
  );
}

export async function removeFromWishlist(customerId, productId) {
  await pool.query('DELETE FROM wishlists WHERE customer_id = ? AND product_id = ?', [customerId, productId]);
}
