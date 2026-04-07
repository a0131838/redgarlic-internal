import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const employee = await getCurrentEmployee();
  if (!employee) {
    redirect("/admin/login");
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 32, display: "grid", gap: 20 }}>
      <section
        style={{
          borderRadius: 20,
          padding: 24,
          background: "#fff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 18px 48px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div style={{ fontSize: 13, color: "#9a3412", fontWeight: 700, letterSpacing: 1 }}>
          MACROCOSM AI
        </div>
        <h1 style={{ marginBottom: 10 }}>欢迎，{employee.name}</h1>
        <p style={{ marginTop: 0, color: "#4b5563", lineHeight: 1.7 }}>
          你已经进入宏算智能内部系统。当前第一期聚焦文件共享工作台和账号基础设施。
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/admin/shared-files"
            style={{
              background: "#7f1d1d",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 999,
              textDecoration: "none",
            }}
          >
            进入共享文件库
          </Link>
          <Link
            href="/admin/team"
            style={{
              background: "#0f766e",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 999,
              textDecoration: "none",
            }}
          >
            管理员工账号
          </Link>
          <form action="/admin/logout" method="post">
            <button
              type="submit"
              style={{
                background: "#fff",
                color: "#7f1d1d",
                padding: "10px 16px",
                borderRadius: 999,
                textDecoration: "none",
                border: "1px solid #fecaca",
                cursor: "pointer",
              }}
            >
              退出登录
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
