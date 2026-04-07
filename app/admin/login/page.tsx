import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { authenticateEmployee, createSession, getCurrentEmployee } from "@/lib/auth";

export const dynamic = "force-dynamic";

function text(value: FormDataEntryValue | null | undefined) {
  return String(value ?? "").trim();
}

async function loginAction(formData: FormData) {
  "use server";

  const email = text(formData.get("email")).toLowerCase();
  const password = text(formData.get("password"));
  const employee = await authenticateEmployee(email, password);

  if (!employee) {
    redirect("/admin/login?err=邮箱或密码错误");
  }

  await createSession(employee.id);
  redirect("/admin/shared-files?msg=login-success");
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ err?: string }>;
}) {
  const employeeCount = await prisma.employee.count();
  if (employeeCount === 0) {
    redirect("/admin/setup");
  }

  const currentEmployee = await getCurrentEmployee();
  if (currentEmployee) {
    redirect("/admin/shared-files");
  }

  const sp = await searchParams;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 460,
          borderRadius: 24,
          padding: 28,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.08)",
        }}
      >
        <img
          src="/macrocosm-logo.png"
          alt="宏算智能"
          style={{
            display: "block",
            width: "100%",
            maxWidth: 340,
            height: "auto",
            marginBottom: 18,
          }}
        />
        <h1 style={{ marginBottom: 12 }}>管理员登录入口</h1>
        <p style={{ marginTop: 0, color: "#4b5563", lineHeight: 1.7 }}>
          先用内部账号登录，再进入共享文件库。当前首期版本聚焦文件传输、共享和操作留痕。
        </p>
        {sp?.err ? (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 14,
              color: "#991b1b",
              background: "#fef2f2",
              border: "1px solid #fecaca",
            }}
          >
            {sp.err}
          </div>
        ) : null}
        <form action={loginAction} style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>邮箱</span>
            <input
              name="email"
              type="email"
              required
              style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>密码</span>
            <input
              name="password"
              type="password"
              required
              style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}
            />
          </label>
          <button
            type="submit"
            style={{
              marginTop: 6,
              padding: "12px 16px",
              borderRadius: 999,
              border: 0,
              background: "#7f1d1d",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            登录
          </button>
        </form>
        <div style={{ marginTop: 16, color: "#6b7280", fontSize: 14 }}>
          如果这是第一次进入，请先前往 <Link href="/admin/setup">初始化管理员</Link>。
        </div>
      </section>
    </main>
  );
}
