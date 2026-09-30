import { AppError } from '../utils/AppError.js';
import * as reportsDb from '../db/queries/reports.queries.js';

function resolveRange(dateFrom, dateTo) {
  const end = dateTo ? new Date(`${dateTo}T23:59:59`) : new Date();
  const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError('Invalid date range.', 400);
  }
  if (start > end) throw new AppError('Start date must be before end date.', 400);

  return { start, end };
}

export async function getSalesReport({ dateFrom, dateTo, topLimit = 10, status }) {
  const { start, end } = resolveRange(dateFrom, dateTo);

  const [summary, trend, topProducts] = await Promise.all([
    reportsDb.getSalesSummary(start, end, status),
    reportsDb.getSalesTrendRange(start, end, status),
    reportsDb.getTopProductsRange(start, end, topLimit, status),
  ]);

  return { range: { start, end }, summary, trend, topProducts };
}

function csvEscape(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function exportSalesCsv({ dateFrom, dateTo, status }) {
  const { start, end } = resolveRange(dateFrom, dateTo);
  const orders = await reportsDb.getOrdersForExport(start, end, status);

  const headers = [
    'Order Number',
    'Date',
    'Customer Name',
    'Customer Email',
    'City',
    'Status',
    'Subtotal',
    'Discount',
    'Shipping',
    'Total',
  ];
  const lines = [headers.join(',')];

  for (const order of orders) {
    lines.push(
      [
        order.order_number,
        order.created_at,
        order.customer_name,
        order.customer_email,
        order.shipping_city,
        order.status,
        order.subtotal,
        order.discount_amount,
        order.shipping_charge,
        order.total,
      ]
        .map(csvEscape)
        .join(','),
    );
  }

  return lines.join('\n');
}
