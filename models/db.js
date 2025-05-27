import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: 'api/.env' });

export const db = await mysql.createPool({
  host: process.env.MYSQLHOST,
  port: Number(process.env.MYSQLPORT),
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  waitForConnections: true,
  connectionLimit: 10,
});