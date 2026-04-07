import Link from "next/link";
import { EmployeeRole, SharedFileStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultFileCategories } from "@/lib/bootstrap";
import { requireEmployee } from "@/lib/auth";

export const dynamic = "force-dynamic";

function text(value: FormDataEntryValue | null | undefined) {
  return String(value ?? "").trim();
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
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

export default async function SharedFilesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    categoryId?: string;
    status?: string;
    msg?: string;
    err?: string;
  }>;
}) {
  const employee = await requireEmployee();
  await ensureDefaultFileCategories();

  const isManager =
    employee.role === EmployeeRole.OWNER || employee.role === EmployeeRole.ADMIN;
  const sp = await searchParams;
  const q = text(sp?.q);
  const categoryId = text(sp?.categoryId);
  const status = text(sp?.status).toUpperCase();

  const where: {
    categoryId?: string;
    status?: SharedFileStatus;
    OR?: Array<{
      title?: { contains: string; mode: "insensitive" };
      originalFileName?: { contains: string; mode: "insensitive" };
      remarks?: { contains: string; mode: "insensitive" };
    }>;
  } = {};

  if (categoryId) where.categoryId = categoryId;
  if (Object.values(SharedFileStatus).includes(status as SharedFileStatus)) {
    where.status = status as SharedFileStatus;
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { originalFileName: { contains: q, mode: "insensitive" } },
      { remarks: { contains: q, mode: "insensitive" } },
    ];
  }

  const [categories, files] = await Promise.all([
    prisma.fileCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.sharedFile.findMany({
      where,
      include: {
        category: true,
        uploader: true,
        audits: {
          include: { actor: true },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <main style={{ maxWidth: 1440, margin: "0 auto", padding: 28, display: "grid", gap: 18 }}>
      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-start",
          borderRadius: 22,
          padding: 24,
          color: "#fff7ed",
          background: "linear-gradient(135deg, #7f1d1d, #9a3412)",
        }}
      >
        <div>
          <div style={{ fontSize: 13, letterSpacing: 1, opacity: 0.9 }}>FILE LIBRARY</div>
          <h1 style={{ margin: "8px 0 10px" }}>共享文件库</h1>
          <p style={{ margin: 0, maxWidth: 720, lineHeight: 1.7 }}>
            第一阶段先把共享资料、合同、财务文件和内部资料统一留在一个可登录、可检索、可审计的入口里。
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>{employee.name}</div>
          <div style={{ opacity: 0.85 }}>{employee.email}</div>
          <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Link
              href="/admin"
              style={{ color: "#fff", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.45)" }}
            >
              控制台
            </Link>
            {isManager ? (
              <Link
                href="/admin/team"
                style={{ color: "#fff", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.45)" }}
              >
                员工账号
              </Link>
            ) : null}
            <a
              href="/admin/logout"
              style={{ color: "#fff", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.45)" }}
            >
              退出登录
            </a>
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
          gridTemplateColumns: isManager ? "minmax(0, 1fr) 360px" : "1fr",
          alignItems: "start",
        }}
      >
        <div
          style={{
            borderRadius: 20,
            border: "1px solid #e5e7eb",
            background: "#fff",
            padding: 20,
            display: "grid",
            gap: 16,
          }}
        >
          <form style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr auto" }}>
              <input
                name="q"
                defaultValue={q}
                placeholder="搜索标题、原文件名、备注"
                style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}
              />
              <select
                name="categoryId"
                defaultValue={categoryId}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}
              >
                <option value="">全部分类</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                name="status"
                defaultValue={status}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}
              >
                <option value="">全部状态</option>
                {Object.values(SharedFileStatus).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                style={{ borderRadius: 999, border: 0, background: "#111827", color: "#fff", padding: "10px 18px" }}
              >
                筛选
              </button>
            </div>
          </form>

          <div style={{ overflowX: "auto", paddingBottom: 4 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "12px 8px" }}>文件</th>
                  <th style={{ padding: "12px 8px" }}>分类</th>
                  <th style={{ padding: "12px 8px" }}>状态</th>
                  <th style={{ padding: "12px 8px" }}>上传人</th>
                  <th style={{ padding: "12px 8px" }}>大小</th>
                  <th style={{ padding: "12px 8px" }}>最近动作</th>
                  {isManager ? <th style={{ padding: "12px 8px" }}>操作</th> : null}
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                    <td style={{ padding: "14px 8px" }}>
                      <div style={{ fontWeight: 700 }}>{file.title}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>{file.originalFileName}</div>
                      {file.remarks ? <div style={{ marginTop: 6, color: "#4b5563", fontSize: 13 }}>{file.remarks}</div> : null}
                      <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <a href={`/api/admin/shared-files/${file.id}`} target="_blank" rel="noreferrer">
                          预览
                        </a>
                        <a href={`/api/admin/shared-files/${file.id}?download=1`}>
                          下载
                        </a>
                      </div>
                    </td>
                    <td style={{ padding: "14px 8px" }}>{file.category.name}</td>
                    <td style={{ padding: "14px 8px" }}>{file.status}</td>
                    <td style={{ padding: "14px 8px" }}>
                      <div>{file.uploader.name}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>{file.uploader.email}</div>
                    </td>
                    <td style={{ padding: "14px 8px" }}>
                      <div>{formatBytes(file.fileSizeBytes)}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>{formatTime(file.createdAt)}</div>
                    </td>
                    <td style={{ padding: "14px 8px", fontSize: 13, color: "#4b5563" }}>
                      {file.audits.length === 0
                        ? "无"
                        : file.audits.map((audit) => (
                            <div key={audit.id} style={{ marginBottom: 6 }}>
                              {audit.action} · {audit.actor.name} · {formatTime(audit.createdAt)}
                            </div>
                          ))}
                    </td>
                    {isManager ? (
                      <td style={{ padding: "14px 8px" }}>
                        <div style={{ display: "grid", gap: 8 }}>
                          {file.status !== SharedFileStatus.ARCHIVED ? (
                            <form action="/admin/shared-files/status" method="post">
                              <input type="hidden" name="fileId" value={file.id} />
                              <input type="hidden" name="nextStatus" value={SharedFileStatus.ARCHIVED} />
                              <button type="submit" style={{ width: "100%", padding: "8px 10px", borderRadius: 12, border: "1px solid #d1d5db", background: "#fff" }}>
                                归档
                              </button>
                            </form>
                          ) : (
                            <form action="/admin/shared-files/status" method="post">
                              <input type="hidden" name="fileId" value={file.id} />
                              <input type="hidden" name="nextStatus" value={SharedFileStatus.ACTIVE} />
                              <button type="submit" style={{ width: "100%", padding: "8px 10px", borderRadius: 12, border: "1px solid #d1d5db", background: "#fff" }}>
                                恢复
                              </button>
                            </form>
                          )}
                          {file.status !== SharedFileStatus.DELETED ? (
                            <form action="/admin/shared-files/status" method="post">
                              <input type="hidden" name="fileId" value={file.id} />
                              <input type="hidden" name="nextStatus" value={SharedFileStatus.DELETED} />
                              <button type="submit" style={{ width: "100%", padding: "8px 10px", borderRadius: 12, border: "1px solid #fecaca", color: "#991b1b", background: "#fff5f5" }}>
                                标记删除
                              </button>
                            </form>
                          ) : (
                            <form action="/admin/shared-files/delete" method="post">
                              <input type="hidden" name="fileId" value={file.id} />
                              <button
                                type="submit"
                                style={{ width: "100%", padding: "8px 10px", borderRadius: 12, border: "1px solid #b91c1c", color: "#fff", background: "#b91c1c" }}
                              >
                                彻底删除
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {files.length === 0 ? (
                  <tr>
                    <td colSpan={isManager ? 7 : 6} style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>
                      暂时没有文件。{isManager ? "可以从右侧先上传第一份共享资料。" : ""}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {isManager ? (
          <div style={{ display: "grid", gap: 16, alignContent: "start", alignSelf: "start", position: "sticky", top: 20 }}>
            <section
              style={{
                borderRadius: 20,
                border: "1px solid #e5e7eb",
                background: "#fff",
                padding: 20,
                display: "grid",
                gap: 14,
                alignSelf: "start",
              }}
            >
              <h2 style={{ margin: 0 }}>上传共享文件</h2>
              <form action="/admin/shared-files/upload" method="post" encType="multipart/form-data" style={{ display: "grid", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>文件标题</span>
                  <input name="title" placeholder="不填则使用原文件名" style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>分类</span>
                  <select name="categoryId" required style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}>
                    <option value="">请选择</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>备注</span>
                  <textarea name="remarks" rows={4} style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db", resize: "vertical" }} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>文件</span>
                  <input name="file" type="file" required style={{ padding: 8, borderRadius: 12, border: "1px solid #d1d5db" }} />
                </label>
                <button type="submit" style={{ borderRadius: 999, border: 0, background: "#7f1d1d", color: "#fff", padding: "12px 16px", fontWeight: 700 }}>
                  上传
                </button>
              </form>
            </section>

            <section
              style={{
                borderRadius: 20,
                border: "1px solid #e5e7eb",
                background: "#fff",
                padding: 20,
                display: "grid",
                gap: 14,
                alignSelf: "start",
              }}
            >
              <h2 style={{ margin: 0 }}>新增分类</h2>
              <form action="/admin/shared-files/category" method="post" style={{ display: "grid", gap: 12 }}>
                <input name="name" placeholder="例如 Legal / Sales / Delivery" required style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }} />
                <button type="submit" style={{ borderRadius: 999, border: 0, background: "#111827", color: "#fff", padding: "12px 16px", fontWeight: 700 }}>
                  创建分类
                </button>
              </form>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
