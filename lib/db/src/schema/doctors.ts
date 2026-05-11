import { pgTable, text, serial, timestamp, boolean, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const doctorsTable = pgTable("doctors", {
  id: serial("id").primaryKey(),
  managerId: integer("manager_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  doctorName: text("doctor_name").notNull(),
  specialization: text("specialization").notNull(),
  city: text("city").notNull(),
  clinicAddress: text("clinic_address"),
  phoneNumber: text("phone_number"),
  photoUrl: text("photo_url"),
  documentUrl: text("document_url"),
  photoUploadedAt: timestamp("photo_uploaded_at", { withTimezone: true }),
  documentUploadedAt: timestamp("document_uploaded_at", { withTimezone: true }),
  isComplete: boolean("is_complete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueDoctorPerManager: unique("unique_doctor_name_spec_city").on(
    table.doctorName,
    table.specialization,
    table.city
  ),
}));

export const insertDoctorSchema = createInsertSchema(doctorsTable).omit({ id: true, createdAt: true, isComplete: true, photoUrl: true, documentUrl: true, photoUploadedAt: true, documentUploadedAt: true });
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type Doctor = typeof doctorsTable.$inferSelect;
