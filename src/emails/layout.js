import { BRAND_NAME } from '../config/brand.js';

// Shared HTML email building blocks used by orderEmails.js, authEmails.js,
// couponEmails.js and notifyMeEmails.js so the brand shell, colors and copy
// only live in one place.

export const NAVY = '#172554'; // blue-950 — headings, buttons, section titles
export const GOLD = '#ca8a04'; // gold-600 — accent line, coupon-code highlight
const TEXT = '#1c1917';
const TEXT_LIGHT = '#57534e';
const BORDER = '#e7e5e4';
const SURFACE = '#fafaf9';

export const BRAND_CONTACT_LINE = `${BRAND_NAME} Dough Maker · Gondlanwala Rd, Gobandgarh, Gujranwala, 52250 · +92 3086256766`;

export function renderLayout({ heading, preheader, bodyHtml }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: ${TEXT}; background: #ffffff;">
      ${preheader ? `<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>` : ''}
      <div style="height: 4px; background: ${GOLD};"></div>
      <div style="padding: 24px 24px 16px; border-bottom: 2px solid ${NAVY};">
        <h1 style="margin: 0; font-size: 20px; color: ${NAVY};">${BRAND_NAME} <span style="color:${GOLD};">Dough Maker</span></h1>
        ${heading ? `<p style="margin: 4px 0 0; font-size: 14px; color: ${TEXT_LIGHT};">${heading}</p>` : ''}
      </div>
      <div style="padding: 20px 24px;">
        ${bodyHtml}
      </div>
      <div style="padding: 16px 24px; border-top: 1px solid ${BORDER}; font-size: 12px; color: ${TEXT_LIGHT};">
        ${BRAND_CONTACT_LINE}
      </div>
    </div>
  `;
}

export function money(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-PK')}`;
}

export function renderButton(href, label) {
  return `
    <p style="margin: 24px 0; text-align: center;">
      <a href="${href}"
         style="display:inline-block;background:${NAVY};color:#fff;padding:12px 28px;text-decoration:none;border-radius:4px;font-weight:bold;font-size:14px;">
        ${label}
      </a>
    </p>
  `;
}

export function sectionTitle(label) {
  return `<p style="margin: 20px 0 8px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: ${NAVY};">${label}</p>`;
}

export function renderAddressBlock(order) {
  const lines = [
    order.shipping_full_name,
    order.shipping_phone,
    order.shipping_address_line1,
    order.shipping_address_line2,
    order.shipping_city,
  ].filter(Boolean);
  return `<p style="margin: 0; font-size: 14px; line-height: 1.6;">${lines.join('<br/>')}</p>`;
}

export function renderItemsTable(items) {
  const rows = (items || [])
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BORDER}; font-size: 13px;">
            ${item.product_name}
            <span style="color: ${TEXT_LIGHT};">${[item.size, item.color].filter(Boolean).join(' / ')}</span>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BORDER}; font-size: 13px; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BORDER}; font-size: 13px; text-align: right;">${money(item.unit_price)}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BORDER}; font-size: 13px; text-align: right; font-weight: bold;">${money(item.line_total)}</td>
        </tr>`,
    )
    .join('');

  return `
    <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
      <thead>
        <tr>
          <th style="padding: 0 0 8px; border-bottom: 1px solid ${BORDER}; font-size: 11px; text-transform: uppercase; color: ${TEXT_LIGHT}; text-align: left;">Product</th>
          <th style="padding: 0 0 8px; border-bottom: 1px solid ${BORDER}; font-size: 11px; text-transform: uppercase; color: ${TEXT_LIGHT}; text-align: center;">Qty</th>
          <th style="padding: 0 0 8px; border-bottom: 1px solid ${BORDER}; font-size: 11px; text-transform: uppercase; color: ${TEXT_LIGHT}; text-align: right;">Price</th>
          <th style="padding: 0 0 8px; border-bottom: 1px solid ${BORDER}; font-size: 11px; text-transform: uppercase; color: ${TEXT_LIGHT}; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function renderTotalsBlock({ subtotal, discountAmount, couponCode, shippingCharge, total }) {
  const discountRow =
    discountAmount > 0
      ? `<tr>
           <td style="padding: 4px 0; font-size: 13px; color: ${TEXT_LIGHT};">Discount${couponCode ? ` (${couponCode})` : ''}</td>
           <td style="padding: 4px 0; font-size: 13px; text-align: right; color: ${TEXT_LIGHT};">-${money(discountAmount)}</td>
         </tr>`
      : '';

  return `
    <table style="width: 100%; border-collapse: collapse; margin-top: 12px; max-width: 260px; margin-left: auto;">
      <tbody>
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: ${TEXT_LIGHT};">Subtotal</td>
          <td style="padding: 4px 0; font-size: 13px; text-align: right; color: ${TEXT_LIGHT};">${money(subtotal)}</td>
        </tr>
        ${discountRow}
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: ${TEXT_LIGHT};">Shipping</td>
          <td style="padding: 4px 0; font-size: 13px; text-align: right; color: ${TEXT_LIGHT};">${money(shippingCharge)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0 0; font-size: 15px; font-weight: bold; border-top: 1px solid ${BORDER};">Total</td>
          <td style="padding: 8px 0 0; font-size: 15px; font-weight: bold; text-align: right; border-top: 1px solid ${BORDER};">${money(total)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

export function paymentMethodLabel(order) {
  return order.payment_method === 'bank_transfer' ? 'Bank Transfer' : 'Cash on Delivery';
}

export function formatDate(date) {
  return new Date(date).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
}
