// Single source of truth for brand-derived defaults — env.js, utils/orderNumber.js,
// emails/*.js and server.js all read from this file instead of hardcoding brand strings.

export const BRAND_NAME = 'Graino';
export const ORDER_NUMBER_PREFIX = 'GR';
export const DEFAULT_PORT = 3007;
// NOTE: only the display name changed here — the actual mailbox stays as-is until
// a real Graino-branded inbox is set up and its credentials are added to .env.
export const DEFAULT_EMAIL_FROM = 'Graino <abdullahkneadersofficial@gmail.com>';
