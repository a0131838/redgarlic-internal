import Link from "next/link";
import { EmployeeRole, SharedFileStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultFileCategories } from "@/lib/bootstrap";
import { requireEmployee } from "@/lib/auth";
import { getFolderLineage } from "./_lib";
import { BulkActionSubmitButton, BulkSelectionToolbar, ConfirmSubmitButton } from "./confirm-submit-button";

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
  createdAt: Date;
  _count: {
    children: number;
    files: number;
  };
};

type FolderSort = "name-asc" | "name-desc" | "newest" | "oldest";
type FileSort = "newest" | "oldest" | "name-asc" | "name-desc" | "size-desc" | "size-asc";
type ViewMode = "comfortable" | "compact";

const DEFAULT_FOLDER_SORT: FolderSort = "name-asc";
const DEFAULT_FILE_SORT: FileSort = "newest";
const DEFAULT_VIEW_MODE: ViewMode = "comfortable";

const folderSortOptions: Array<{ value: FolderSort; label: string }> = [
  { value: "name-asc", label: "文件夹名 A-Z" },
  { value: "name-desc", label: "文件夹名 Z-A" },
  { value: "newest", label: "文件夹最新" },
  { value: "oldest", label: "文件夹最早" },
];

const fileSortOptions: Array<{ value: FileSort; label: string }> = [
  { value: "newest", label: "文件最新" },
  { value: "oldest", label: "文件最早" },
  { value: "name-asc", label: "文件名 A-Z" },
  { value: "name-desc", label: "文件名 Z-A" },
  { value: "size-desc", label: "文件最大" },
  { value: "size-asc", label: "文件最小" },
];

const viewModeOptions: Array<{ value: ViewMode; label: string }> = [
  { value: "comfortable", label: "舒适视图" },
  { value: "compact", label: "紧凑视图" },
];

function nextToggleSort<T extends string>(current: T, primary: T, secondary: T) {
  return current === primary ? secondary : primary;
}

function sortArrow(active: boolean, direction: "asc" | "desc") {
  if (!active) return "↕";
  return direction === "asc" ? "↑" : "↓";
}

function describeFolderSort(sort: FolderSort) {
  if (sort === "name-desc") return "文件夹按名称倒序";
  if (sort === "newest") return "文件夹按创建时间最新";
  if (sort === "oldest") return "文件夹按创建时间最早";
  return "文件夹按名称正序";
}

function describeFileSort(sort: FileSort) {
  if (sort === "oldest") return "文件按时间最早";
  if (sort === "name-asc") return "文件按名称正序";
  if (sort === "name-desc") return "文件按名称倒序";
  if (sort === "size-desc") return "文件按大小从大到小";
  if (sort === "size-asc") return "文件按大小从小到大";
  return "文件按时间最新";
}

function describeViewMode(viewMode: ViewMode) {
  return viewMode === "compact" ? "紧凑视图" : "舒适视图";
}

function SortHeaderLink({
  href,
  label,
  active,
  direction,
}: {
  href: string;
  label: string;
  active: boolean;
  direction: "asc" | "desc";
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: active ? "#111827" : "#6b7280",
        textDecoration: "none",
        fontWeight: active ? 700 : 600,
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: 12 }}>{sortArrow(active, direction)}</span>
    </Link>
  );
}

function MetaChip({
  label,
  tone = "slate",
}: {
  label: string;
  tone?: "slate" | "blue" | "amber";
}) {
  const palette =
    tone === "blue"
      ? { background: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" }
      : tone === "amber"
        ? { background: "#fff7ed", color: "#9a3412", border: "#fed7aa" }
        : { background: "#f8fafc", color: "#475569", border: "#e2e8f0" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: SharedFileStatus }) {
  if (status === SharedFileStatus.ACTIVE) {
    return <MetaChip label="可用" tone="blue" />;
  }
  if (status === SharedFileStatus.ARCHIVED) {
    return <MetaChip label="已归档" tone="slate" />;
  }
  return <MetaChip label="待彻底删除" tone="amber" />;
}

function ToolLink({
  href,
  label,
  tone = "slate",
}: {
  href: string;
  label: string;
  tone?: "slate" | "blue" | "amber";
}) {
  const palette =
    tone === "blue"
      ? { background: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" }
      : tone === "amber"
        ? { background: "#fff7ed", color: "#9a3412", border: "#fed7aa" }
        : { background: "#ffffff", color: "#334155", border: "#e2e8f0" };

  return (
    <a
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px 12px",
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        textDecoration: "none",
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {label}
    </a>
  );
}

function ActionDisclosure({
  label = "更多操作",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <details
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#f8fafc",
        padding: "8px 10px",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 700,
          color: "#334155",
          listStyle: "none",
        }}
      >
        {label}
      </summary>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>{children}</div>
    </details>
  );
}

