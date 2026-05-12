import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, doctorsTable } from "@workspace/db";
import { eq, and, gte, lte, like, or, sql, count, desc } from "drizzle-orm";
import ExcelJS from "exceljs";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

// Admin dashboard stats
router.get("/admin/dashboard", requireAdmin, async (req, res): Promise<void> => {
  const { startDate, endDate } = req.query;

  let dateFilter: ReturnType<typeof and> = undefined;
  if (startDate && endDate) {
    dateFilter = and(
      gte(doctorsTable.createdAt, new Date(startDate as string)),
      lte(doctorsTable.createdAt, new Date(endDate as string))
    );
  } else if (startDate) {
    dateFilter = gte(doctorsTable.createdAt, new Date(startDate as string));
  } else if (endDate) {
    dateFilter = lte(doctorsTable.createdAt, new Date(endDate as string));
  }

  const whereClause = dateFilter ?? undefined;

  const [totalDoctorsResult] = await db
    .select({ count: count() })
    .from(doctorsTable)
    .where(whereClause);

  const [totalPhotosResult] = await db
    .select({ count: count() })
    .from(doctorsTable)
    .where(
      whereClause
        ? and(whereClause, sql`${doctorsTable.photoUrl} IS NOT NULL`)
        : sql`${doctorsTable.photoUrl} IS NOT NULL`
    );

  const [totalDocumentsResult] = await db
    .select({ count: count() })
    .from(doctorsTable)
    .where(
      whereClause
        ? and(whereClause, sql`${doctorsTable.documentUrl} IS NOT NULL`)
        : sql`${doctorsTable.documentUrl} IS NOT NULL`
    );

  const [pendingResult] = await db
    .select({ count: count() })
    .from(doctorsTable)
    .where(
      whereClause
        ? and(whereClause, eq(doctorsTable.isComplete, false))
        : eq(doctorsTable.isComplete, false)
    );

  const [managersResult] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(eq(usersTable.role, "manager"));

  // Recent additions (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const [recentResult] = await db
    .select({ count: count() })
    .from(doctorsTable)
    .where(gte(doctorsTable.createdAt, sevenDaysAgo));

  const totalDoctors = totalDoctorsResult?.count ?? 0;
  const totalPhotos = totalPhotosResult?.count ?? 0;
  const totalDocuments = totalDocumentsResult?.count ?? 0;
  const pendingProfiles = pendingResult?.count ?? 0;
  const totalManagers = managersResult?.count ?? 0;
  const recentAdditions = recentResult?.count ?? 0;

  const completionPercentage = totalDoctors > 0
    ? Math.round(((totalDoctors - pendingProfiles) / totalDoctors) * 100 * 10) / 10
    : 0;

  res.json({
    totalDoctors,
    totalPhotos,
    totalDocuments,
    pendingProfiles,
    completionPercentage,
    totalManagers,
    recentAdditions,
  });
});

// Daily additions chart data
router.get("/admin/daily-additions", requireAdmin, async (req, res): Promise<void> => {
  const days = parseInt((req.query.days as string) || "30", 10);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select({
      date: sql<string>`DATE(${doctorsTable.createdAt})::text`,
      count: count(),
    })
    .from(doctorsTable)
    .where(gte(doctorsTable.createdAt, since))
    .groupBy(sql`DATE(${doctorsTable.createdAt})`)
    .orderBy(sql`DATE(${doctorsTable.createdAt})`);

  res.json(rows);
});

// Manager performance
router.get("/admin/manager-performance", requireAdmin, async (req, res): Promise<void> => {
  const managers = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "manager"));

  const performance = await Promise.all(
    managers.map(async (manager) => {
      const [totalResult] = await db
        .select({ count: count() })
        .from(doctorsTable)
        .where(eq(doctorsTable.managerId, manager.id));

      const [completedResult] = await db
        .select({ count: count() })
        .from(doctorsTable)
        .where(and(eq(doctorsTable.managerId, manager.id), eq(doctorsTable.isComplete, true)));

      const total = totalResult?.count ?? 0;
      const completed = completedResult?.count ?? 0;

      return {
        id: manager.id,
        name: manager.name,
        totalDoctors: total,
        completedProfiles: completed,
        completionPercentage: total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 0,
      };
    })
  );

  res.json(performance);
});

