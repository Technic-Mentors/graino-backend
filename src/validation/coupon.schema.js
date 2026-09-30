import { z } from 'zod';

export const couponBodySchema = z.object({
  body: z.object({
    code: z.string().trim().min(3).max(50),
    type: z.enum(['percentage', 'fixed']),
    value: z.coerce.number().positive(),
    minOrderValue: z.coerce.number().nonnegative().optional().nullable(),
    maxDiscountAmount: z.coerce.number().positive().optional().nullable(),
    usageLimitTotal: z.coerce.number().int().positive().optional().nullable(),
    usageLimitPerCustomer: z.coerce.number().int().positive().optional().nullable(),
    isActive: z.coerce.boolean().optional(),
    startsAt: z.string().trim().optional().nullable(),
    expiresAt: z.string().trim().optional().nullable(),
  }),
});

export const couponIdParamSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

export const previewCouponSchema = z.object({
  body: z.object({ code: z.string().trim().min(1) }),
});

export const listCouponsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().optional(),
  }),
});
