import { AppError } from '../utils/AppError.js';
import { slugify } from '../utils/slugify.js';
import { pool, withTransaction } from '../config/db.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import { deleteUploadedFile } from '../config/upload.js';
import * as productsDb from '../db/queries/products.queries.js';
import * as variantsDb from '../db/queries/productVariants.queries.js';
import * as imagesDb from '../db/queries/productImages.queries.js';
import { notifyBackInStock } from './notifyMe.service.js';

async function ensureUniqueProductSlug(name, excludeId = null) {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const [rows] = await pool.query(
      `SELECT id FROM products WHERE slug = ? ${excludeId ? 'AND id != ?' : ''} LIMIT 1`,
      excludeId ? [candidate, excludeId] : [candidate],
    );
    if (rows.length === 0) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

async function attachDetails(product) {
  const [variants, images] = await Promise.all([
    variantsDb.listVariantsForProduct(product.id),
    imagesDb.listImagesForProduct(product.id),
  ]);
  return { ...product, variants, images };
}

export async function listPublicProducts({ search, minPrice, maxPrice, sort, page, pageSize }) {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await productsDb.listProducts({
    search,
    minPrice,
    maxPrice,
    sort,
    activeOnly: true,
    limit: pageSize,
    offset,
  });

  return { rows, meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function getPublicPriceRange() {
  return productsDb.getPriceBounds({ activeOnly: true });
}

export async function listFeaturedProducts(limit = 8) {
  const { rows } = await productsDb.listProducts({ activeOnly: true, featuredOnly: true, limit, offset: 0 });
  return rows;
}

export async function getPublicProductBySlug(slug) {
  const product = await productsDb.findProductBySlug(slug, { activeOnly: true });
  if (!product) throw new AppError('Product not found.', 404);
  return attachDetails(product);
}

export async function listAdminProducts({ search, sort, page, pageSize }) {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await productsDb.listProducts({
    search,
    sort,
    activeOnly: false,
    limit: pageSize,
    offset,
  });
  return { rows, meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function getAdminProductById(id) {
  const product = await productsDb.findProductById(id);
  if (!product) throw new AppError('Product not found.', 404);
  return attachDetails(product);
}

export async function createProduct({ variants, ...productData }) {
  const slug = await ensureUniqueProductSlug(productData.name);

  return withTransaction(async (connection) => {
    const [result] = await connection.query(
      `INSERT INTO products
         (name, slug, description, care_instructions, fabric, base_price, compare_at_price, is_featured, sort_order, meta_title, meta_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productData.name,
        slug,
        productData.description || null,
        productData.careInstructions || null,
        productData.fabric || null,
        productData.basePrice,
        productData.compareAtPrice || null,
        productData.isFeatured ? 1 : 0,
        productData.sortOrder ?? 0,
        productData.metaTitle || null,
        productData.metaDescription || null,
      ],
    );
    const productId = result.insertId;

    for (const variant of variants) {
      await connection.query(
        `INSERT INTO product_variants (product_id, size, color, sku, price_override, stock_quantity, low_stock_threshold)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          variant.size,
          variant.color,
          variant.sku,
          variant.priceOverride || null,
          variant.stockQuantity,
          variant.lowStockThreshold ?? 5,
        ],
      );
    }

    return productId;
  }).then((productId) => getAdminProductById(productId));
}

export async function updateProduct(id, data) {
  await getAdminProductById(id);
  const slug = await ensureUniqueProductSlug(data.name, id);
  await productsDb.updateProduct(id, { ...data, slug });
  return getAdminProductById(id);
}

export async function deleteProduct(id) {
  const product = await getAdminProductById(id);
  try {
    await productsDb.deleteProduct(id);
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      throw new AppError('Cannot delete a product that has existing orders. Deactivate it instead.', 409);
    }
    throw error;
  }
  for (const image of product.images) {
    deleteUploadedFile(image.image_path);
  }
}

export async function addVariant(productId, data) {
  await getAdminProductById(productId);
  const id = await variantsDb.createVariant({ productId, ...data });
  return variantsDb.findVariantById(id);
}

export async function updateVariant(productId, variantId, data) {
  const variant = await variantsDb.findVariantById(variantId);
  if (!variant || variant.product_id !== productId) throw new AppError('Variant not found.', 404);
  await variantsDb.updateVariant(variantId, data);
  const updated = await variantsDb.findVariantById(variantId);

  // Fire-and-forget: don't make the admin wait on emailing everyone who asked to be notified.
  if (variant.stock_quantity <= 0 && updated.stock_quantity > 0) {
    notifyBackInStock(variantId).catch((err) => console.error('Failed to send back-in-stock emails:', err));
  }

  return updated;
}

export async function removeVariant(productId, variantId) {
  const variant = await variantsDb.findVariantById(variantId);
  if (!variant || variant.product_id !== productId) throw new AppError('Variant not found.', 404);
  try {
    await variantsDb.deleteVariant(variantId);
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      throw new AppError('Cannot delete a variant that has existing orders.', 409);
    }
    throw error;
  }
}

export async function addImage(productId, { variantId, imagePath, isPrimary }) {
  await getAdminProductById(productId);
  if (isPrimary) await imagesDb.clearPrimaryForProduct(productId);
  const id = await imagesDb.addProductImage({ productId, variantId, imagePath, isPrimary });
  return imagesDb.findImageById(id);
}

export async function removeImage(productId, imageId) {
  const image = await imagesDb.findImageById(imageId);
  if (!image || image.product_id !== productId) throw new AppError('Image not found.', 404);
  await imagesDb.deleteImage(imageId);
  deleteUploadedFile(image.image_path);
}

export async function makeImagePrimary(productId, imageId) {
  const image = await imagesDb.findImageById(imageId);
  if (!image || image.product_id !== productId) throw new AppError('Image not found.', 404);
  await imagesDb.clearPrimaryForProduct(productId);
  await imagesDb.setPrimaryImage(imageId);
}

export async function listLowStock() {
  return variantsDb.listLowStockVariants();
}