function RailSection({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        borderRadius: 20,
        border: "1px solid #e5e7eb",
        background: "#fff",
        padding: 20,
        display: "grid",
        gap: 14,
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {description ? (
          <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>{description}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ExplorerStateHiddenFields({
  redirectFolderId,
  q,
  status,
  folderSort,
  fileSort,
  viewMode,
}: {
  redirectFolderId?: string;
  q: string;
  status: string;
  folderSort: FolderSort;
  fileSort: FileSort;
  viewMode: ViewMode;
}) {
  return (
    <>
      <input type="hidden" name="redirectFolderId" value={redirectFolderId || ""} />
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="folderSort" value={folderSort} />
      <input type="hidden" name="fileSort" value={fileSort} />
      <input type="hidden" name="viewMode" value={viewMode} />
    </>
  );
}

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
  folderSort?: string;
  fileSort?: string;
  viewMode?: string;
  msg?: string;
  err?: string;
}) {
  const search = new URLSearchParams();
  if (params.categoryId) search.set("categoryId", params.categoryId);
  if (params.folderId) search.set("folderId", params.folderId);
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.folderSort) search.set("folderSort", params.folderSort);
  if (params.fileSort) search.set("fileSort", params.fileSort);
  if (params.viewMode) search.set("viewMode", params.viewMode);
  if (params.msg) search.set("msg", params.msg);
  if (params.err) search.set("err", params.err);
  const qs = search.toString();
  return qs ? `/admin/shared-files?${qs}` : "/admin/shared-files";
}

function parseFolderSort(value: string): FolderSort {
  return folderSortOptions.some((option) => option.value === value)
    ? (value as FolderSort)
    : DEFAULT_FOLDER_SORT;
}

function parseFileSort(value: string): FileSort {
  return fileSortOptions.some((option) => option.value === value)
    ? (value as FileSort)
    : DEFAULT_FILE_SORT;
}

function parseViewMode(value: string): ViewMode {
  return viewModeOptions.some((option) => option.value === value)
    ? (value as ViewMode)
    : DEFAULT_VIEW_MODE;
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "zh-CN");
}

function sortFolders(folders: FolderListItem[], sort: FolderSort) {
  return [...folders].sort((a, b) => {
    if (sort === "name-desc") return compareText(b.name, a.name);
    if (sort === "newest") return b.createdAt.getTime() - a.createdAt.getTime();
    if (sort === "oldest") return a.createdAt.getTime() - b.createdAt.getTime();
    return compareText(a.name, b.name);
  });
}

function sortFiles<
  T extends {
    title: string;
    fileSizeBytes: number;
    createdAt: Date;
  },
