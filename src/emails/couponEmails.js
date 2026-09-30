import { sendEmail } from '../config/mailer.js';
import { env } from '../config/env.js';
import { BRAND_NAME } from '../config/brand.js';
import * as customersDb from '../db/queries/customers.queries.js';
import { renderLayout, renderButton, sectionTitle, money, formatDate, NAVY, GOLD } from './layout.js';

// Gmail's plain SMTP transport (see config/mailer.js) has no queue or rate limiting of its
// own, so a bulk announcement is sent in small batches with a pause between them to stay
// well under Gmail's sending caps instead of firing hundreds of sends at once.
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 2000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function discountDescription(coupon) {
  return coupon.type === 'percentage' ? `${Number(coupon.value)}% off` : `${money(coupon.value)} off`;
}

function couponDetailsHtml(coupon) {
  const rows = [
    ['Discount', discountDescription(coupon)],
    coupon.min_order_value != null ? ['Minimum order', money(coupon.min_order_value)] : null,
    coupon.type === 'percentage' && coupon.max_discount_amount != null
      ? ['Maximum discount', money(coupon.max_discount_amount)]
      : null,
    coupon.usage_limit_per_customer != null
      ? ['Usage limit', `${coupon.usage_limit_per_customer} time(s) per customer`]
      : null,
    coupon.expires_at ? ['Valid until', formatDate(coupon.expires_at)] : null,
  ].filter(Boolean);

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: #57534e;">${label}</td>
          <td style="padding: 4px 0; font-size: 13px; text-align: right; font-weight: bold;">${value}</td>
        </tr>`,
    )
    .join('');

  return `<table style="width: 100%; border-collapse: collapse; margin-top: 8px;"><tbody>${rowsHtml}</tbody></table>`;
}

export async function sendCouponLaunchEmail(customer, coupon) {
  await sendEmail({
    to: customer.email,
    subject: `New coupon: ${coupon.code} — ${discountDescription(coupon)} at ${BRAND_NAME}`,
    html: renderLayout({
      heading: 'A new coupon just launched',
      bodyHtml: `
        <p>Hi ${customer.name},</p>
        <p>We've just launched a new coupon — use the code below at checkout to save on your next order.</p>

        <p style="margin: 20px 0; text-align: center;">
          <span style="display:inline-block; border: 2px dashed ${GOLD}; border-radius: 6px; padding: 10px 24px; font-size: 20px; font-weight: bold; letter-spacing: 0.1em; color: ${NAVY};">
            ${coupon.code}
          </span>
        </p>

        ${sectionTitle('Coupon Details')}
        ${couponDetailsHtml(coupon)}

        ${renderButton(`${env.urls.customerApp}/offers`, 'Shop Now')}
      `,
    }),
  });
}

export async function sendCouponLaunchEmailToAllCustomers(coupon) {
  const customers = await customersDb.listCustomersForMarketing();

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((customer) => sendCouponLaunchEmail(customer, coupon)));
    if (i + BATCH_SIZE < customers.length) {
      await delay(BATCH_DELAY_MS);
    }
  }
}
