import { pool } from '../config/db.js';

// Tables intentionally left untouched: _migrations (schema tracking), admins,
// coupons, settings, shipping_zones (store configuration, not test data).
const TABLES_TO_WIPE = [
  'addresses',
  'banners',
  'blog_post_tags',
  'blog_posts',
  'blog_categories',
  'blog_tags',
  'cart_items',
  'contact_messages',
  'coupon_usages',
  'notifications',
  'notify_me_requests',
  'order_items',
  'order_status_history',
  'orders',
  'password_reset_tokens',
  'product_images',
  'product_variants',
  'products',
  'refresh_tokens',
  'reviews',
  'stock_adjustments',
  'wishlists',
  'email_verification_tokens',
  'customers',
];

async function run() {
  const connection = await pool.getConnection();
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of TABLES_TO_WIPE) {
      await connection.query(`TRUNCATE TABLE \`${table}\``);
      console.log(`Truncated ${table}`);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log(`\nDone. Wiped ${TABLES_TO_WIPE.length} tables. Kept: admins, coupons, settings, shipping_zones, _migrations.`);
  } finally {
    connection.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Wipe failed:', error.message);
  process.exit(1);
});