// List all managers with stats
router.get("/admin/managers", requireAdmin, async (req, res): Promise<void> => {
  const managers = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "manager"))
    .orderBy(desc(usersTable.createdAt));

  const managersWithStats = await Promise.all(
    managers.map(async (manager) => {
      const [totalResult] = await db
        .select({ count: count() })
        .from(doctorsTable)
        .where(eq(doctorsTable.managerId, manager.id));

      const [photosResult] = await db
        .select({ count: count() })
        .from(doctorsTable)
        .where(and(eq(doctorsTable.managerId, manager.id), sql`${doctorsTable.photoUrl} IS NOT NULL`));

      const [docsResult] = await db
        .select({ count: count() })
        .from(doctorsTable)
        .where(and(eq(doctorsTable.managerId, manager.id), sql`${doctorsTable.documentUrl} IS NOT NULL`));

      const [completedResult] = await db
        .select({ count: count() })
        .from(doctorsTable)
        .where(and(eq(doctorsTable.managerId, manager.id), eq(doctorsTable.isComplete, true)));

      const total = totalResult?.count ?? 0;
      const completed = completedResult?.count ?? 0;

      return {
        id: manager.id,
        name: manager.name,
        employeeCode: manager.employeeCode,
        totalDoctors: total,
        photosUploaded: photosResult?.count ?? 0,
        documentsUploaded: docsResult?.count ?? 0,
        completedProfiles: completed,
        completionPercentage: total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 0,
        createdAt: manager.createdAt.toISOString(),
      };
    })
  );

  res.json(managersWithStats);
});

// Create a manager
router.post("/admin/managers", requireAdmin, async (req, res): Promise<void> => {
  const { name, employeeCode, password } = req.body;

  if (!name || !employeeCode || !password) {
    res.status(400).json({ error: "Name, employee code, and password are required" });
    return;
  }

  // Check for duplicate employee code
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.employeeCode, employeeCode));

  if (existing) {
    res.status(400).json({ error: "Employee code already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [result] = await db
    .insert(usersTable)
    .values({ name, employeeCode, passwordHash, role: "manager" });

  const managerId = result.insertId;
  const createdAt = new Date();

  res.status(201).json({
    id: managerId,
    name,
    employeeCode,
    role: "manager",
    createdAt: createdAt.toISOString(),
  });
});

// Delete a manager
router.delete("/admin/managers/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId!, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid manager ID" });
    return;
  }

  const [existingManager] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.role, "manager")));

  if (!existingManager) {
    res.status(404).json({ error: "Manager not found" });
    return;
  }

  await db
    .delete(usersTable)
    .where(eq(usersTable.id, id));

  res.json({ message: "Manager deleted successfully" });
});

