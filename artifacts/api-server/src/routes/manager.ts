import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { db, usersTable, doctorsTable } from "@workspace/db";
import { eq, and, like, sql, count, desc } from "drizzle-orm";
import ExcelJS from "exceljs";
import { requireManager } from "../middlewares/auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsBase = path.join(__dirname, "..", "uploads");

const photosDir = path.join(uploadsBase, "photos");
fs.mkdirSync(photosDir, { recursive: true });

const photoStorage = multer.diskStorage({
  destination: photosDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `photo-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, JPEG, and PNG files are allowed"));
    }
  },
});

const router = Router();

// Manager dashboard stats
router.get("/manager/dashboard", requireManager, async (req, res): Promise<void> => {
  const managerId = req.session.userId!;

  const [totalResult] = await db
    .select({ count: count() })
    .from(doctorsTable)
    .where(eq(doctorsTable.managerId, managerId));

  const [photosResult] = await db
    .select({ count: count() })
    .from(doctorsTable)
    .where(and(eq(doctorsTable.managerId, managerId), sql`${doctorsTable.photoUrl} IS NOT NULL`));

  const [completedResult] = await db
    .select({ count: count() })
    .from(doctorsTable)
    .where(and(eq(doctorsTable.managerId, managerId), eq(doctorsTable.isComplete, true)));

  const total = totalResult?.count ?? 0;
  const completed = completedResult?.count ?? 0;

  res.json({
    totalDoctors: total,
    photosUploaded: photosResult?.count ?? 0,
    completedProfiles: completed,
    completionPercentage: total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 0,
  });
});

// List manager's doctors
router.get("/manager/doctors", requireManager, async (req, res): Promise<void> => {
  const managerId = req.session.userId!;
  const { search, status, city, page = "1", limit = "20" } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [eq(doctorsTable.managerId, managerId)];

  if (search) {
    conditions.push(
      sql`(${like(doctorsTable.doctorName, `%${search}%`)} OR ${like(doctorsTable.specialization, `%${search}%`)} OR ${like(doctorsTable.city, `%${search}%`)})`
    );
  }
  if (status === "complete") {
    conditions.push(eq(doctorsTable.isComplete, true));
  } else if (status === "incomplete") {
    conditions.push(eq(doctorsTable.isComplete, false));
  }
  if (city) {
    conditions.push(like(doctorsTable.city, `%${city}%`));
  }

  const whereClause = and(...conditions);

  const [{ total }] = await db
    .select({ total: count() })
    .from(doctorsTable)
    .where(whereClause);

  const doctors = await db
    .select()
    .from(doctorsTable)
    .where(whereClause)
    .orderBy(desc(doctorsTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  res.json({
    doctors: doctors.map((d) => ({
      ...d,
      managerName: null,
      photoUploadedAt: d.photoUploadedAt?.toISOString() ?? null,
      documentUploadedAt: null,
      createdAt: d.createdAt.toISOString(),
    })),
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

// Get a single doctor
router.get("/manager/doctors/:id", requireManager, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId!, 10);
  const managerId = req.session.userId!;

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid doctor ID" });
    return;
  }

  const [doctor] = await db
    .select()
    .from(doctorsTable)
    .where(and(eq(doctorsTable.id, id), eq(doctorsTable.managerId, managerId)));

  if (!doctor) {
    res.status(404).json({ error: "Doctor not found" });
    return;
  }

  res.json({
    ...doctor,
    managerName: null,
    photoUploadedAt: doctor.photoUploadedAt?.toISOString() ?? null,
    documentUploadedAt: null,
    createdAt: doctor.createdAt.toISOString(),
  });
});

// Create a doctor
router.post("/manager/doctors", requireManager, async (req, res): Promise<void> => {
  const managerId = req.session.userId!;
  const { doctorName, specialization, city, clinicAddress, phoneNumber } = req.body;

  if (!doctorName || !specialization || !city) {
    res.status(400).json({ error: "Doctor name, specialization, and city are required" });
    return;
  }

  const [existing] = await db
    .select()
    .from(doctorsTable)
    .where(
      and(
        like(doctorsTable.doctorName, doctorName),
        like(doctorsTable.specialization, specialization),
        like(doctorsTable.city, city)
      )
    );

  if (existing) {
    res.status(409).json({ error: "A doctor with this name, specialization, and city already exists" });
    return;
  }

  const [result] = await db
    .insert(doctorsTable)
    .values({
      managerId,
      doctorName,
      specialization,
      city,
      clinicAddress: clinicAddress || null,
      phoneNumber: phoneNumber || null,
      isComplete: false,
    });

  const doctorId = result.insertId;
  const createdAt = new Date();

  res.status(201).json({
    id: doctorId,
    managerId,
    doctorName,
    specialization,
    city,
    clinicAddress: clinicAddress || null,
    phoneNumber: phoneNumber || null,
    isComplete: false,
    managerName: null,
    photoUploadedAt: null,
    documentUploadedAt: null,
    createdAt: createdAt.toISOString(),
  });
});

// Upload doctor photo — isComplete = true once photo is uploaded
router.post("/manager/doctors/:id/photo", requireManager, photoUpload.single("photo"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId!, 10);
  const managerId = req.session.userId!;

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid doctor ID" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No photo file uploaded" });
    return;
  }

  const photoUrl = `/api/uploads/photos/${req.file.filename}`;

  const [doctor] = await db
    .select()
    .from(doctorsTable)
    .where(and(eq(doctorsTable.id, id), eq(doctorsTable.managerId, managerId)));

  if (!doctor) {
    // Clean up the uploaded file
    fs.unlink(req.file.path, () => {});
    res.status(404).json({ error: "Doctor not found" });
    return;
  }

  // Remove old photo file if it exists
  if (doctor.photoUrl) {
    const oldFilename = doctor.photoUrl.split("/").pop();
    if (oldFilename) {
      fs.unlink(path.join(photosDir, oldFilename), () => {});
    }
  }

  await db
    .update(doctorsTable)
    .set({
      photoUrl,
      photoUploadedAt: new Date(),
      isComplete: true, // photo upload = complete
    })
    .where(eq(doctorsTable.id, id));

  const [updated] = await db
    .select()
    .from(doctorsTable)
    .where(eq(doctorsTable.id, id));

  res.json({
    ...updated!,
    managerName: null,
    photoUploadedAt: updated!.photoUploadedAt?.toISOString() ?? null,
    documentUploadedAt: null,
    createdAt: updated!.createdAt.toISOString(),
  });
});

// Export manager's doctors
router.get("/manager/export", requireManager, async (req, res): Promise<void> => {
  const managerId = req.session.userId!;

  const doctors = await db
    .select()
    .from(doctorsTable)
    .where(eq(doctorsTable.managerId, managerId))
    .orderBy(desc(doctorsTable.createdAt));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("My Doctors");

  sheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Doctor Name", key: "doctorName", width: 25 },
    { header: "Specialization", key: "specialization", width: 20 },
    { header: "City", key: "city", width: 15 },
    { header: "Clinic Address", key: "clinicAddress", width: 30 },
    { header: "Phone Number", key: "phoneNumber", width: 15 },
    { header: "Photo Uploaded", key: "photoUrl", width: 15 },
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
      isComplete: doc.isComplete ? "Complete" : "Incomplete",
      createdAt: doc.createdAt.toLocaleDateString(),
    });
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=my-doctors-export.xlsx");

  await workbook.xlsx.write(res);
  res.end();
});

export default router;
