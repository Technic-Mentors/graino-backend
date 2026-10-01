// test-clock.js
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '147.93.122.109',
  port: 3306,
  user: 'grai_uSRFmeRNdbGraino',
  password: 'grai_uSRFmeRNdbGraino',
  database: 'grai_meRnDbaSe',
});

const [rows] = await conn.query(`
  SELECT
    NOW()                AS mysql_now,
    UTC_TIMESTAMP()      AS mysql_utc,
    @@system_time_zone   AS sys_tz,
    @@global.time_zone   AS global_tz,
    @@session.time_zone  AS session_tz
`);
console.log('MySQL:', rows[0]);

console.log('Node  UTC now :', new Date().toISOString());
console.log('Node  local   :', new Date().toString());

await conn.end();