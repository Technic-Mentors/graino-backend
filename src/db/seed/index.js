import bcrypt from 'bcrypt';
import { pool } from '../../config/db.js';
import { BRAND_NAME } from '../../config/brand.js';

async function seedAdmin() {
  const email = 'admin@mauniversal.com';
  const [existing] = await pool.query('SELECT id FROM admins WHERE email = ?', [email]);
  if (existing.length > 0) {
    console.log('Admin already exists, skipping.');
    return;
  }

  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);
  await pool.query('INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)', [
    'Store Admin',
    email,
    passwordHash,
  ]);
  console.log(`Admin created: ${email} / ChangeMe123! (change this after first login)`);
}

async function seedSampleProducts() {
  const products = [
    {
      name: 'Graino Dough Maker',
      slug: 'graino-dough-maker',
      description: 'The Graino Dough Maker — a smarter, easier way to prepare consistent atta, maida, and qeema dough.',
      fabric: 'Food-grade stainless steel',
      basePrice: 150,
      compareAtPrice: null,
      isFeatured: 1,
      variants: [
        { size: '3.5 kg', color: 'White', sku: 'AE-900A', stockQuantity: 10 },
        { size: '5 kg', color: 'White', sku: 'AE-221', stockQuantity: 8 },
      ],
    },
  ];

  for (const product of products) {
    const [existing] = await pool.query('SELECT id FROM products WHERE slug = ?', [product.slug]);
    if (existing.length > 0) continue;

    const [result] = await pool.query(
      `INSERT INTO products (name, slug, description, fabric, base_price, compare_at_price, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [product.name, product.slug, product.description, product.fabric, product.basePrice, product.compareAtPrice, product.isFeatured],
    );
    const productId = result.insertId;

    for (const variant of product.variants) {
      await pool.query(
        `INSERT INTO product_variants (product_id, size, color, sku, stock_quantity) VALUES (?, ?, ?, ?, ?)`,
        [productId, variant.size, variant.color, variant.sku, variant.stockQuantity],
      );
    }
    console.log(`Product created: ${product.name}`);
  }
}

async function seedSettings() {
  const defaults = {
    store_name: BRAND_NAME,
    // TODO: replace with MA Universal's real contact info once available.
    store_email: 'info@mauniversal.com',
    store_phone: '+00 000 0000000',
    store_address: 'Address TBD',
    // NOTE: default_shipping_rate is an unconfigured placeholder — set the real flat
    // rate (and any per-city zones) via /admin/shipping before launch.
    default_shipping_rate: '8',
    free_shipping_threshold: '5000',
    return_window_days: '7',
    return_policy_text: 'Items can be returned within 7 days of delivery if unused and in original packaging. Contact us to arrange a return.',
  };

  for (const [key, value] of Object.entries(defaults)) {
    await pool.query(
      'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_key = setting_key',
      [key, value],
    );
  }
  console.log('Default settings ensured.');
}

async function run() {
  try {
    await seedAdmin();
    await seedSampleProducts();
    await seedSettings();
    console.log('Seed complete.');
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exit(1);
});
