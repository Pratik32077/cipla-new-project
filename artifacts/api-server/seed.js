import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), "./.env") });

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "cipla_healthcare",
  });

  console.log("Connected. Seeding users...");

  const passwordHash = await bcrypt.hash("Cipla@2024", 10);

  const users = [
    { name: "System Admin", employeeCode: "ADMIN001", role: "admin" },
    { name: "Project Manager", employeeCode: "MGR001", role: "manager" },
  ];

  for (const user of users) {
    try {
      await conn.execute(
        `INSERT INTO users (name, employee_code, password_hash, role)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [user.name, user.employeeCode, passwordHash, user.role]
      );
      console.log(`  ✓ Seeded: ${user.name} (${user.employeeCode})`);
    } catch (err) {
      console.error(`  ✗ Error seeding ${user.name}: ${err.message}`);
    }
  }

  await conn.end();
  console.log("\nSeeding complete!");
  console.log("Login credentials:");
  console.log("  Admin:   ADMIN001 / Cipla@2024");
  console.log("  Manager: MGR001   / Cipla@2024");
}

seed().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});
