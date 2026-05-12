import { mysqlTable, varchar, int, timestamp, boolean, unique, text } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const doctorsTable = mysqlTable("doctors", {
  id: int("id").autoincrement().primaryKey(),
  managerId: int("manager_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  doctorName: varchar("doctor_name", { length: 255 }).notNull(),
  specialization: varchar("specialization", { length: 255 }).notNull(),
  city: varchar("city", { length: 255 }).notNull(),
  clinicAddress: text("clinic_address"),
  phoneNumber: varchar("phone_number", { length: 50 }),
  photoUrl: varchar("photo_url", { length: 512 }),
  documentUrl: varchar("document_url", { length: 512 }),
  photoUploadedAt: timestamp("photo_uploaded_at"),
  documentUploadedAt: timestamp("document_uploaded_at"),
  isComplete: boolean("is_complete").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueDoctorNameSpecCity: unique("unique_doctor_name_spec_city").on(
    table.doctorName,
    table.specialization,
    table.city
  ),
}));

export const insertDoctorSchema = createInsertSchema(doctorsTable).omit({ id: true, createdAt: true, isComplete: true, photoUrl: true, documentUrl: true, photoUploadedAt: true, documentUploadedAt: true });
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type Doctor = typeof doctorsTable.$inferSelect;
