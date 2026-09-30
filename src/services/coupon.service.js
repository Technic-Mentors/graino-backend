import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import * as couponsDb from '../db/queries/coupons.queries.js';
import * as couponUsagesDb from '../db/queries/couponUsages.queries.js';
import * as cartDb from '../db/queries/cartItems.queries.js';
import { sendCouponLaunchEmailToAllCustomers } from '../emails/couponEmails.js';

export async function listCoupons({ page, pageSize } = {}) {
  if (!page || !pageSize) {
    const { rows } = await couponsDb.listCoupons();
    return { rows, meta: null };
  }
  const offset = (page - 1) * pageSize;
  const { rows, total } = await couponsDb.listCoupons({ limit: pageSize, offset });
  return { rows, meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function getCoupon(id) {
  const coupon = await couponsDb.findCouponById(id);
  if (!coupon) throw new AppError('Coupon not found.', 404);
  return coupon;
}

export async function createCoupon(data) {
  const code = data.code.trim().toUpperCase();
  const existing = await couponsDb.findCouponByCode(code);
  if (existing) throw new AppError('A coupon with this code already exists.', 409);
  const id = await couponsDb.createCoupon({ ...data, code });
  const coupon = await couponsDb.findCouponById(id);

  // Fire-and-forget: don't make the admin wait on a bulk send to every customer.
  if (coupon.is_active) {
    sendCouponLaunchEmailToAllCustomers(coupon).catch((err) =>
      console.error('Failed to send coupon launch emails:', err),
    );
  }

  return coupon;
}

export async function updateCoupon(id, data) {
  await getCoupon(id);
  const code = data.code.trim().toUpperCase();
  await couponsDb.updateCoupon(id, { ...data, code });
  return couponsDb.findCouponById(id);
}

export async function deleteCoupon(id) {
  await getCoupon(id);
  await couponsDb.deleteCoupon(id);
}

/**
 * Validates a coupon against the current cart and returns the discount to apply.
 * Does not mutate anything — recording usage happens inside the order transaction.
 */
export async function previewDiscount({ code, customerId, subtotal }) {
  const coupon = await couponsDb.findCouponByCode(code.trim().toUpperCase());
  if (!coupon || !coupon.is_active) throw new AppError('Invalid or inactive coupon code.', 400);

  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    throw new AppError('This coupon is not active yet.', 400);
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < now) {
    throw new AppError('This coupon has expired.', 400);
  }
  if (coupon.usage_limit_total != null && coupon.times_used >= coupon.usage_limit_total) {
    throw new AppError('This coupon has reached its usage limit.', 400);
  }
  if (coupon.usage_limit_per_customer != null) {
    const used = await couponUsagesDb.countUsageByCustomer(coupon.id, customerId);
    if (used >= coupon.usage_limit_per_customer) {
      throw new AppError('You have already used this coupon the maximum number of times.', 400);
    }
  }

  if (subtotal <= 0) {
    throw new AppError('This coupon does not apply to any items in your cart.', 400);
  }
  if (coupon.min_order_value != null && subtotal < Number(coupon.min_order_value)) {
    throw new AppError(`This coupon requires a minimum order of $${coupon.min_order_value}.`, 400);
  }

  let discountAmount =
    coupon.type === 'percentage' ? (subtotal * Number(coupon.value)) / 100 : Number(coupon.value);

  if (coupon.max_discount_amount != null) {
    discountAmount = Math.min(discountAmount, Number(coupon.max_discount_amount));
  }
  discountAmount = Math.min(discountAmount, subtotal);

  return { coupon, discountAmount: Math.round(discountAmount * 100) / 100 };
}

/** Used by the cart page's "Apply coupon" button — previews the discount for the customer's current cart. */
export async function previewDiscountForCustomerCart(customerId, code) {
  const cartItems = await cartDb.listCartItems(customerId);
  if (cartItems.length === 0) throw new AppError('Your cart is empty.', 400);

  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);

  const { coupon, discountAmount } = await previewDiscount({ code, customerId, subtotal });
  return { code: coupon.code, discountAmount, subtotal };
}
