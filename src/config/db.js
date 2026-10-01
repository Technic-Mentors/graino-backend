import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 25,
  dateStrings: true,
  timezone: '+05:00',
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

// Force every new connection to use Pakistan time for NOW() / CURRENT_TIMESTAMP.
// (Workaround for the VPS OS clock being 5 hours slow; safe for this app only —
// other apps on the server are unaffected because this only sets the session TZ.)
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+05:00'");
});

const RETRYABLE_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ETIMEDOUT',
  'ER_SERVER_SHUTDOWN',
  'EPIPE',
]);

const originalQuery = pool.query.bind(pool);
pool.query = async function queryWithRetry(...args) {
  try {
    return await originalQuery(...args);
  } catch (error) {
    if (RETRYABLE_CODES.has(error.code)) {
      return originalQuery(...args);
    }
    throw error;
  }
};

export async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET time_zone = '+05:00'");
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}