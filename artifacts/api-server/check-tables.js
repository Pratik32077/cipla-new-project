import mysql from "mysql2/promise";
import { config } from "dotenv";
import path from "path";

config({ path: "./.env" });

async function run() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    const [rows] = await conn.query("SHOW TABLES");
    console.log("Tables in database:", rows);
    await conn.end();
  } catch (err) {
    console.error("Error connecting to database:", err.message);
  }
}

run();