>(files: T[], sort: FileSort) {
  return [...files].sort((a, b) => {
    if (sort === "oldest") return a.createdAt.getTime() - b.createdAt.getTime();
    if (sort === "name-asc") return compareText(a.title, b.title);
    if (sort === "name-desc") return compareText(b.title, a.title);
    if (sort === "size-desc") return b.fileSizeBytes - a.fileSizeBytes;
    if (sort === "size-asc") return a.fileSizeBytes - b.fileSizeBytes;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

function humanizeFeedbackMessage(msg: string) {
  if (!msg) return "";

  if (msg === "uploaded") return "文件上传成功。";
  if (msg === "category-created") return "新分类已经创建好了。";
  if (msg === "folder-created") return "文件夹创建成功。";
  if (msg === "folder-renamed") return "文件夹名称已更新。";
  if (msg === "folder-rename-skipped") return "文件夹名称没有变化。";
  if (msg === "folder-moved") return "文件夹已经移动到新目录。";
  if (msg === "folder-move-skipped") return "文件夹位置没有变化。";
  if (msg === "folder-deleted") return "文件夹已删除。";
  if (msg === "file-renamed") return "文件名称已更新。";
  if (msg === "file-rename-skipped") return "文件名称没有变化。";
  if (msg === "file-moved") return "文件已经移动到新目录。";
  if (msg === "file-move-skipped") return "文件位置没有变化。";
  if (msg === "file-bulk-move-skipped") return "选中的文件已经都在目标目录里。";
  if (msg === "file-bulk-archive-skipped") return "选中的文件已经都处于归档状态。";
  if (msg === "file-bulk-delete-skipped") return "选中的文件已经都标记删除了。";
  if (msg === "file-bulk-restore-skipped") return "选中的文件已经都是可用状态了。";
  if (msg === "deleted-permanently") return "文件已从系统和存储中彻底删除。";
  if (msg === "status-active") return "文件已恢复为可用状态。";
  if (msg === "status-archived") return "文件已归档。";
  if (msg === "status-deleted") return "文件已标记删除。";

  const bulkMoved = msg.match(/^file-bulk-moved-(\d+)$/);
  if (bulkMoved) return `已批量移动 ${bulkMoved[1]} 个文件。`;

  const bulkArchived = msg.match(/^file-bulk-archived-(\d+)$/);
  if (bulkArchived) return `已批量归档 ${bulkArchived[1]} 个文件。`;

  const bulkDeleted = msg.match(/^file-bulk-deleted-(\d+)$/);
  if (bulkDeleted) return `已批量标记删除 ${bulkDeleted[1]} 个文件。`;

  const bulkRestored = msg.match(/^file-bulk-restored-(\d+)$/);
  if (bulkRestored) return `已批量恢复 ${bulkRestored[1]} 个文件为可用状态。`;

  return msg.replace(/-/g, " ");
}

export default async function SharedFilesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    categoryId?: string;
    folderId?: string;
    status?: string;
    folderSort?: string;
    fileSort?: string;
    viewMode?: string;
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
  const folderSort = parseFolderSort(text(sp?.folderSort));
  const fileSort = parseFileSort(text(sp?.fileSort));
  const viewMode = parseViewMode(text(sp?.viewMode));

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
          orderBy: [{ createdAt: "desc" }],
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
  const folders = sortFolders(
    allFolders.filter((folder) => folder.parentId === (currentFolderRecord?.id || null)),
    folderSort,
  );
  const sortedFiles = sortFiles(files, fileSort);
  const folderOptions = buildFolderOptions(allFolders);
  const moveTargetOptions = [{ value: "", label: "根目录" }, ...folderOptions];
  const currentFolderMoveOptions = currentFolderRecord
    ? [{ value: "", label: "根目录" }, ...buildFolderOptions(allFolders, null, 0, [], collectDescendantIds(allFolders, currentFolderRecord.id))]
    : [];
  const baseExplorerParams = {
    categoryId: activeCategory?.id,
    folderId: currentFolder?.id || undefined,
    q,
    status,
    folderSort,
    fileSort,
    viewMode,
  };
  const folderNameSortHref = buildHref({
    ...baseExplorerParams,
    folderSort: nextToggleSort(folderSort, "name-asc", "name-desc"),
  });
  const folderTimeSortHref = buildHref({
    ...baseExplorerParams,
    folderSort: nextToggleSort(folderSort, "newest", "oldest"),
  });
  const fileNameSortHref = buildHref({
    ...baseExplorerParams,
    fileSort: nextToggleSort(fileSort, "name-asc", "name-desc"),
  });
  const fileSizeSortHref = buildHref({
    ...baseExplorerParams,
    fileSort: nextToggleSort(fileSort, "size-desc", "size-asc"),
  });
  const fileTimeSortHref = buildHref({
    ...baseExplorerParams,
    fileSort: nextToggleSort(fileSort, "newest", "oldest"),
  });
  const folderCountLabel =
    folders.length > 0 ? `${folders.length} 个子文件夹` : "没有子文件夹";
  const fileCountLabel =
    sortedFiles.length > 0 ? `${sortedFiles.length} 个文件` : "没有文件";
  const hasFilters = Boolean(q || status);
  const clearFilterHref = buildHref({
    categoryId: activeCategory?.id,
    folderId: currentFolder?.id || undefined,
    folderSort,
    fileSort,
    viewMode,
  });

  const rootHref = buildHref({
    categoryId: activeCategory?.id,
    q,
    status,
    folderSort,
    fileSort,
    viewMode,
  });
  const feedbackMessage = humanizeFeedbackMessage(text(sp?.msg));
  const parentFolder = currentFolderRecord?.parentId ? folderMap.get(currentFolderRecord.parentId) || null : null;
  const parentFolderHref = parentFolder
    ? buildHref({
        categoryId: activeCategory?.id,
        folderId: parentFolder.id,
        q,
        status,
        folderSort,
        fileSort,
        viewMode,
      })
    : rootHref;
  const isCompact = viewMode === "compact";
  const rowPadding = isCompact ? "10px 8px" : "14px 8px";
  const folderGridTemplate = isCompact
    ? "repeat(auto-fit, minmax(180px, 1fr))"
    : "repeat(auto-fit, minmax(220px, 1fr))";

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

      {feedbackMessage ? (
        <div style={{ padding: 12, borderRadius: 16, background: "#ecfdf5", color: "#166534", border: "1px solid #bbf7d0" }}>
          {feedbackMessage}
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
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <select
                name="folderSort"
                defaultValue={folderSort}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}
              >
                {folderSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                name="fileSort"
                defaultValue={fileSort}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}
              >
                {fileSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <select
              name="viewMode"
              defaultValue={viewMode}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}
            >
              {viewModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {currentFolder ? <input type="hidden" name="folderId" value={currentFolder.id} /> : null}
          </form>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <MetaChip label={folderCountLabel} />
            <MetaChip label={fileCountLabel} />
            <MetaChip label={describeFolderSort(folderSort)} tone="blue" />
            <MetaChip label={describeFileSort(fileSort)} tone="blue" />
            <MetaChip label={describeViewMode(viewMode)} tone="amber" />
            {hasFilters ? (
              <Link
                href={clearFilterHref}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #fecaca",
                  background: "#fff5f5",
                  color: "#991b1b",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                清空筛选
              </Link>
            ) : null}
          </div>

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
                    q,
                    folderSort,
                    fileSort,
                    viewMode,
                  })}
                  style={{ color: folder.id === currentFolder?.id ? "#111827" : "#1d4ed8", textDecoration: "none", fontWeight: 700 }}
                >
                  {folder.name}
                </Link>
              </div>
            ))}
          </div>

          <section style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>当前目录</h2>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <MetaChip label={folderCountLabel} />
                  <MetaChip label={describeFolderSort(folderSort)} tone="blue" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <SortHeaderLink
                  href={folderNameSortHref}
                  label="按名称"
                  active={folderSort === "name-asc" || folderSort === "name-desc"}
                  direction={folderSort === "name-desc" ? "desc" : "asc"}
                />
                <SortHeaderLink
                  href={folderTimeSortHref}
                  label="按时间"
                  active={folderSort === "newest" || folderSort === "oldest"}
                  direction={folderSort === "oldest" ? "asc" : "desc"}
                />
                {currentFolder ? (
                  <Link href={parentFolderHref} style={{ color: "#1d4ed8", textDecoration: "none", fontSize: 14 }}>
                    返回上一级
                  </Link>
                ) : null}
                {currentFolder ? (
                  <Link href={rootHref} style={{ color: "#1d4ed8", textDecoration: "none", fontSize: 14 }}>
                    返回根目录
                  </Link>
                ) : null}
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 16, background: "#f8fafc", color: "#475569", fontSize: 13 }}>
              当前位置：
              <span style={{ marginLeft: 6, color: "#111827", fontWeight: 700 }}>
                {[activeCategory?.name || "共享文件", ...validFolderLineage.map((folder) => folder.name)].join(" / ")}
              </span>
            </div>

            {folders.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gap: 14,
                  gridTemplateColumns: folderGridTemplate,
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
                        padding: isCompact ? 14 : 18,
                        color: "#111827",
                        scrollMarginTop: 24,
                        boxShadow: isCompact ? "none" : "0 8px 24px rgba(15, 23, 42, 0.04)",
                      }}
                    >
                      <Link
                        href={buildHref({
                          categoryId: activeCategory?.id,
                          folderId: folder.id,
                          q,
                          status,
                          folderSort,
                          fileSort,
                          viewMode,
                        })}
                        style={{ display: "grid", gap: 8, textDecoration: "none", color: "#111827" }}
                      >
                        <div style={{ fontSize: 28 }}>📁</div>
                        <div style={{ fontWeight: 700, fontSize: isCompact ? 15 : 16 }}>{folder.name}</div>
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
                            <ExplorerStateHiddenFields
                              redirectFolderId={currentFolderRecord?.id || ""}
                              q={q}
                              status={status}
                              folderSort={folderSort}
                              fileSort={fileSort}
                              viewMode={viewMode}
                            />
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
                          <ActionDisclosure>
                              <form action="/admin/shared-files/folder-move" method="post" style={{ display: "grid", gap: 8 }}>
                                <input type="hidden" name="folderId" value={folder.id} />
                                <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                                <ExplorerStateHiddenFields
                                  redirectFolderId={currentFolderRecord?.id || ""}
                                  q={q}
                                  status={status}
                                  folderSort={folderSort}
                                  fileSort={fileSort}
                                  viewMode={viewMode}
                                />
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
                                <ExplorerStateHiddenFields
                                  redirectFolderId={currentFolderRecord?.id || ""}
                                  q={q}
                                  status={status}
                                  folderSort={folderSort}
                                  fileSort={fileSort}
                                  viewMode={viewMode}
                                />
                                <ConfirmSubmitButton
                                  confirmMessage={`确定要删除文件夹“${folder.name}”吗？`}
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
                                </ConfirmSubmitButton>
                                <div style={{ marginTop: 6, color: isEmptyFolder ? "#166534" : "#6b7280", fontSize: 12, lineHeight: 1.5 }}>
                                  {folderDeleteHint}
                                </div>
                              </form>
                          </ActionDisclosure>
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
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>文件</h2>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <MetaChip label={fileCountLabel} />
                  <MetaChip label={describeFileSort(fileSort)} tone="blue" />
                </div>
              </div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                直接点击列表列头也可以切换常用排序。
              </div>
            </div>
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
                  boxShadow: "inset 0 0 0 1px rgba(191, 219, 254, 0.2)",
                }}
              >
                <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                <ExplorerStateHiddenFields
                  redirectFolderId={currentFolderRecord?.id || ""}
                  q={q}
                  status={status}
                  folderSort={folderSort}
                  fileSort={fileSort}
                  viewMode={viewMode}
                />
                <div style={{ fontWeight: 700, color: "#1e3a8a" }}>批量整理当前目录文件</div>
                <BulkSelectionToolbar />
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "180px minmax(0, 1fr) auto", alignItems: "center" }}>
                  <select
                    name="bulkAction"
                    defaultValue="MOVE"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #bfdbfe", background: "#fff" }}
                  >
                    <option value="MOVE">批量移动</option>
                    <option value="ARCHIVE">批量归档</option>
                    <option value="RESTORE">批量恢复为可用</option>
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
                  <BulkActionSubmitButton
                    style={{ padding: "10px 16px", borderRadius: 999, border: 0, background: "#1d4ed8", color: "#fff", fontWeight: 700 }}
                  />
                </div>
                <div style={{ color: "#475569", fontSize: 13 }}>
                  先在下方勾选文件。只有“批量移动”会使用目标目录，其余动作会忽略右侧目录选择。
                </div>
              </form>
            ) : null}
            <div
              style={{
                overflowX: "auto",
                paddingBottom: 4,
                borderRadius: 18,
                border: "1px solid #e5e7eb",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>
                    {isManager ? <th style={{ padding: "12px 8px", width: 52, background: "#f8fafc" }}>选择</th> : null}
                    <th style={{ padding: "12px 8px" }}>
                      <SortHeaderLink
                        href={fileNameSortHref}
                        label="文件"
                        active={fileSort === "name-asc" || fileSort === "name-desc"}
                        direction={fileSort === "name-desc" ? "desc" : "asc"}
                      />
                    </th>
                    <th style={{ padding: "12px 8px", background: "#f8fafc" }}>状态</th>
                    <th style={{ padding: "12px 8px", background: "#f8fafc" }}>上传人</th>
                    <th style={{ padding: "12px 8px" }}>
                      <SortHeaderLink
                        href={fileSizeSortHref}
                        label="大小"
                        active={fileSort === "size-desc" || fileSort === "size-asc"}
                        direction={fileSort === "size-asc" ? "asc" : "desc"}
                      />
                    </th>
                    <th style={{ padding: "12px 8px" }}>
                      <SortHeaderLink
                        href={fileTimeSortHref}
                        label="时间"
                        active={fileSort === "newest" || fileSort === "oldest"}
                        direction={fileSort === "oldest" ? "asc" : "desc"}
                      />
                    </th>
                    {isManager ? <th style={{ padding: "12px 8px", background: "#f8fafc" }}>操作</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {sortedFiles.map((file) => (
                    <tr
                      id={`file-${file.id}`}
                      key={file.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        verticalAlign: "top",
                        scrollMarginTop: 24,
                        background: file.status === SharedFileStatus.DELETED ? "#fff7f7" : "#fff",
                      }}
                    >
                      {isManager ? (
                        <td style={{ padding: rowPadding }}>
                          <input
                            type="checkbox"
                            name="fileIds"
                            value={file.id}
                            form="bulk-file-move-form"
                            className="bulk-file-checkbox"
                            data-file-status={file.status}
                            aria-label={`选择文件 ${file.title}`}
                          />
                        </td>
                      ) : null}
                      <td style={{ padding: rowPadding }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 700, fontSize: isCompact ? 14 : 16 }}>{file.title}</div>
                          {file.status !== SharedFileStatus.ACTIVE ? <StatusPill status={file.status} /> : null}
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 13 }}>{file.originalFileName}</div>
                        {file.remarks ? <div style={{ marginTop: 6, color: "#4b5563", fontSize: 13 }}>{file.remarks}</div> : null}
                        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <a href={`/api/admin/shared-files/${file.id}`} target="_blank" rel="noreferrer">
                            预览
                          </a>
                          <a href={`/api/admin/shared-files/${file.id}?download=1`}>下载</a>
                        </div>
                      </td>
                      <td style={{ padding: rowPadding }}>
                        <StatusPill status={file.status} />
                      </td>
                      <td style={{ padding: rowPadding }}>
                        <div>{file.uploader.name}</div>
                        <div style={{ color: "#6b7280", fontSize: 13 }}>{file.uploader.email}</div>
                      </td>
                      <td style={{ padding: rowPadding }}>{formatBytes(file.fileSizeBytes)}</td>
                      <td style={{ padding: rowPadding, color: "#4b5563", fontSize: 13 }}>{formatTime(file.createdAt)}</td>
                      {isManager ? (
                        <td style={{ padding: rowPadding }}>
                          <div style={{ display: "grid", gap: 10, minWidth: 280 }}>
                            <form
                              action="/admin/shared-files/rename"
                              method="post"
                              style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center" }}
                            >
                              <input type="hidden" name="fileId" value={file.id} />
                              <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                              <input type="hidden" name="folderId" value={currentFolder?.id || ""} />
                              <ExplorerStateHiddenFields
                                redirectFolderId={currentFolder?.id || ""}
                                q={q}
                                status={status}
                                folderSort={folderSort}
                                fileSort={fileSort}
                                viewMode={viewMode}
                              />
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
                              <input type="hidden" name="folderId" value={currentFolder?.id || ""} />
                              <ExplorerStateHiddenFields
                                redirectFolderId={currentFolder?.id || ""}
                                q={q}
                                status={status}
                                folderSort={folderSort}
                                fileSort={fileSort}
                                viewMode={viewMode}
                              />
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
                            <ActionDisclosure>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {file.status === SharedFileStatus.ACTIVE ? (
                                  <form action="/admin/shared-files/status" method="post">
                                    <input type="hidden" name="fileId" value={file.id} />
                                    <input type="hidden" name="nextStatus" value={SharedFileStatus.ARCHIVED} />
                                    <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                                    <input type="hidden" name="folderId" value={currentFolder?.id || ""} />
                                    <ExplorerStateHiddenFields
                                      redirectFolderId={currentFolder?.id || ""}
                                      q={q}
                                      status={status}
                                      folderSort={folderSort}
                                      fileSort={fileSort}
                                      viewMode={viewMode}
                                    />
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
                                    <ExplorerStateHiddenFields
                                      redirectFolderId={currentFolder?.id || ""}
                                      q={q}
                                      status={status}
                                      folderSort={folderSort}
                                      fileSort={fileSort}
                                      viewMode={viewMode}
                                    />
                                    <button type="submit" style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #d1d5db", background: "#fff" }}>
                                      恢复为可用
                                    </button>
                                  </form>
                                )}
                                {file.status !== SharedFileStatus.DELETED ? (
                                  <form action="/admin/shared-files/status" method="post">
                                    <input type="hidden" name="fileId" value={file.id} />
                                    <input type="hidden" name="nextStatus" value={SharedFileStatus.DELETED} />
                                    <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                                    <input type="hidden" name="folderId" value={currentFolder?.id || ""} />
                                    <ExplorerStateHiddenFields
                                      redirectFolderId={currentFolder?.id || ""}
                                      q={q}
                                      status={status}
                                      folderSort={folderSort}
                                      fileSort={fileSort}
                                      viewMode={viewMode}
                                    />
                                    <button type="submit" style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #fecaca", color: "#991b1b", background: "#fff5f5" }}>
                                      标记删除
                                    </button>
                                  </form>
                                ) : (
                                  <form action="/admin/shared-files/delete" method="post">
                                    <input type="hidden" name="fileId" value={file.id} />
                                    <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                                    <input type="hidden" name="folderId" value={currentFolder?.id || ""} />
                                    <ExplorerStateHiddenFields
                                      redirectFolderId={currentFolder?.id || ""}
                                      q={q}
                                      status={status}
                                      folderSort={folderSort}
                                      fileSort={fileSort}
                                      viewMode={viewMode}
                                    />
                                  <ConfirmSubmitButton
                                    confirmMessage={`确定要彻底删除文件“${file.title}”吗？这个操作会连同存储中的文件一起移除，无法恢复。`}
                                    style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #b91c1c", color: "#fff", background: "#b91c1c" }}
                                  >
                                    彻底删除
                                  </ConfirmSubmitButton>
                                </form>
                              )}
                              </div>
                            </ActionDisclosure>
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
            <RailSection
              title="快速工具"
              description="把右侧常用管理动作收成一个固定工具带，切目录时也能快速跳转。"
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {currentFolderRecord ? <ToolLink href="#current-folder-admin" label="当前文件夹" tone="blue" /> : null}
                <ToolLink href="#upload-panel" label="上传文件" tone="blue" />
                <ToolLink href="#folder-form" label="新建文件夹" />
                <ToolLink href="#category-form" label="新增分类" tone="amber" />
              </div>
            </RailSection>
            {currentFolderRecord ? (
              (() => {
                const currentFolderIsEmpty =
                  currentFolderRecord._count.children === 0 && currentFolderRecord._count.files === 0;
                const currentFolderDeleteHint = currentFolderIsEmpty
                  ? "当前文件夹为空，可以直接删除。"
                  : `当前文件夹下还有 ${currentFolderRecord._count.children} 个子文件夹、${currentFolderRecord._count.files} 个文件。`;
                return (
              <RailSection
                id="current-folder-admin"
                title="当前文件夹管理"
                description="可重命名、移动当前目录；只有空文件夹才能删除。"
              >
                <form action="/admin/shared-files/folder-rename" method="post" style={{ display: "grid", gap: 12 }}>
                  <input type="hidden" name="folderId" value={currentFolderRecord.id} />
                  <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                  <input type="hidden" name="returnFolderId" value={currentFolderRecord.id} />
                  <input type="hidden" name="focusId" value="current-folder-admin" />
                  <ExplorerStateHiddenFields
                    redirectFolderId={currentFolderRecord.id}
                    q={q}
                    status={status}
                    folderSort={folderSort}
                    fileSort={fileSort}
                    viewMode={viewMode}
                  />
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
                  <ExplorerStateHiddenFields
                    redirectFolderId={currentFolderRecord.id}
                    q={q}
                    status={status}
                    folderSort={folderSort}
                    fileSort={fileSort}
                    viewMode={viewMode}
                  />
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
                  <ExplorerStateHiddenFields
                    redirectFolderId={currentFolderRecord.id}
                    q={q}
                    status={status}
                    folderSort={folderSort}
                    fileSort={fileSort}
                    viewMode={viewMode}
                  />
                  <ConfirmSubmitButton
                    confirmMessage={`确定要删除当前文件夹“${currentFolderRecord.name}”吗？`}
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
                  </ConfirmSubmitButton>
                  <div style={{ marginTop: 8, color: currentFolderIsEmpty ? "#166534" : "#6b7280", fontSize: 12, lineHeight: 1.5 }}>
                    {currentFolderDeleteHint}
                  </div>
                </form>
              </RailSection>
                );
              })()
            ) : null}
            <RailSection
              id="upload-panel"
              title="上传到当前目录"
              description={`目标位置：${activeCategory?.name || "未选择分类"}${validFolderLineage.map((folder) => ` / ${folder.name}`).join("")}`}
            >
              <form action="/admin/shared-files/upload" method="post" encType="multipart/form-data" style={{ display: "grid", gap: 12 }}>
                <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                <input type="hidden" name="folderId" value={currentFolder?.id || ""} />
                <ExplorerStateHiddenFields
                  redirectFolderId={currentFolder?.id || ""}
                  q={q}
                  status={status}
                  folderSort={folderSort}
                  fileSort={fileSort}
                  viewMode={viewMode}
                />
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
            </RailSection>

            <RailSection
              id="folder-form"
              title="新建文件夹"
              description="在当前目录下面创建新的子文件夹。"
            >
              <form action="/admin/shared-files/folder" method="post" style={{ display: "grid", gap: 12 }}>
                <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                <input type="hidden" name="parentId" value={currentFolder?.id || ""} />
                <ExplorerStateHiddenFields
                  redirectFolderId={currentFolder?.id || ""}
                  q={q}
                  status={status}
                  folderSort={folderSort}
                  fileSort={fileSort}
                  viewMode={viewMode}
                />
                <input name="name" placeholder="例如 法务 / 销售 / 交付" required style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }} />
                <button type="submit" style={{ borderRadius: 999, border: 0, background: "#111827", color: "#fff", padding: "12px 16px", fontWeight: 700 }}>
                  创建文件夹
                </button>
              </form>
            </RailSection>

            <RailSection
              id="category-form"
              title="新增分类"
              description="给共享文件库补充新的一级分类。"
            >
              <form action="/admin/shared-files/category" method="post" style={{ display: "grid", gap: 12 }}>
                <input type="hidden" name="categoryId" value={activeCategory?.id || ""} />
                <ExplorerStateHiddenFields
                  redirectFolderId={currentFolder?.id || ""}
                  q={q}
                  status={status}
                  folderSort={folderSort}
                  fileSort={fileSort}
                  viewMode={viewMode}
                />
                <input name="name" placeholder="例如 Legal / Sales / Delivery" required style={{ padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }} />
                <button type="submit" style={{ borderRadius: 999, border: 0, background: "#374151", color: "#fff", padding: "12px 16px", fontWeight: 700 }}>
                  创建分类
                </button>
              </form>
            </RailSection>
          </div>
        ) : null}
      </section>
    </main>
  );
}