// List all doctors (admin)
router.get("/admin/doctors", requireAdmin, async (req, res): Promise<void> => {
  const {
    search,
    managerId,
    status,
    city,
    startDate,
    endDate,
    page = "1",
    limit = "20",
  } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
  const offset = (pageNum - 1) * limitNum;

  const conditions: ReturnType<typeof sql>[] = [];

  if (search) {
    conditions.push(
      sql`(${like(doctorsTable.doctorName, `%${search}%`)} OR ${like(doctorsTable.specialization, `%${search}%`)} OR ${like(doctorsTable.city, `%${search}%`)})`
    );
  }
  if (managerId) {
    conditions.push(eq(doctorsTable.managerId, parseInt(managerId as string, 10)));
  }
  if (status === "complete") {
    conditions.push(eq(doctorsTable.isComplete, true));
  } else if (status === "incomplete") {
    conditions.push(eq(doctorsTable.isComplete, false));
  }
  if (city) {
    conditions.push(like(doctorsTable.city, `%${city}%`));
  }
  if (startDate) {
    conditions.push(gte(doctorsTable.createdAt, new Date(startDate as string)));
  }
  if (endDate) {
    conditions.push(lte(doctorsTable.createdAt, new Date(endDate as string)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(doctorsTable)
    .where(whereClause);

  const doctors = await db
    .select({
      id: doctorsTable.id,
      managerId: doctorsTable.managerId,
      managerName: usersTable.name,
      doctorName: doctorsTable.doctorName,
      specialization: doctorsTable.specialization,
      city: doctorsTable.city,
      clinicAddress: doctorsTable.clinicAddress,
      phoneNumber: doctorsTable.phoneNumber,
      photoUrl: doctorsTable.photoUrl,
      documentUrl: doctorsTable.documentUrl,
      photoUploadedAt: doctorsTable.photoUploadedAt,
      documentUploadedAt: doctorsTable.documentUploadedAt,
      isComplete: doctorsTable.isComplete,
      createdAt: doctorsTable.createdAt,
    })
    .from(doctorsTable)
    .leftJoin(usersTable, eq(doctorsTable.managerId, usersTable.id))
    .where(whereClause)
    .orderBy(desc(doctorsTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  res.json({
    doctors: doctors.map((d) => ({
      ...d,
      photoUploadedAt: d.photoUploadedAt?.toISOString() ?? null,
      documentUploadedAt: d.documentUploadedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

// Export all doctors to Excel
router.get("/admin/export", requireAdmin, async (req, res): Promise<void> => {
  const { managerId, startDate, endDate } = req.query;

  const conditions: ReturnType<typeof sql>[] = [];
  if (managerId) {
    conditions.push(eq(doctorsTable.managerId, parseInt(managerId as string, 10)));
  }
  if (startDate) {
    conditions.push(gte(doctorsTable.createdAt, new Date(startDate as string)));
  }
  if (endDate) {
    conditions.push(lte(doctorsTable.createdAt, new Date(endDate as string)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const doctors = await db
    .select({
      id: doctorsTable.id,
      managerName: usersTable.name,
      doctorName: doctorsTable.doctorName,
      specialization: doctorsTable.specialization,
      city: doctorsTable.city,
      clinicAddress: doctorsTable.clinicAddress,
      phoneNumber: doctorsTable.phoneNumber,
      photoUrl: doctorsTable.photoUrl,
      documentUrl: doctorsTable.documentUrl,
      isComplete: doctorsTable.isComplete,
      createdAt: doctorsTable.createdAt,
    })
    .from(doctorsTable)
    .leftJoin(usersTable, eq(doctorsTable.managerId, usersTable.id))
    .where(whereClause)
    .orderBy(desc(doctorsTable.createdAt));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Doctors");

  sheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Manager", key: "managerName", width: 20 },
    { header: "Doctor Name", key: "doctorName", width: 25 },
    { header: "Specialization", key: "specialization", width: 20 },
    { header: "City", key: "city", width: 15 },
    { header: "Clinic Address", key: "clinicAddress", width: 30 },
    { header: "Phone Number", key: "phoneNumber", width: 15 },
    { header: "Photo Uploaded", key: "photoUrl", width: 15 },
    { header: "Document Uploaded", key: "documentUrl", width: 18 },
    { header: "Status", key: "isComplete", width: 12 },
    { header: "Added On", key: "createdAt", width: 20 },
  ];

  // Style header row
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  };

  doctors.forEach((doc) => {
    sheet.addRow({
      ...doc,
      photoUrl: doc.photoUrl ? "Yes" : "No",
      documentUrl: doc.documentUrl ? "Yes" : "No",
      isComplete: doc.isComplete ? "Complete" : "Incomplete",
      createdAt: doc.createdAt.toLocaleDateString(),
    });
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=cipla-doctors-export.xlsx");

  await workbook.xlsx.write(res);
  res.end();
});

// Export manager's doctors
router.get("/admin/managers/:id/export", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const managerId = parseInt(rawId!, 10);

  if (isNaN(managerId)) {
    res.status(400).json({ error: "Invalid manager ID" });
    return;
  }

  const doctors = await db
    .select({
      id: doctorsTable.id,
      doctorName: doctorsTable.doctorName,
      specialization: doctorsTable.specialization,
      city: doctorsTable.city,
      clinicAddress: doctorsTable.clinicAddress,
      phoneNumber: doctorsTable.phoneNumber,
      photoUrl: doctorsTable.photoUrl,
      documentUrl: doctorsTable.documentUrl,
      isComplete: doctorsTable.isComplete,
      createdAt: doctorsTable.createdAt,
    })
    .from(doctorsTable)
    .where(eq(doctorsTable.managerId, managerId))
    .orderBy(desc(doctorsTable.createdAt));

  const [manager] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, managerId));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Doctors");

  sheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Doctor Name", key: "doctorName", width: 25 },
    { header: "Specialization", key: "specialization", width: 20 },
    { header: "City", key: "city", width: 15 },
    { header: "Clinic Address", key: "clinicAddress", width: 30 },
    { header: "Phone Number", key: "phoneNumber", width: 15 },
    { header: "Photo Uploaded", key: "photoUrl", width: 15 },
    { header: "Document Uploaded", key: "documentUrl", width: 18 },
    { header: "Status", key: "isComplete", width: 12 },
    { header: "Added On", key: "createdAt", width: 20 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  };

  doctors.forEach((doc) => {
    sheet.addRow({
      ...doc,
      photoUrl: doc.photoUrl ? "Yes" : "No",
      documentUrl: doc.documentUrl ? "Yes" : "No",
      isComplete: doc.isComplete ? "Complete" : "Incomplete",
      createdAt: doc.createdAt.toLocaleDateString(),
    });
  });

  const managerName = manager?.name ?? "manager";
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=${managerName.replace(/\s+/g, "-")}-doctors.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
});

export default router;
