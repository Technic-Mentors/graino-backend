import { AppError } from '../utils/AppError.js';
import { withTransaction, pool } from '../config/db.js';
import { orderNumberFromId } from '../utils/orderNumber.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import * as cartDb from '../db/queries/cartItems.queries.js';
import * as variantsDb from '../db/queries/productVariants.queries.js';
import * as ordersDb from '../db/queries/orders.queries.js';
import * as orderItemsDb from '../db/queries/orderItems.queries.js';
import * as historyDb from '../db/queries/orderStatusHistory.queries.js';
import * as couponUsagesDb from '../db/queries/couponUsages.queries.js';
import * as couponsDb from '../db/queries/coupons.queries.js';
import * as addressesDb from '../db/queries/addresses.queries.js';
import * as notificationsDb from '../db/queries/notifications.queries.js';
import { computeShippingCharge } from './shipping.service.js';
import { previewDiscount } from './coupon.service.js';
import { sendOrderPlacedEmail, sendOrderStatusEmail, sendAdminNewOrderAlert } from '../emails/orderEmails.js';
import { findCustomerById } from '../db/queries/customers.queries.js';
import { findAdminById } from '../db/queries/admins.queries.js';

const ALLOWED_TRANSITIONS = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

async function buildOrderDetail(order) {
  const [items, history] = await Promise.all([
    orderItemsDb.listItemsForOrder(order.id),
    historyDb.listHistoryForOrder(order.id),
  ]);
  return { ...order, items, history };
}

export async function placeOrder(customerId, { addressId, shipping, couponCode, paymentMethod }) {
  const customer = await findCustomerById(customerId);
  const cartItems = await cartDb.listCartItems(customerId);
  if (cartItems.length === 0) throw new AppError('Your cart is empty.', 400);

  const inactiveItem = cartItems.find((item) => !item.is_active);
  if (inactiveItem) {
    throw new AppError(`${inactiveItem.product_name} is no longer available. Please remove it from your cart.`, 400);
  }

  let shippingDetails;
  if (addressId) {
    const address = await addressesDb.findAddressById(addressId, customerId);
    if (!address) throw new AppError('Address not found.', 404);
    shippingDetails = {
      fullName: address.full_name,
      phone: address.phone,
      addressLine1: address.address_line1,
      addressLine2: address.address_line2,
      city: address.city,
    };
  } else if (shipping) {
    shippingDetails = shipping;
  } else {
    throw new AppError('Shipping address is required.', 400);
  }

  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);

  let discountAmount = 0;
  let coupon = null;
  if (couponCode) {
    const result = await previewDiscount({ code: couponCode, customerId, subtotal });
    coupon = result.coupon;
    discountAmount = result.discountAmount;
  }

  const shippingCharge = await computeShippingCharge(shippingDetails.city, subtotal);
  const total = Math.max(0, subtotal - discountAmount + shippingCharge);

  const orderId = await withTransaction(async (connection) => {
    for (const item of cartItems) {
      const variant = await variantsDb.findVariantByIdForUpdate(connection, item.variant_id);
      if (!variant || variant.stock_quantity < item.quantity) {
        throw new AppError(
          `${item.product_name} (${item.size}/${item.color}) no longer has enough stock. Please update your cart.`,
          409,
        );
      }
    }

    const newOrderId = await ordersDb.insertOrderShell(connection, {
      customerId,
      paymentMethod,
      subtotal,
      discountAmount,
      shippingCharge,
      total,
      couponId: coupon?.id,
      shippingFullName: shippingDetails.fullName,
      shippingPhone: shippingDetails.phone,
      shippingAddressLine1: shippingDetails.addressLine1,
      shippingAddressLine2: shippingDetails.addressLine2,
      shippingCity: shippingDetails.city,
    });
    await ordersDb.setOrderNumber(connection, newOrderId, orderNumberFromId(newOrderId));

    for (const item of cartItems) {
      await orderItemsDb.insertOrderItem(connection, {
        orderId: newOrderId,
        productId: item.product_id,
        variantId: item.variant_id,
        productName: item.product_name,
        size: item.size,
        color: item.color,
        sku: item.sku,
        unitPrice: item.unit_price,
        quantity: item.quantity,
        lineTotal: Number(item.unit_price) * item.quantity,
      });
      await variantsDb.decrementStock(connection, item.variant_id, item.quantity);
    }

    await historyDb.insertStatusHistory(connection, {
      orderId: newOrderId,
      status: 'placed',
      changedBy: 'customer',
      actorName: customer.name,
    });

    if (coupon) {
      await couponUsagesDb.recordUsage(connection, {
        couponId: coupon.id,
        customerId,
        orderId: newOrderId,
        discountAmount,
      });
      await couponsDb.incrementTimesUsed(connection, coupon.id);
    }

    await cartDb.clearCartInTransaction(connection, customerId);

    return newOrderId;
  });

  const order = await ordersDb.findOrderById(orderId);
  const orderItemsForEmail = await orderItemsDb.listItemsForOrder(orderId);

  await Promise.all([
    sendOrderPlacedEmail({ customer, order, items: orderItemsForEmail, couponCode: coupon?.code }),
    sendAdminNewOrderAlert({ customer, order, items: orderItemsForEmail, couponCode: coupon?.code }),
    notificationsDb.createNotification({
      type: 'new_order',
      title: 'New order received',
      message: `Order ${order.order_number} — Rs. ${order.total}`,
      link: `/admin/orders/${order.id}`,
    }),
  ]);

  return buildOrderDetail(order);
}

