import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: "admin" | "manager";
    name: string;
    employeeCode: string;
  }
}
