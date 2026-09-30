import { pool } from '../../config/db.js';

const PRODUCT_LIST_SELECT = `
  SELECT p.*,
    (SELECT image_path FROM product_images pi WHERE pi.product_id = p.id
       ORDER BY is_primary DESC, sort_order ASC LIMIT 1) AS primary_image,
    (SELECT MIN(COALESCE(pv.price_override, p.base_price)) FROM product_variants pv
       WHERE pv.product_id = p.id) AS min_price,
    (SELECT COALESCE(SUM(pv.stock_quantity), 0) FROM product_variants pv
       WHERE pv.product_id = p.id) AS total_stock,
    (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r
       WHERE r.product_id = p.id AND r.status = 'approved') AS rating_avg,
    (SELECT COUNT(*) FROM reviews r
       WHERE r.product_id = p.id AND r.status = 'approved') AS rating_count
  FROM products p
`;

const SORT_COLUMNS = {
  newest: 'p.sort_order ASC, p.created_at DESC',
  price_asc: 'min_price ASC',
  price_desc: 'min_price DESC',
  name_asc: 'p.name ASC',
};

function buildListFilters({ search, minPrice, maxPrice, activeOnly, featuredOnly }) {
  const conditions = [];
  const params = [];

  if (activeOnly) conditions.push('p.is_active = 1');
  if (featuredOnly) conditions.push('p.is_featured = 1');
  if (search) {
    conditions.push('p.name LIKE ?');
    params.push(`%${search}%`);
  }

  const havingConditions = [];
  const havingParams = [];
  if (minPrice != null) {
    havingConditions.push('min_price >= ?');
    havingParams.push(minPrice);
  }
  if (maxPrice != null) {
    havingConditions.push('min_price <= ?');
    havingParams.push(maxPrice);
  }

  return { conditions, params, havingConditions, havingParams };
}

export async function listProducts({
  search,
  minPrice,
  maxPrice,
  activeOnly = true,
  featuredOnly = false,
  sort = 'newest',
  limit = 20,
  offset = 0,
}) {
  const { conditions, params, havingConditions, havingParams } = buildListFilters({
    search,
    minPrice,
    maxPrice,
    activeOnly,
    featuredOnly,
  });

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const havingClause = havingConditions.length ? `HAVING ${havingConditions.join(' AND ')}` : '';
  const orderBy = SORT_COLUMNS[sort] || SORT_COLUMNS.newest;

  const rowsQuery = pool.query(
    `${PRODUCT_LIST_SELECT} ${whereClause} ${havingClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, ...havingParams, limit, offset],
  );

  // Without a price filter, plain COUNT(*) on the base tables is equivalent to counting the
  // filtered set but skips recomputing the per-row min_price subquery for every product.
  const countQuery = havingClause
    ? pool.query(
        `SELECT COUNT(*) AS total FROM (
           SELECT p.id,
             (SELECT MIN(COALESCE(pv.price_override, p.base_price)) FROM product_variants pv
                WHERE pv.product_id = p.id) AS min_price
           FROM products p
           ${whereClause}
           ${havingClause}
         ) AS filtered`,
        [...params, ...havingParams],
      )
    : pool.query(`SELECT COUNT(*) AS total FROM products p ${whereClause}`, params);

  const [[rows], [countRows]] = await Promise.all([rowsQuery, countQuery]);

  return { rows, total: countRows[0].total };
}

export async function getPriceBounds({ activeOnly = true } = {}) {
  const conditions = [];
  const params = [];
  if (activeOnly) conditions.push('p.is_active = 1');
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT MIN(t.price) AS min_price, MAX(t.price) AS max_price FROM (
       SELECT COALESCE(pv.price_override, p.base_price) AS price
       FROM products p
       JOIN product_variants pv ON pv.product_id = p.id
       ${whereClause}
     ) t`,
    params,
  );

  return {
    minPrice: Number(rows[0]?.min_price ?? 0),
    maxPrice: Number(rows[0]?.max_price ?? 0),
  };
}

export async function findProductBySlug(slug, { activeOnly = true } = {}) {
  const where = activeOnly ? 'AND p.is_active = 1' : '';
  const [rows] = await pool.query(
    `SELECT p.* FROM products p WHERE p.slug = ? ${where} LIMIT 1`,
    [slug],
  );
  return rows[0] || null;
}

export async function findProductById(id) {
  const [rows] = await pool.query('SELECT p.* FROM products p WHERE p.id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function createProduct({
  name,
  slug,
  description,
  careInstructions,
  fabric,
  basePrice,
  compareAtPrice,
  isFeatured,
  sortOrder,
  metaTitle,
  metaDescription,
}) {
  const [result] = await pool.query(
    `INSERT INTO products
       (name, slug, description, care_instructions, fabric, base_price, compare_at_price, is_featured, sort_order, meta_title, meta_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      slug,
      description || null,
      careInstructions || null,
      fabric || null,
      basePrice,
      compareAtPrice || null,
      isFeatured ? 1 : 0,
      sortOrder ?? 0,
      metaTitle || null,
      metaDescription || null,
    ],
  );
  return result.insertId;
}

export async function updateProduct(id, {
  name,
  slug,
  description,
  careInstructions,
  fabric,
  basePrice,
  compareAtPrice,
  isActive,
  isFeatured,
  sortOrder,
  metaTitle,
  metaDescription,
}) {
  await pool.query(
    `UPDATE products SET
       name = ?, slug = ?, description = ?, care_instructions = ?, fabric = ?,
       base_price = ?, compare_at_price = ?, is_active = ?, is_featured = ?, sort_order = ?, meta_title = ?, meta_description = ?
     WHERE id = ?`,
    [
      name,
      slug,
      description || null,
      careInstructions || null,
      fabric || null,
      basePrice,
      compareAtPrice || null,
      isActive ? 1 : 0,
      isFeatured ? 1 : 0,
      sortOrder ?? 0,
      metaTitle || null,
      metaDescription || null,
      id,
    ],
  );
}

export async function deleteProduct(id) {
  await pool.query('DELETE FROM products WHERE id = ?', [id]);
}