export async function trackOrder(orderNumber, phone) {
  const order = await ordersDb.findOrderByNumberAndPhone(orderNumber.toUpperCase(), phone);
  if (!order) {
    throw new AppError('No order found for that order number and phone number.', 404);
  }
  return buildOrderDetail(order);
}

export async function getOrderForCustomer(orderId, customerId) {
  const order = await ordersDb.findOrderByIdForCustomer(orderId, customerId);
  if (!order) throw new AppError('Order not found.', 404);
  return buildOrderDetail(order);
}

export async function listOrdersForCustomer(customerId) {
  return ordersDb.listOrdersForCustomer(customerId);
}

export async function cancelOrderByCustomer(orderId, customerId, reason) {
  const order = await ordersDb.findOrderByIdForCustomer(orderId, customerId);
  if (!order) throw new AppError('Order not found.', 404);
  if (order.status !== 'placed') {
    throw new AppError('This order can no longer be cancelled — it has already been confirmed.', 400);
  }

  const customer = await findCustomerById(customerId);

  await withTransaction(async (connection) => {
    const items = await orderItemsDb.listItemsForOrder(orderId);
    for (const item of items) {
      await variantsDb.incrementStock(connection, item.product_variant_id, item.quantity);
    }
    await ordersDb.markOrderCancelled(connection, orderId, { cancelledBy: 'customer', reason });
    await historyDb.insertStatusHistory(connection, {
      orderId,
      status: 'cancelled',
      changedBy: 'customer',
      actorName: customer.name,
      note: reason,
    });
  });

  const updated = await ordersDb.findOrderById(orderId);
  await Promise.all([
    sendOrderStatusEmail(customer, updated),
    notificationsDb.createNotification({
      type: 'order_cancelled',
      title: `Order ${updated.order_number} cancelled`,
      message: reason ? `Your order was cancelled. Reason: ${reason}` : 'Your order was cancelled.',
      link: `/account/orders/${updated.id}`,
      customerId,
    }),
  ]);
  return buildOrderDetail(updated);
}

export async function listOrdersAdmin({ status, search, dateFrom, dateTo, page, pageSize }) {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await ordersDb.listOrdersAdmin({ status, search, dateFrom, dateTo, limit: pageSize, offset });
  return { rows, meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function getOrderAdmin(orderId) {
  const order = await ordersDb.findOrderById(orderId);
  if (!order) throw new AppError('Order not found.', 404);
  return buildOrderDetail(order);
}

export async function updateOrderStatusAdmin(orderId, newStatus, note, adminId) {
  const order = await ordersDb.findOrderById(orderId);
  if (!order) throw new AppError('Order not found.', 404);

  const allowed = ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(`Cannot move an order from "${order.status}" to "${newStatus}".`, 400);
  }

  const admin = await findAdminById(adminId);

  await withTransaction(async (connection) => {
    if (newStatus === 'cancelled') {
      const items = await orderItemsDb.listItemsForOrder(orderId);
      for (const item of items) {
        await variantsDb.incrementStock(connection, item.product_variant_id, item.quantity);
      }
      await ordersDb.markOrderCancelled(connection, orderId, { cancelledBy: 'admin', reason: note });
    } else {
      await ordersDb.updateOrderStatus(connection, orderId, newStatus);
    }
    await historyDb.insertStatusHistory(connection, {
      orderId,
      status: newStatus,
      changedBy: 'admin',
      actorName: admin?.name,
      note,
    });
  });

  if (newStatus === 'delivered') {
    await ordersDb.markPaymentCollected(orderId);
  }

  const updated = await ordersDb.findOrderById(orderId);
  const customer = await findCustomerById(updated.customer_id);

  const notificationMessage =
    newStatus === 'cancelled'
      ? note
        ? `Your order was cancelled. Reason: ${note}`
        : 'Your order was cancelled.'
      : `Your order status is now "${newStatus}".`;

  await Promise.all([
    sendOrderStatusEmail(customer, updated),
    notificationsDb.createNotification({
      type: newStatus === 'cancelled' ? 'order_cancelled' : 'order_status',
      title: `Order ${updated.order_number} update`,
      message: notificationMessage,
      link: `/account/orders/${updated.id}`,
      customerId: updated.customer_id,
    }),
  ]);

  return buildOrderDetail(updated);
}
