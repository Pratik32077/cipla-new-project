import mysql from "mysql2/promise";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), "./.env") });

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "cipla_healthcare",
  });

  console.log("Connected to MySQL. Running migrations...");

  const migrations = [
    // Drop old tables if they exist and recreate them
    `DROP TABLE IF EXISTS doctors`,
    `DROP TABLE IF EXISTS users`,

    // Create users table
    `CREATE TABLE IF NOT EXISTS \`users\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`employee_code\` varchar(255) NOT NULL,
      \`password_hash\` varchar(255) NOT NULL,
      \`role\` enum('admin','manager') NOT NULL DEFAULT 'manager',
      \`created_at\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`users_id\` PRIMARY KEY(\`id\`),
      CONSTRAINT \`users_employee_code_unique\` UNIQUE(\`employee_code\`)
    )`,

    // Create doctors table
    `CREATE TABLE IF NOT EXISTS \`doctors\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`manager_id\` int NOT NULL,
      \`doctor_name\` varchar(255) NOT NULL,
      \`specialization\` varchar(255) NOT NULL,
      \`city\` varchar(255) NOT NULL,
      \`clinic_address\` text,
      \`phone_number\` varchar(50),
      \`photo_url\` varchar(512),
      \`document_url\` varchar(512),
      \`photo_uploaded_at\` timestamp,
      \`document_uploaded_at\` timestamp,
      \`is_complete\` boolean NOT NULL DEFAULT false,
      \`created_at\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`doctors_id\` PRIMARY KEY(\`id\`),
      CONSTRAINT \`unique_doctor_name_spec_city\` UNIQUE(\`doctor_name\`, \`specialization\`, \`city\`),
      CONSTRAINT \`doctors_manager_id_users_id_fk\` FOREIGN KEY (\`manager_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
    )`,
  ];

  for (const sql of migrations) {
    try {
      const preview = sql.replace(/\s+/g, " ").trim().slice(0, 80);
      console.log(`Running: ${preview}...`);
      await conn.execute(sql);
      console.log("  ✓ Done");
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
    }
  }

  await conn.end();
  console.log("\nMigration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
