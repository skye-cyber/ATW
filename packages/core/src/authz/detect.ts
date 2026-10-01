import type { Role } from "../types";

export interface AuthzMatrixRow {
  method: string;
  path: string;
  roles: Partial<Record<Role, number | "ERR">>;
}

export interface AuthzFlag {
  text: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
}

export function detectAuthzIssue(row: AuthzMatrixRow): AuthzFlag | null {
  const { roles, method, path } = row;
  const isOk = (v: number | "ERR" | undefined): boolean =>
    typeof v === "number" && v >= 200 && v < 300;
  const isAdminPath = /admin|internal/i.test(path);
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());

  if (isOk(roles.guest) && isAdminPath) return { text: "Guest on admin route", severity: "high" };
  if (isOk(roles.guest) && isWrite) return { text: "Guest can write (BFLA?)", severity: "medium" };
  if (isOk(roles.user) && isAdminPath && isOk(roles.admin)) return { text: "User on admin route", severity: "high" };
  if (typeof roles.admin === "number" && roles.admin >= 500) return { text: "Server error on admin role", severity: "medium" };
  return null;
}
