import { Router } from 'express';
import * as catalogController from '../../controllers/shop/catalog.controller.js';
import { validate } from '../../middleware/validate.js';
import { listProductsQuerySchema, priceRangeQuerySchema, productSlugParamSchema } from '../../validation/product.schema.js';

export const catalogRouter = Router();

catalogRouter.get('/products', validate(listProductsQuerySchema), catalogController.listProducts);
catalogRouter.get('/products/featured', catalogController.listFeaturedProducts);
catalogRouter.get('/products/price-range', validate(priceRangeQuerySchema), catalogController.getPriceRange);
catalogRouter.get('/products/:slug', validate(productSlugParamSchema), catalogController.getProductBySlug);
