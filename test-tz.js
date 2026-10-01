// test-fix.js
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '147.93.122.109',
  port: 3306,
  user: 'grai_uSRFmeRNdbGraino',
  password: 'grai_uSRFmeRNdbGraino',
  database: 'grai_meRnDbaSe',
  dateStrings: true,
  timezone: '+05:00',
});

await conn.query("SET time_zone = '+05:00'");

const [r] = await conn.query(`
  SELECT
    NOW()                AS with_pkt_tz,
    UTC_TIMESTAMP()      AS real_utc,
    @@session.time_zone  AS session_tz
`);

console.log('MySQL:', r[0]);
console.log('Node UTC now :', new Date().toISOString());
console.log('Node PKT now :', new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Karachi',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
}).format(new Date()).replace(', ', ' '));

await conn.end();