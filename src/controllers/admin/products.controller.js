import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { publicPathFor, renameUploadedFile } from '../../config/upload.js';
import * as productService from '../../services/product.service.js';

export const list = asyncHandler(async (req, res) => {
  const { search, sort, page = 1, pageSize = 20 } = req.query;
  const { rows, meta } = await productService.listAdminProducts({
    search,
    sort,
    page: Number(page),
    pageSize: Number(pageSize),
  });
  res.json({ success: true, data: rows, meta });
});

export const getOne = asyncHandler(async (req, res) => {
  const product = await productService.getAdminProductById(Number(req.params.id));
  res.json({ success: true, data: product });
});

export const create = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);
  res.status(201).json({ success: true, data: product, message: 'Product created.' });
});

export const update = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(Number(req.params.id), req.body);
  res.json({ success: true, data: product, message: 'Product updated.' });
});

export const remove = asyncHandler(async (req, res) => {
  await productService.deleteProduct(Number(req.params.id));
  res.json({ success: true, message: 'Product deleted.' });
});

export const addVariant = asyncHandler(async (req, res) => {
  const variant = await productService.addVariant(Number(req.params.id), req.body);
  res.status(201).json({ success: true, data: variant, message: 'Variant added.' });
});

export const updateVariant = asyncHandler(async (req, res) => {
  const variant = await productService.updateVariant(
    Number(req.params.id),
    Number(req.params.variantId),
    req.body,
  );
  res.json({ success: true, data: variant, message: 'Variant updated.' });
});

export const removeVariant = asyncHandler(async (req, res) => {
  await productService.removeVariant(Number(req.params.id), Number(req.params.variantId));
  res.json({ success: true, message: 'Variant deleted.' });
});

export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No image file was uploaded.', 400);
  const productId = Number(req.params.id);
  const filename = renameUploadedFile('products', req.file);
  const imagePath = publicPathFor('products', filename);
  const image = await productService.addImage(productId, {
    variantId: req.body.variantId ? Number(req.body.variantId) : null,
    imagePath,
    isPrimary: req.body.isPrimary === 'true',
  });
  res.status(201).json({ success: true, data: image, message: 'Image uploaded.' });
});

export const removeImage = asyncHandler(async (req, res) => {
  await productService.removeImage(Number(req.params.id), Number(req.params.imageId));
  res.json({ success: true, message: 'Image removed.' });
});

export const makeImagePrimary = asyncHandler(async (req, res) => {
  await productService.makeImagePrimary(Number(req.params.id), Number(req.params.imageId));
  res.json({ success: true, message: 'Primary image updated.' });
});

export const lowStock = asyncHandler(async (req, res) => {
  const variants = await productService.listLowStock();
  res.json({ success: true, data: variants });
});
