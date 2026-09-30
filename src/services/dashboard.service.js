import * as dashboardDb from '../db/queries/dashboard.queries.js';
import * as reviewsDb from '../db/queries/reviews.queries.js';
import { listLowStockVariants } from '../db/queries/productVariants.queries.js';

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function percentChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

async function periodRevenue(currentStart, currentEnd, previousStart, previousEnd) {
  const [current, previous] = await Promise.all([
    dashboardDb.getRevenueBetween(currentStart, currentEnd),
    dashboardDb.getRevenueBetween(previousStart, previousEnd),
  ]);
  return {
    revenue: current.revenue,
    orderCount: current.orderCount,
    changePercent: percentChange(current.revenue, previous.revenue),
  };
}

export async function getDashboard({ trendDays = 30, topLimit = 8 } = {}) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = daysAgo(1);
  startOfYesterday.setHours(0, 0, 0, 0);

  const [
    today,
    week,
    month,
    statusCounts,
    salesTrend,
    topProducts,
    newCustomersThisWeek,
    newCustomersThisMonth,
    newVsReturning,
    recentOrders,
    topCoupons,
    lowStock,
    pendingReviews,
  ] = await Promise.all([
    periodRevenue(startOfToday, now, startOfYesterday, startOfToday),
    periodRevenue(daysAgo(7), now, daysAgo(14), daysAgo(7)),
    periodRevenue(daysAgo(30), now, daysAgo(60), daysAgo(30)),
    dashboardDb.getOrderStatusCounts(),
    dashboardDb.getSalesTrend(trendDays),
    dashboardDb.getTopProducts(trendDays, topLimit),
    dashboardDb.countNewCustomersBetween(daysAgo(7), now),
    dashboardDb.countNewCustomersBetween(daysAgo(30), now),
    dashboardDb.getNewVsReturningCounts(30),
    dashboardDb.getRecentOrders(10),
    dashboardDb.getTopCoupons(5),
    listLowStockVariants(),
    reviewsDb.countPending(),
  ]);

  const averageOrderValue = month.orderCount > 0 ? Math.round((month.revenue / month.orderCount) * 100) / 100 : 0;

  return {
    revenue: { today, week, month },
    averageOrderValue,
    ordersByStatus: statusCounts,
    pendingCodConfirmation: statusCounts.placed || 0,
    salesTrend,
    topProducts,
    newCustomers: { thisWeek: newCustomersThisWeek, thisMonth: newCustomersThisMonth },
    newVsReturningCustomers: newVsReturning,
    recentOrders,
    topCoupons,
    lowStock,
    pendingReviews,
  };
}
