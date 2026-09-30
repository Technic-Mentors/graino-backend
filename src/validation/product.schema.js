import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'name_asc']).optional(),
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().optional(),
    featured: z.coerce.boolean().optional(),
  }),
});

export const priceRangeQuerySchema = z.object({
  query: z.object({}),
});

export const productSlugParamSchema = z.object({
  params: z.object({ slug: z.string().trim().min(1) }),
});

export const productIdParamSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

const variantInput = z.object({
  size: z.string().trim().min(1).max(30),
  color: z.string().trim().min(1).max(50),
  sku: z.string().trim().min(1).max(64),
  priceOverride: z.coerce.number().positive().optional().nullable(),
  stockQuantity: z.coerce.number().int().nonnegative(),
  lowStockThreshold: z.coerce.number().int().nonnegative().optional(),
});

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(200),
    description: z.string().trim().max(5000).optional().nullable(),
    careInstructions: z.string().trim().max(2000).optional().nullable(),
    fabric: z.string().trim().max(100).optional().nullable(),
    basePrice: z.coerce.number().positive(),
    compareAtPrice: z.coerce.number().positive().optional().nullable(),
    sortOrder: z.coerce.number().int().nonnegative().optional(),
    isFeatured: z.coerce.boolean().optional(),
    metaTitle: z.string().trim().max(200).optional().nullable(),
    metaDescription: z.string().trim().max(300).optional().nullable(),
    variants: z.array(variantInput).min(1, 'At least one variant is required'),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    name: z.string().trim().min(2).max(200),
    description: z.string().trim().max(5000).optional().nullable(),
    careInstructions: z.string().trim().max(2000).optional().nullable(),
    fabric: z.string().trim().max(100).optional().nullable(),
    basePrice: z.coerce.number().positive(),
    compareAtPrice: z.coerce.number().positive().optional().nullable(),
    sortOrder: z.coerce.number().int().nonnegative().optional(),
    isActive: z.coerce.boolean().optional(),
    isFeatured: z.coerce.boolean().optional(),
    metaTitle: z.string().trim().max(200).optional().nullable(),
    metaDescription: z.string().trim().max(300).optional().nullable(),
  }),
});

export const createVariantSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: variantInput,
});

export const updateVariantSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive(), variantId: z.coerce.number().int().positive() }),
  body: variantInput,
});
