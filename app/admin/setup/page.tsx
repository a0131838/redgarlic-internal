import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createFirstOwner, createSession } from "@/lib/auth";
import { ensureDefaultFileCategories } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

function text(value: FormDataEntryValue | null | undefined) {
  return String(value ?? "").trim();
}

async function createOwnerAction(formData: FormData) {
  "use server";

  const exists = await prisma.employee.count();
  if (exists > 0) {
    redirect("/admin/login");
  }

  const name = text(formData.get("name")).slice(0, 50);
  const email = text(formData.get("email")).toLowerCase().slice(0, 120);
  const password = text(formData.get("password"));

  if (!name || !email || password.length < 8) {
    redirect("/admin/setup?err=请填写姓名、邮箱，并使用至少8位密码");
  }

  let employee;
  try {
    employee = await createFirstOwner({
      name,
      email,
      password,
    });
  } catch {
    redirect("/admin/setup?err=邮箱已存在");
  }
  if (!employee) {
    redirect("/admin/login");
  }

  await ensureDefaultFileCategories();
  await createSession(employee.id);
  redirect("/admin/shared-files?msg=setup-complete");
}

export default async function AdminSetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ err?: string }>;
}) {
  const exists = await prisma.employee.count();
  if (exists > 0) {
    redirect("/admin/login");
  }

  const sp = await searchParams;

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section
        style={{
          width: "100%",
          maxWidth: 520,
          padding: 28,
          borderRadius: 24,
          border: "1px solid #e5e7eb",
          background: "#fff",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>创建第一个管理员</h1>
        <p style={{ color: "#4b5563", lineHeight: 1.7 }}>
          首次进入时，请先建立一个 OWNER 账号。后续其他员工账号可以从系统内继续扩展。
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
        <form action={createOwnerAction} style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>姓名</span>
            <input name="name" required style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>邮箱</span>
            <input name="email" type="email" required style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>密码</span>
            <input name="password" type="password" required minLength={8} style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }} />
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
            创建管理员并进入系统
          </button>
        </form>
      </section>
    </main>
  );
}
