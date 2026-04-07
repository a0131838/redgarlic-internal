import Link from "next/link";
import { EmployeeRole, SharedFileStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultFileCategories } from "@/lib/bootstrap";
import { requireEmployee } from "@/lib/auth";
import { getFolderLineage } from "./_lib";

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

type FolderListItem = {
  id: string;
  name: string;
  categoryId: string;
  parentId: string | null;
  _count: {
    children: number;
    files: number;
  };
};

function buildFolderOptions(
  folders: FolderListItem[],
  parentId: string | null = null,
  depth = 0,
  acc: Array<{ value: string; label: string }> = [],
  excludedIds?: Set<string>,
) {
  const siblings = folders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  for (const folder of siblings) {
    if (excludedIds?.has(folder.id)) {
      buildFolderOptions(folders, folder.id, depth + 1, acc, excludedIds);
      continue;
    }
    acc.push({
      value: folder.id,
      label: `${"　".repeat(depth)}${depth > 0 ? "└ " : ""}${folder.name}`,
    });
    buildFolderOptions(folders, folder.id, depth + 1, acc, excludedIds);
  }

  return acc;
}

function collectDescendantIds(folders: FolderListItem[], folderId: string) {
  const ids = new Set<string>([folderId]);
  const stack = [folderId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const folder of folders) {
      if (folder.parentId === current && !ids.has(folder.id)) {
        ids.add(folder.id);
        stack.push(folder.id);
      }
    }
  }

  return ids;
}

function buildHref(params: {
  categoryId?: string;
  folderId?: string;
  q?: string;
  status?: string;
  msg?: string;
  err?: string;
}) {
  const search = new URLSearchParams();
  if (params.categoryId) search.set("categoryId", params.categoryId);
  if (params.folderId) search.set("folderId", params.folderId);
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.msg) search.set("msg", params.msg);
  if (params.err) search.set("err", params.err);
  const qs = search.toString();
  return qs ? `/admin/shared-files?${qs}` : "/admin/shared-files";
}

