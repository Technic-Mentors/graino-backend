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
  dateStrings: false,             // must be false so timezone conversion runs
  timezone: '+05:00',             // DB is UTC → convert to Pakistan time (PKT)
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

const RETRYABLE_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ETIMEDOUT',
  'ER_SERVER_SHUTDOWN',
  'EPIPE',
]);

// Remote MySQL hosts often close idle pool connections server-side (short wait_timeout)
// without the pool noticing until the next query fails. Retry once transparently on a
// fresh connection instead of surfacing a transient error to the user.
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

/**
 * Runs `work` inside a transaction, committing on success and rolling back on error.
 * `work` receives a dedicated connection — use it for every query in the transaction.
 */
export async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
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