import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env.js';
import { uploadsRoot } from './config/upload.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { shopRouter } from './routes/shop/index.js';
import { adminRouter } from './routes/admin/index.js';

// Serialize every Date to JSON as Pakistan time "YYYY-MM-DD HH:mm:ss"
// (DB stores UTC; the pool converts to PKT; this formats it as a clean string).
Date.prototype.toJSON = function () {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(this)
    .replace(', ', ' ');
};

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    // Reflects whatever Origin the request sends, so any domain can call this API.
    // Must be `true` (not `'*'`) because credentials: true requires a specific
    // (non-wildcard) Access-Control-Allow-Origin — the cors package handles that
    // by echoing the request's Origin header back instead of sending a literal '*'.
    // Note: combined with SameSite=None cookies in production, this removes CORS
    // as a CSRF boundary for the cookie-authenticated endpoints.
    origin: true,
    credentials: true,
  }),
);
app.use(compression());
app.use(cookieParser());
app.use(express.json());
app.use(morgan(env.isProduction ? 'combined' : 'dev'));
app.use('/uploads', express.static(uploadsRoot));

app.get('/health', (req, res) => res.json({ success: true, message: 'ok' }));

app.use('/api/v1/shop', shopRouter);
app.use('/api/v1/admin', adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);