import { asyncHandler } from '../../utils/asyncHandler.js';
import * as productService from '../../services/product.service.js';

export const listProducts = asyncHandler(async (req, res) => {
  const { search, minPrice, maxPrice, sort, page = 1, pageSize = 20 } = req.query;
  const { rows, meta } = await productService.listPublicProducts({
    search,
    minPrice,
    maxPrice,
    sort,
    page,
    pageSize,
  });
  res.json({ success: true, data: rows, meta });
});

export const getPriceRange = asyncHandler(async (req, res) => {
  const range = await productService.getPublicPriceRange();
  res.json({ success: true, data: range });
});

export const listFeaturedProducts = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const products = await productService.listFeaturedProducts(limit);
  res.json({ success: true, data: products });
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await productService.getPublicProductBySlug(req.params.slug);
  res.json({ success: true, data: product });
});