export default async function SharedFilesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    categoryId?: string;
    folderId?: string;
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
  const requestedCategoryId = text(sp?.categoryId);
  const requestedFolderId = text(sp?.folderId);
  const status = text(sp?.status).toUpperCase();

  const categories = await prisma.fileCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const activeCategoryId =
    requestedCategoryId || categories[0]?.id || "";
  const activeCategory =
    categories.find((category) => category.id === activeCategoryId) || categories[0] || null;

  const folderLineage =
    requestedFolderId && activeCategory
      ? await getFolderLineage(requestedFolderId)
      : null;
  const validFolderLineage =
    folderLineage?.length && folderLineage.every((folder) => folder.categoryId === activeCategory?.id)
      ? folderLineage
      : [];
  const currentFolder = validFolderLineage[validFolderLineage.length - 1] || null;

  const fileWhere: {
    categoryId?: string;
    folderId?: string | null;
    status?: SharedFileStatus;
    OR?: Array<{
      title?: { contains: string; mode: "insensitive" };
      originalFileName?: { contains: string; mode: "insensitive" };
      remarks?: { contains: string; mode: "insensitive" };
    }>;
  } = {};

  if (activeCategory?.id) fileWhere.categoryId = activeCategory.id;
  fileWhere.folderId = currentFolder?.id || null;
  if (Object.values(SharedFileStatus).includes(status as SharedFileStatus)) {
    fileWhere.status = status as SharedFileStatus;
  }
  if (q) {
    fileWhere.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { originalFileName: { contains: q, mode: "insensitive" } },
      { remarks: { contains: q, mode: "insensitive" } },
    ];
  }

  const [allFolders, files] = activeCategory
    ? await Promise.all([
        prisma.sharedFolder.findMany({
          where: {
            categoryId: activeCategory.id,
          },
          include: {
            _count: {
              select: {
                children: true,
                files: true,
              },
            },
          },
          orderBy: [{ name: "asc" }],
        }),
        prisma.sharedFile.findMany({
          where: fileWhere,
          include: {
            category: true,
            uploader: true,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 200,
        }),
      ])
    : [[], []];

  const folderMap = new Map(allFolders.map((folder) => [folder.id, folder]));
  const currentFolderRecord = currentFolder ? folderMap.get(currentFolder.id) || null : null;
  const folders = allFolders.filter((folder) => folder.parentId === (currentFolderRecord?.id || null));
  const folderOptions = buildFolderOptions(allFolders);
  const moveTargetOptions = [{ value: "", label: "根目录" }, ...folderOptions];
  const currentFolderMoveOptions = currentFolderRecord
    ? [{ value: "", label: "根目录" }, ...buildFolderOptions(allFolders, null, 0, [], collectDescendantIds(allFolders, currentFolderRecord.id))]
    : [];

  const rootHref = buildHref({
    categoryId: activeCategory?.id,
    q,
    status,
  });

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
          <div style={{ fontSize: 13, letterSpacing: 1, opacity: 0.9 }}>FILE EXPLORER</div>
          <h1 style={{ margin: "8px 0 10px" }}>共享文件库</h1>
          <p style={{ margin: 0, maxWidth: 760, lineHeight: 1.7 }}>
            现在按电脑文件管理器的习惯来用：先进入分类，再进入文件夹，文件和目录都围绕当前目录操作。
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
            <form action="/admin/logout" method="post">
              <button
                type="submit"
                style={{
                  color: "#fff",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.45)",
                  background: "transparent",
                  borderTop: 0,
                  borderLeft: 0,
                  borderRight: 0,
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                退出登录
              </button>
            </form>
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
          id="file-list"
          style={{
            borderRadius: 20,
            border: "1px solid #e5e7eb",
            background: "#fff",
            padding: 20,
            display: "grid",
            gap: 18,
          }}
        >
          <form method="get" style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr auto" }}>
              <input
                name="q"
                defaultValue={q}
                placeholder="搜索当前目录里的文件"
                style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}
              />
              <select
                name="categoryId"
                defaultValue={activeCategory?.id}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}
              >
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
            {currentFolder ? <input type="hidden" name="folderId" value={currentFolder.id} /> : null}
          </form>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              fontSize: 14,
            }}
          >
            <Link href={rootHref} style={{ color: currentFolder ? "#1d4ed8" : "#111827", textDecoration: "none", fontWeight: 700 }}>
              {activeCategory?.name || "共享文件"}
            </Link>
            {validFolderLineage.map((folder) => (
              <div key={folder.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "#94a3b8" }}>/</span>
                <Link
                  href={buildHref({
                    categoryId: activeCategory?.id,
                    folderId: folder.id,
                    status,
                  })}
                  style={{ color: folder.id === currentFolder?.id ? "#111827" : "#1d4ed8", textDecoration: "none", fontWeight: 700 }}
                >
                  {folder.name}
                </Link>
              </div>
            ))}
          </div>

          <section style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>当前目录</h2>
              {currentFolder ? (
                <Link href={rootHref} style={{ color: "#1d4ed8", textDecoration: "none", fontSize: 14 }}>
                  返回根目录
                </Link>
              ) : null}
            </div>

            {folders.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gap: 14,
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                {folders.map((folder) => {
                  const isEmptyFolder = folder._count.children === 0 && folder._count.files === 0;
                  const folderDeleteHint = isEmptyFolder
                    ? "当前文件夹为空，可以直接删除。"
                    : `还包含 ${folder._count.children} 个子文件夹、${folder._count.files} 个文件，暂时不能删除。`;
                  return (
                    <div
                      key={folder.id}
                      id={`folder-${folder.id}`}
                      style={{
                        display: "grid",
                        gap: 12,
                        borderRadius: 18,
                        border: "1px solid #e5e7eb",
                        background: "linear-gradient(180deg, #fff7ed, #ffffff)",
                        padding: 18,
                        color: "#111827",
                        scrollMarginTop: 24,
                      }}
                    >
                      <Link
                        href={buildHref({
                          categoryId: activeCategory?.id,
                          folderId: folder.id,
                          status,
                        })}
                        style={{ display: "grid", gap: 8, textDecoration: "none", color: "#111827" }}
                      >
                        <div style={{ fontSize: 28 }}>📁</div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{folder.name}</div>
                        <div style={{ color: "#6b7280", fontSize: 13 }}>
                          {folder._count.children} 个子文件夹 · {folder._count.files} 个文件
                        </div>
                      </Link>
                      {isManager ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <form action="/admin/shared-files/folder-rename" method="post" style={{ display: "grid", gap: 8 }}>
                            <input type="hidden" name="folderId" value={folder.id} />
                            <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                            <input type="hidden" name="returnFolderId" value={currentFolderRecord?.id || ""} />
                            <input type="hidden" name="focusId" value={`folder-${folder.id}`} />
                            <input
                              name="name"
                              defaultValue={folder.name}
                              required
                              style={{ padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                            />
                            <button
                              type="submit"
                              style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #d1d5db", background: "#fff" }}
                            >
                              重命名
                            </button>
                          </form>
                          <form action="/admin/shared-files/folder-move" method="post" style={{ display: "grid", gap: 8 }}>
                            <input type="hidden" name="folderId" value={folder.id} />
                            <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                            <select
                              name="targetParentId"
                              defaultValue={folder.parentId || ""}
                              style={{ padding: 8, borderRadius: 10, border: "1px solid #d1d5db", background: "#fff" }}
                            >
                              {[{ value: "", label: "根目录" }, ...buildFolderOptions(allFolders, null, 0, [], collectDescendantIds(allFolders, folder.id))].map((option) => (
                                <option key={option.value || "root"} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #bfdbfe", color: "#1d4ed8", background: "#eff6ff" }}
                            >
                              移动文件夹
                            </button>
                          </form>
                          <form action="/admin/shared-files/folder-delete" method="post">
                            <input type="hidden" name="folderId" value={folder.id} />
                            <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                            <input type="hidden" name="returnFolderId" value={currentFolderRecord?.id || ""} />
                            <input type="hidden" name="focusId" value="file-list" />
                            <button
                              type="submit"
                              disabled={!isEmptyFolder}
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                borderRadius: 12,
                                border: "1px solid #fecaca",
                                background: isEmptyFolder ? "#fff5f5" : "#f8fafc",
                                color: isEmptyFolder ? "#991b1b" : "#94a3b8",
                                cursor: isEmptyFolder ? "pointer" : "not-allowed",
                              }}
                            >
                              {isEmptyFolder ? "删除空文件夹" : "含内容，不能删除"}
                            </button>
                            <div style={{ marginTop: 6, color: isEmptyFolder ? "#166534" : "#6b7280", fontSize: 12, lineHeight: 1.5 }}>
                              {folderDeleteHint}
                            </div>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 18, borderRadius: 16, border: "1px dashed #d1d5db", color: "#6b7280" }}>
                当前目录还没有子文件夹。
              </div>
            )}
          </section>

          <section style={{ display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>文件</h2>
            {isManager && files.length > 0 ? (
              <form
                id="bulk-file-move-form"
                action="/admin/shared-files/move-batch"
                method="post"
                style={{
                  display: "grid",
                  gap: 10,
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid #dbeafe",
                  background: "#eff6ff",
                }}
              >
                <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                <div style={{ fontWeight: 700, color: "#1e3a8a" }}>批量整理当前目录文件</div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "180px minmax(0, 1fr) auto", alignItems: "center" }}>
                  <select
                    name="bulkAction"
                    defaultValue="MOVE"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #bfdbfe", background: "#fff" }}
                  >
                    <option value="MOVE">批量移动</option>
                    <option value="ARCHIVE">批量归档</option>
                    <option value="DELETE">批量标记删除</option>
                  </select>
                  <select
                    name="targetFolderId"
                    defaultValue={currentFolderRecord?.id || ""}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #bfdbfe", background: "#fff" }}
                  >
                    {moveTargetOptions.map((option) => (
                      <option key={option.value || "root"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    style={{ padding: "10px 16px", borderRadius: 999, border: 0, background: "#1d4ed8", color: "#fff", fontWeight: 700 }}
                  >
                    执行批量操作
                  </button>
                </div>
                <div style={{ color: "#475569", fontSize: 13 }}>
                  先在下方勾选文件。只有“批量移动”会使用目标目录，归档和标记删除会忽略右侧目录选择。
                </div>
              </form>
            ) : null}
            <div style={{ overflowX: "auto", paddingBottom: 4 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>
                    {isManager ? <th style={{ padding: "12px 8px", width: 52 }}>选择</th> : null}
                    <th style={{ padding: "12px 8px" }}>文件</th>
                    <th style={{ padding: "12px 8px" }}>状态</th>
                    <th style={{ padding: "12px 8px" }}>上传人</th>
                    <th style={{ padding: "12px 8px" }}>大小</th>
                    <th style={{ padding: "12px 8px" }}>时间</th>
                    {isManager ? <th style={{ padding: "12px 8px" }}>操作</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr
                      id={`file-${file.id}`}
                      key={file.id}
                      style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top", scrollMarginTop: 24 }}
                    >
                      {isManager ? (
                        <td style={{ padding: "14px 8px" }}>
                          <input
                            type="checkbox"
                            name="fileIds"
                            value={file.id}
                            form="bulk-file-move-form"
                            disabled={file.status === SharedFileStatus.DELETED}
                            aria-label={`选择文件 ${file.title}`}
                          />
                        </td>
                      ) : null}
                      <td style={{ padding: "14px 8px" }}>
                        <div style={{ fontWeight: 700 }}>{file.title}</div>
                        <div style={{ color: "#6b7280", fontSize: 13 }}>{file.originalFileName}</div>
                        {file.remarks ? <div style={{ marginTop: 6, color: "#4b5563", fontSize: 13 }}>{file.remarks}</div> : null}
                        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <a href={`/api/admin/shared-files/${file.id}`} target="_blank" rel="noreferrer">
                            预览
                          </a>
                          <a href={`/api/admin/shared-files/${file.id}?download=1`}>下载</a>
                        </div>
                      </td>
                      <td style={{ padding: "14px 8px" }}>{file.status}</td>
                      <td style={{ padding: "14px 8px" }}>
                        <div>{file.uploader.name}</div>
                        <div style={{ color: "#6b7280", fontSize: 13 }}>{file.uploader.email}</div>
                      </td>
                      <td style={{ padding: "14px 8px" }}>{formatBytes(file.fileSizeBytes)}</td>
                      <td style={{ padding: "14px 8px", color: "#4b5563", fontSize: 13 }}>{formatTime(file.createdAt)}</td>
                      {isManager ? (
                        <td style={{ padding: "14px 8px" }}>
                          <div style={{ display: "grid", gap: 10, minWidth: 280 }}>
                            <form
                              action="/admin/shared-files/rename"
                              method="post"
                              style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center" }}
                            >
                              <input type="hidden" name="fileId" value={file.id} />
                              <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                              <input type="hidden" name="folderId" value={currentFolder?.id || ""} />
                              <input
                                name="title"
                                defaultValue={file.title}
                                required
                                style={{ width: "100%", padding: "8px 10px", borderRadius: 12, border: "1px solid #d1d5db", background: "#fff" }}
                              />
                              <button
                                type="submit"
                                style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #d1d5db", background: "#fff", whiteSpace: "nowrap" }}
                              >
                                重命名
                              </button>
                            </form>
                            <form
                              action="/admin/shared-files/move"
                              method="post"
                              style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center" }}
                            >
                              <input type="hidden" name="fileId" value={file.id} />
                              <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                              <select
                                name="targetFolderId"
                                defaultValue={currentFolderRecord?.id || ""}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: 12, border: "1px solid #d1d5db", background: "#fff" }}
                              >
                                {moveTargetOptions.map((option) => (
                                  <option key={option.value || "root"} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="submit"
                                style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #bfdbfe", color: "#1d4ed8", background: "#eff6ff", whiteSpace: "nowrap" }}
                              >
                                移动
                              </button>
                            </form>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {file.status !== SharedFileStatus.ARCHIVED ? (
                                <form action="/admin/shared-files/status" method="post">
                                  <input type="hidden" name="fileId" value={file.id} />
                                  <input type="hidden" name="nextStatus" value={SharedFileStatus.ARCHIVED} />
                                  <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                                  <input type="hidden" name="folderId" value={currentFolder?.id || ""} />
                                  <button type="submit" style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #d1d5db", background: "#fff" }}>
                                    归档
                                  </button>
                                </form>
                              ) : (
                                <form action="/admin/shared-files/status" method="post">
                                  <input type="hidden" name="fileId" value={file.id} />
                                  <input type="hidden" name="nextStatus" value={SharedFileStatus.ACTIVE} />
                                  <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                                  <input type="hidden" name="folderId" value={currentFolder?.id || ""} />
                                  <button type="submit" style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #d1d5db", background: "#fff" }}>
                                    恢复
                                  </button>
                                </form>
                              )}
                              {file.status !== SharedFileStatus.DELETED ? (
                                <form action="/admin/shared-files/status" method="post">
                                  <input type="hidden" name="fileId" value={file.id} />
                                  <input type="hidden" name="nextStatus" value={SharedFileStatus.DELETED} />
                                  <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                                  <input type="hidden" name="folderId" value={currentFolder?.id || ""} />
                                  <button type="submit" style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #fecaca", color: "#991b1b", background: "#fff5f5" }}>
                                    标记删除
                                  </button>
                                </form>
                              ) : (
                                <form action="/admin/shared-files/delete" method="post">
                                  <input type="hidden" name="fileId" value={file.id} />
                                  <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                                  <input type="hidden" name="folderId" value={currentFolder?.id || ""} />
                                  <button
                                    type="submit"
                                    style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #b91c1c", color: "#fff", background: "#b91c1c" }}
                                  >
                                    彻底删除
                                  </button>
                                </form>
                              )}
                            </div>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {files.length === 0 ? (
                    <tr>
                      <td colSpan={isManager ? 7 : 5} style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>
                        当前目录里还没有文件。
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {isManager ? (
          <div style={{ display: "grid", gap: 16, alignContent: "start", alignSelf: "start", position: "sticky", top: 20 }}>
            {currentFolderRecord ? (
              (() => {
                const currentFolderIsEmpty =
                  currentFolderRecord._count.children === 0 && currentFolderRecord._count.files === 0;
                const currentFolderDeleteHint = currentFolderIsEmpty
                  ? "当前文件夹为空，可以直接删除。"
                  : `当前文件夹下还有 ${currentFolderRecord._count.children} 个子文件夹、${currentFolderRecord._count.files} 个文件。`;
                return (
              <section
                id="current-folder-admin"
                style={{
                  borderRadius: 20,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  padding: 20,
                  display: "grid",
                  gap: 14,
                }}
              >
                <div>
                  <h2 style={{ margin: 0 }}>当前文件夹管理</h2>
                  <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
                    可重命名、移动当前目录；只有空文件夹才能删除。
                  </div>
                </div>
                <form action="/admin/shared-files/folder-rename" method="post" style={{ display: "grid", gap: 12 }}>
                  <input type="hidden" name="folderId" value={currentFolderRecord.id} />
                  <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                  <input type="hidden" name="returnFolderId" value={currentFolderRecord.id} />
                  <input type="hidden" name="focusId" value="current-folder-admin" />
                  <label style={{ display: "grid", gap: 6 }}>
                    <span>文件夹名称</span>
                    <input
                      name="name"
                      defaultValue={currentFolderRecord.name}
                      required
                      style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}
                    />
                  </label>
                  <button type="submit" style={{ borderRadius: 999, border: 0, background: "#111827", color: "#fff", padding: "12px 16px", fontWeight: 700 }}>
                    重命名当前文件夹
                  </button>
                </form>
                <form action="/admin/shared-files/folder-move" method="post" style={{ display: "grid", gap: 12 }}>
                  <input type="hidden" name="folderId" value={currentFolderRecord.id} />
                  <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                  <label style={{ display: "grid", gap: 6 }}>
                    <span>移动到</span>
                    <select
                      name="targetParentId"
                      defaultValue={currentFolderRecord.parentId || ""}
                      style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db", background: "#fff" }}
                    >
                      {currentFolderMoveOptions.map((option) => (
                        <option key={option.value || "root"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    style={{ borderRadius: 999, border: 0, background: "#eff6ff", color: "#1d4ed8", padding: "12px 16px", fontWeight: 700 }}
                  >
                    移动当前文件夹
                  </button>
                </form>
                <form action="/admin/shared-files/folder-delete" method="post">
                  <input type="hidden" name="folderId" value={currentFolderRecord.id} />
                  <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                  <input type="hidden" name="returnFolderId" value={currentFolderRecord.parentId || ""} />
                  <input type="hidden" name="focusId" value="file-list" />
                  <button
                    type="submit"
                    disabled={!currentFolderIsEmpty}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 999,
                      border: "1px solid #fecaca",
                      background: currentFolderIsEmpty ? "#fff5f5" : "#f8fafc",
                      color: currentFolderIsEmpty ? "#991b1b" : "#94a3b8",
                      cursor: currentFolderIsEmpty ? "pointer" : "not-allowed",
                    }}
                  >
                    {currentFolderIsEmpty ? "删除当前空文件夹" : "当前文件夹还有内容"}
                  </button>
                  <div style={{ marginTop: 8, color: currentFolderIsEmpty ? "#166534" : "#6b7280", fontSize: 12, lineHeight: 1.5 }}>
                    {currentFolderDeleteHint}
                  </div>
                </form>
              </section>
                );
              })()
            ) : null}
            <section
              style={{
                borderRadius: 20,
                border: "1px solid #e5e7eb",
                background: "#fff",
                padding: 20,
                display: "grid",
                gap: 14,
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>上传到当前目录</h2>
                <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
                  目标位置：{activeCategory?.name || "未选择分类"}
                  {validFolderLineage.map((folder) => ` / ${folder.name}`).join("")}
                </div>
              </div>
              <form action="/admin/shared-files/upload" method="post" encType="multipart/form-data" style={{ display: "grid", gap: 12 }}>
                <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                <input type="hidden" name="folderId" value={currentFolder?.id || ""} />
                <label style={{ display: "grid", gap: 6 }}>
                  <span>文件标题</span>
                  <input name="title" placeholder="不填则使用原文件名" style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }} />
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
                  上传文件
                </button>
              </form>
            </section>

            <section
              id="folder-form"
              style={{
                borderRadius: 20,
                border: "1px solid #e5e7eb",
                background: "#fff",
                padding: 20,
                display: "grid",
                gap: 14,
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>新建文件夹</h2>
                <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
                  在当前目录下面创建新的子文件夹
                </div>
              </div>
              <form action="/admin/shared-files/folder" method="post" style={{ display: "grid", gap: 12 }}>
                <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                <input type="hidden" name="parentId" value={currentFolder?.id || ""} />
                <input name="name" placeholder="例如 法务 / 销售 / 交付" required style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }} />
                <button type="submit" style={{ borderRadius: 999, border: 0, background: "#111827", color: "#fff", padding: "12px 16px", fontWeight: 700 }}>
                  创建文件夹
                </button>
              </form>
            </section>

            <section
              id="category-form"
              style={{
                borderRadius: 20,
                border: "1px solid #e5e7eb",
                background: "#fff",
                padding: 20,
                display: "grid",
                gap: 14,
              }}
            >
              <h2 style={{ margin: 0 }}>新增分类</h2>
              <form action="/admin/shared-files/category" method="post" style={{ display: "grid", gap: 12 }}>
                <input name="name" placeholder="例如 Legal / Sales / Delivery" required style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }} />
                <button type="submit" style={{ borderRadius: 999, border: 0, background: "#374151", color: "#fff", padding: "12px 16px", fontWeight: 700 }}>
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
