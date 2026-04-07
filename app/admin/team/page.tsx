import Link from "next/link";
import { EmployeeRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  createPasswordHash,
  requireAdminEmployee,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

function text(value: FormDataEntryValue | null | undefined) {
  return String(value ?? "").trim();
}

function canActorCreateRole(actorRole: EmployeeRole, targetRole: EmployeeRole) {
  if (actorRole === EmployeeRole.OWNER) return true;
  return targetRole === EmployeeRole.STAFF;
}

function canActorManageTarget(
  actor: { id: string; role: EmployeeRole },
  target: { id: string; role: EmployeeRole }
) {
  if (actor.role === EmployeeRole.OWNER) {
    return actor.id !== target.id;
  }
  return actor.role === EmployeeRole.ADMIN && target.role === EmployeeRole.STAFF;
}

async function createEmployeeAction(formData: FormData) {
  "use server";

  const actor = await requireAdminEmployee();
  const name = text(formData.get("name")).slice(0, 50);
  const email = text(formData.get("email")).toLowerCase().slice(0, 120);
  const password = text(formData.get("password"));
  const roleRaw = text(formData.get("role")).toUpperCase();
  const role = Object.values(EmployeeRole).includes(roleRaw as EmployeeRole)
    ? (roleRaw as EmployeeRole)
    : EmployeeRole.STAFF;

  if (!name || !email || password.length < 8) {
    redirect("/admin/team?err=请填写完整信息，并使用至少8位密码");
  }
  if (!canActorCreateRole(actor.role, role)) {
    redirect("/admin/team?err=当前账号只能创建普通员工");
  }

  const { hash, salt } = createPasswordHash(password);

  try {
    await prisma.employee.create({
      data: {
        name,
        email,
        role,
        passwordHash: hash,
        passwordSalt: salt,
      },
    });
  } catch {
    redirect("/admin/team?err=邮箱已存在");
  }

  revalidatePath("/admin/team");
  redirect("/admin/team?msg=employee-created");
}

async function toggleEmployeeStatusAction(formData: FormData) {
  "use server";

  const actor = await requireAdminEmployee();
  const employeeId = text(formData.get("employeeId"));
  const nextActive = text(formData.get("nextActive")) === "true";

  const target = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, role: true, isActive: true },
  });
  if (!target) {
    redirect("/admin/team?err=员工不存在");
  }
  if (!canActorManageTarget(actor, target)) {
    redirect("/admin/team?err=没有权限管理该员工");
  }

  await prisma.employee.update({
    where: { id: employeeId },
    data: { isActive: nextActive },
  });

  if (!nextActive) {
    await prisma.authSession.deleteMany({ where: { employeeId } });
  }

  revalidatePath("/admin/team");
  redirect(`/admin/team?msg=${nextActive ? "employee-activated" : "employee-disabled"}`);
}

