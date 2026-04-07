import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EmployeeRole } from "@prisma/client";

const SESSION_DAYS = 30;

function sessionCookieName() {
  return process.env.SESSION_COOKIE_NAME?.trim() || "redgarlic_session";
}

function hashPassword(password: string, salt: string) {
  return crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
}

export function createPasswordHash(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    salt,
    hash: hashPassword(password, salt),
  };
}

export function verifyPassword(password: string, salt: string, hash: string) {
  const calculated = hashPassword(password, salt);
  const calculatedBuffer = Buffer.from(calculated, "utf8");
  const hashBuffer = Buffer.from(hash, "utf8");
  if (calculatedBuffer.length !== hashBuffer.length) return false;
  return crypto.timingSafeEqual(calculatedBuffer, hashBuffer);
}

export async function createSession(employeeId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.authSession.create({
    data: {
      token,
      employeeId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (token) {
    await prisma.authSession.deleteMany({ where: { token } });
  }
  cookieStore.delete(sessionCookieName());
}

export async function createFirstOwner(input: {
  name: string;
  email: string;
  password: string;
}) {
  const { hash, salt } = createPasswordHash(input.password);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(2026040701)`;

    const exists = await tx.employee.count();
    if (exists > 0) {
      return null;
    }

    return tx.employee.create({
      data: {
        name: input.name,
        email: input.email,
        role: EmployeeRole.OWNER,
        passwordHash: hash,
        passwordSalt: salt,
      },
    });
  });
}

export async function getCurrentEmployee() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (!token) return null;

  const session = await prisma.authSession.findUnique({
    where: { token },
    include: { employee: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.authSession.delete({ where: { token } });
    return null;
  }
  if (!session.employee.isActive) return null;

  return session.employee;
}

export async function requireEmployee() {
  const employee = await getCurrentEmployee();
  if (!employee) {
    redirect("/admin/login");
  }
  return employee;
}

export async function requireAdminEmployee() {
  const employee = await requireEmployee();
  if (employee.role !== EmployeeRole.OWNER && employee.role !== EmployeeRole.ADMIN) {
    redirect("/admin/shared-files?err=permission-denied");
  }
  return employee;
}

export async function requireOwnerEmployee() {
  const employee = await requireEmployee();
  if (employee.role !== EmployeeRole.OWNER) {
    redirect("/admin?err=owner-only");
  }
  return employee;
}

export async function authenticateEmployee(email: string, password: string) {
  const employee = await prisma.employee.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (!employee || !employee.passwordHash || !employee.passwordSalt || !employee.isActive) {
    return null;
  }

  if (!verifyPassword(password, employee.passwordSalt, employee.passwordHash)) {
    return null;
  }

  return employee;
}
