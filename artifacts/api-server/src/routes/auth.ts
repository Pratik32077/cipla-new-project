import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { employeeCode, password } = req.body;

  if (!employeeCode || !password) {
    res.status(400).json({ error: "Employee code and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.employeeCode, employeeCode));

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.name = user.name;
  req.session.employeeCode = user.employeeCode;

  res.json({
    id: user.id,
    name: user.name,
    employeeCode: user.employeeCode,
    role: user.role,
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  res.json({
    id: req.session.userId,
    name: req.session.name,
    employeeCode: req.session.employeeCode,
    role: req.session.role,
  });
});

export default router;