async function resetPasswordAction(formData: FormData) {
  "use server";

  const actor = await requireAdminEmployee();
  const employeeId = text(formData.get("employeeId"));
  const password = text(formData.get("password"));
  if (password.length < 8) {
    redirect("/admin/team?err=重置密码至少需要8位");
  }

  const target = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, role: true },
  });
  if (!target) {
    redirect("/admin/team?err=员工不存在");
  }
  if (!canActorManageTarget(actor, target)) {
    redirect("/admin/team?err=没有权限重置该员工密码");
  }

  const { hash, salt } = createPasswordHash(password);
  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      passwordHash: hash,
      passwordSalt: salt,
    },
  });
  await prisma.authSession.deleteMany({ where: { employeeId } });

  revalidatePath("/admin/team");
  redirect("/admin/team?msg=password-reset");
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams?: Promise<{ msg?: string; err?: string }>;
}) {
  const actor = await requireAdminEmployee();
  const sp = await searchParams;

  const employees = await prisma.employee.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    include: {
      sessions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: 28, display: "grid", gap: 18 }}>
      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-start",
          borderRadius: 22,
          padding: 24,
          color: "#ecfeff",
          background: "linear-gradient(135deg, #0f766e, #155e75)",
        }}
      >
        <div>
          <div style={{ fontSize: 13, letterSpacing: 1, opacity: 0.9 }}>TEAM ACCESS</div>
          <h1 style={{ margin: "8px 0 10px" }}>员工账号管理</h1>
          <p style={{ margin: 0, maxWidth: 720, lineHeight: 1.7 }}>
            在这里创建员工账号、控制启停用、重置密码。当前 Owner 拥有完整权限，Admin 仅能管理普通员工。
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>{actor.name}</div>
          <div style={{ opacity: 0.85 }}>{actor.email}</div>
          <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Link href="/admin" style={{ color: "#fff", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.45)" }}>
              控制台
            </Link>
            <Link href="/admin/shared-files" style={{ color: "#fff", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.45)" }}>
              文件库
            </Link>
          </div>
        </div>
      </section>

      {sp?.msg ? (
        <div style={{ padding: 12, borderRadius: 16, background: "#ecfdf5", color: "#166534", border: "1px solid #bbf7d0" }}>
          {sp.msg}
        </div>
      ) : null}
      {sp?.err ? (
        <div style={{ padding: 12, borderRadius: 16, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
          {sp.err}
        </div>
      ) : null}

      <section
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(320px, 0.7fr)",
        }}
      >
        <section
          style={{
            borderRadius: 20,
            border: "1px solid #e5e7eb",
            background: "#fff",
            padding: 20,
            overflowX: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "12px 8px" }}>员工</th>
                <th style={{ padding: "12px 8px" }}>角色</th>
                <th style={{ padding: "12px 8px" }}>状态</th>
                <th style={{ padding: "12px 8px" }}>最近登录</th>
                <th style={{ padding: "12px 8px" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const canManage = canActorManageTarget(actor, employee);
                return (
                  <tr key={employee.id} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                    <td style={{ padding: "14px 8px" }}>
                      <div style={{ fontWeight: 700 }}>{employee.name}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>{employee.email}</div>
                      <div style={{ color: "#9ca3af", fontSize: 12 }}>创建于 {formatTime(employee.createdAt)}</div>
                    </td>
                    <td style={{ padding: "14px 8px" }}>{employee.role}</td>
                    <td style={{ padding: "14px 8px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: employee.isActive ? "#ecfdf5" : "#f3f4f6",
                          color: employee.isActive ? "#166534" : "#6b7280",
                          border: employee.isActive ? "1px solid #bbf7d0" : "1px solid #d1d5db",
                        }}
                      >
                        {employee.isActive ? "启用中" : "已停用"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 8px", color: "#4b5563" }}>
                      {employee.sessions[0] ? formatTime(employee.sessions[0].createdAt) : "暂无"}
                    </td>
                    <td style={{ padding: "14px 8px" }}>
                      {canManage ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <form action={toggleEmployeeStatusAction}>
                            <input type="hidden" name="employeeId" value={employee.id} />
                            <input type="hidden" name="nextActive" value={String(!employee.isActive)} />
                            <button
                              type="submit"
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                borderRadius: 12,
                                border: "1px solid #d1d5db",
                                background: "#fff",
                              }}
                            >
                              {employee.isActive ? "停用账号" : "重新启用"}
                            </button>
                          </form>
                          <form action={resetPasswordAction} style={{ display: "grid", gap: 8 }}>
                            <input type="hidden" name="employeeId" value={employee.id} />
                            <input
                              name="password"
                              type="password"
                              minLength={8}
                              required
                              placeholder="新密码（至少8位）"
                              style={{ padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                            />
                            <button
                              type="submit"
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                borderRadius: 12,
                                border: "1px solid #bfdbfe",
                                color: "#1d4ed8",
                                background: "#eff6ff",
                              }}
                            >
                              重置密码
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: 13 }}>当前账号不可管理该员工</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section
          style={{
            borderRadius: 20,
            border: "1px solid #e5e7eb",
            background: "#fff",
            padding: 20,
            display: "grid",
            gap: 14,
            alignContent: "start",
          }}
        >
          <h2 style={{ margin: 0 }}>新增员工账号</h2>
          <form action={createEmployeeAction} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>姓名</span>
              <input name="name" required style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>邮箱</span>
              <input name="email" type="email" required style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>初始密码</span>
              <input name="password" type="password" minLength={8} required style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>角色</span>
              <select name="role" defaultValue={EmployeeRole.STAFF} style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}>
                <option value={EmployeeRole.STAFF}>STAFF</option>
                {actor.role === EmployeeRole.OWNER ? <option value={EmployeeRole.ADMIN}>ADMIN</option> : null}
                {actor.role === EmployeeRole.OWNER ? <option value={EmployeeRole.OWNER}>OWNER</option> : null}
              </select>
            </label>
            <button
              type="submit"
              style={{
                padding: "12px 16px",
                borderRadius: 999,
                border: 0,
                background: "#0f766e",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              创建账号
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
