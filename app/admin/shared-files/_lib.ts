import { EmployeeRole, SharedFileStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultFileCategories } from "@/lib/bootstrap";
import { getCurrentEmployee } from "@/lib/auth";
import { deleteSharedFileObject, storeSharedFile } from "@/lib/shared-file-storage";

function text(value: FormDataEntryValue | null | undefined) {
  return String(value ?? "").trim();
}

function enc(value: string) {
  return encodeURIComponent(value);
}

function sharedFilesPath(query: string, hash?: string) {
  const fragment = hash ? `#${hash}` : "";
  return `/admin/shared-files?${query}${fragment}`;
}

type SharedFilesRedirectInput = {
  categoryId?: string | null;
  folderId?: string | null;
  q?: string | null;
  status?: string | null;
  folderSort?: string | null;
  fileSort?: string | null;
  viewMode?: string | null;
  msg?: string | null;
};

function requestOrigin(request: Request) {
  const fallback = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    fallback.host;
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    fallback.protocol.replace(/:$/, "");

  return `${protocol}://${host}`;
}

export function redirectUrl(request: Request, path: string) {
  return new URL(path, requestOrigin(request));
}

type RouteManagerAuth =
  | {
      employee: NonNullable<Awaited<ReturnType<typeof getCurrentEmployee>>>;
    }
  | {
      redirectTo: URL;
    };

export async function requireManagerForRoute(request: Request): Promise<RouteManagerAuth> {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return {
      redirectTo: redirectUrl(request, "/admin/login"),
    };
  }
  if (employee.role !== EmployeeRole.OWNER && employee.role !== EmployeeRole.ADMIN) {
    return {
      redirectTo: redirectUrl(request, "/admin/shared-files?err=permission-denied"),
    };
  }
  return { employee };
}

export async function getFolderLineage(folderId: string) {
  const lineage: Array<{ id: string; name: string; categoryId: string; parentId: string | null }> = [];
  let cursor = folderId;

  while (cursor) {
    const folder = await prisma.sharedFolder.findUnique({
      where: { id: cursor },
      select: {
        id: true,
        name: true,
        categoryId: true,
        parentId: true,
      },
    });

    if (!folder) {
      return null;
    }

    lineage.unshift(folder);
    cursor = folder.parentId ?? "";
  }

  return lineage;
}

async function getFolderRecord(folderId: string) {
  return prisma.sharedFolder.findUnique({
    where: { id: folderId },
    select: {
      id: true,
      name: true,
      categoryId: true,
      parentId: true,
    },
  });
}

async function ensureFolderInCategory(folderId: string, categoryId: string) {
  const lineage = await getFolderLineage(folderId);
  if (!lineage?.length || lineage[lineage.length - 1]?.categoryId !== categoryId) {
    return null;
  }
  return lineage;
}

function buildSharedFilesParams(input: SharedFilesRedirectInput) {
  const params = new URLSearchParams();
  if (input.categoryId) params.set("categoryId", input.categoryId);
  if (input.folderId) params.set("folderId", input.folderId);
  if (input.q) params.set("q", input.q);
  if (input.status) params.set("status", input.status);
  if (input.folderSort) params.set("folderSort", input.folderSort);
  if (input.fileSort) params.set("fileSort", input.fileSort);
  if (input.viewMode) params.set("viewMode", input.viewMode);
  if (input.msg) params.set("msg", input.msg);
  return params;
}

function readSharedFilesRedirectState(
  formData: FormData,
  overrides: Partial<SharedFilesRedirectInput> = {},
): SharedFilesRedirectInput {
  return {
    categoryId: text(formData.get("categoryId")) || null,
    folderId: text(formData.get("redirectFolderId") || formData.get("folderId")) || null,
    q: text(formData.get("q")) || null,
    status: text(formData.get("status")) || null,
    folderSort: text(formData.get("folderSort")) || null,
    fileSort: text(formData.get("fileSort")) || null,
    viewMode: text(formData.get("viewMode")) || null,
    ...overrides,
  };
}

export async function addCategoryFromForm(formData: FormData) {
  const name = text(formData.get("name")).slice(0, 40);
  if (!name) {
    return { error: "分类名称不能为空" };
  }

  try {
    await prisma.fileCategory.create({
      data: { name, sortOrder: 100 },
    });
  } catch {
    return { error: "分类已存在" };
  }

  const params = buildSharedFilesParams({
    ...readSharedFilesRedirectState(formData),
    msg: "category-created",
  });
  return { successPath: sharedFilesPath(params.toString(), "category-form") };
}

export async function createFolderFromForm(formData: FormData) {
  await ensureDefaultFileCategories();

  const redirectState = readSharedFilesRedirectState(formData);
  const name = text(formData.get("name")).slice(0, 80);
  const categoryId = text(formData.get("categoryId"));
  const parentId = text(formData.get("parentId")) || null;

  if (!name) {
    return { error: "文件夹名称不能为空" };
  }
  if (!categoryId) {
    return { error: "请选择分类" };
  }

  const category = await prisma.fileCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    return { error: "分类不存在" };
  }

  if (parentId) {
    const lineage = await getFolderLineage(parentId);
    if (!lineage?.length || lineage[lineage.length - 1]?.categoryId !== categoryId) {
      return { error: "目标目录不存在" };
    }
  }

  try {
    const created = await prisma.sharedFolder.create({
      data: {
        name,
        categoryId,
        parentId,
      },
      select: { id: true },
    });

    const params = buildSharedFilesParams({
      ...redirectState,
      categoryId,
      folderId: created.id,
      msg: "folder-created",
    });
    return { successPath: sharedFilesPath(params.toString(), `folder-${created.id}`) };
  } catch {
    return { error: "同一目录下已存在同名文件夹" };
  }
}

export async function renameFolderFromForm(formData: FormData) {
  const redirectState = readSharedFilesRedirectState(formData);
  const folderId = text(formData.get("folderId"));
  const nextName = text(formData.get("name")).slice(0, 80);
  const categoryId = text(formData.get("categoryId"));
  const returnFolderId = text(formData.get("returnFolderId"));
  const focusId = text(formData.get("focusId"));

  if (!folderId || !nextName) {
    return { error: "文件夹名称不能为空" };
  }

  const folder = await getFolderRecord(folderId);
  if (!folder || (categoryId && folder.categoryId !== categoryId)) {
    return { error: "文件夹不存在" };
  }

  if (folder.name === nextName) {
    const params = buildSharedFilesParams({
      ...redirectState,
      categoryId: folder.categoryId,
      folderId: returnFolderId || null,
      msg: "folder-rename-skipped",
    });
    return { successPath: sharedFilesPath(params.toString(), focusId || `folder-${folderId}`) };
  }

  try {
    await prisma.sharedFolder.update({
      where: { id: folderId },
      data: { name: nextName },
    });
  } catch {
    return { error: "同一目录下已存在同名文件夹" };
  }

  const params = buildSharedFilesParams({
    ...redirectState,
    categoryId: folder.categoryId,
    folderId: returnFolderId || folderId,
    msg: "folder-renamed",
  });
  return { successPath: sharedFilesPath(params.toString(), focusId || `folder-${folderId}`) };
}

export async function moveFolderFromForm(formData: FormData) {
  const redirectState = readSharedFilesRedirectState(formData);
  const folderId = text(formData.get("folderId"));
  const categoryId = text(formData.get("categoryId"));
  const targetParentId = text(formData.get("targetParentId")) || null;

  if (!folderId || !categoryId) {
    return { error: "无效操作" };
  }

  const folder = await getFolderRecord(folderId);
  if (!folder || folder.categoryId !== categoryId) {
    return { error: "文件夹不存在" };
  }

  if (folder.parentId === targetParentId) {
    const params = buildSharedFilesParams({
      ...redirectState,
      categoryId,
      folderId,
      msg: "folder-move-skipped",
    });
    return { successPath: sharedFilesPath(params.toString(), `folder-${folderId}`) };
  }

  if (targetParentId) {
    const lineage = await ensureFolderInCategory(targetParentId, categoryId);
    if (!lineage?.length) {
      return { error: "目标目录不存在" };
    }
    if (lineage.some((item) => item.id === folderId)) {
      return { error: "不能把文件夹移动到它自己的子目录里" };
    }
  }

  try {
    await prisma.sharedFolder.update({
      where: { id: folderId },
      data: { parentId: targetParentId },
    });
  } catch {
    return { error: "目标目录中已存在同名文件夹" };
  }

  const params = buildSharedFilesParams({
    ...redirectState,
    categoryId,
    folderId,
    msg: "folder-moved",
  });
  return { successPath: sharedFilesPath(params.toString(), "current-folder-admin") };
}

export async function applyBulkSharedFolderActionFromForm(formData: FormData) {
  const redirectState = readSharedFilesRedirectState(formData);
  const categoryId = text(formData.get("categoryId"));
  const currentFolderId = text(formData.get("folderId")) || null;
  const bulkAction = text(formData.get("bulkAction")).toUpperCase();
  const targetParentId = text(formData.get("targetParentId")) || null;
  const folderIds = Array.from(
    new Set(
      formData
        .getAll("folderIds")
        .map((entry) => text(entry))
        .filter(Boolean),
    ),
  );

  if (!categoryId || folderIds.length === 0) {
    return { error: "请先选择要处理的文件夹" };
  }

  const folders = await prisma.sharedFolder.findMany({
    where: {
      id: { in: folderIds },
      categoryId,
      parentId: currentFolderId,
    },
    include: {
      _count: {
        select: {
          children: true,
          files: true,
        },
      },
    },
  });

  if (folders.length !== folderIds.length) {
    return { error: "部分文件夹不存在，或已经不在当前目录里了" };
  }

  if (bulkAction === "MOVE") {
    if (targetParentId) {
      const lineage = await ensureFolderInCategory(targetParentId, categoryId);
      if (!lineage?.length) {
        return { error: "目标目录不存在" };
      }
      if (lineage.some((item) => folderIds.includes(item.id))) {
        return { error: "不能把选中的文件夹移动到它们自己或子目录里" };
      }
    }

    const foldersToMove = folders.filter((folder) => folder.parentId !== targetParentId);
    if (foldersToMove.length === 0) {
      const params = buildSharedFilesParams({
        ...redirectState,
        categoryId,
        folderId: currentFolderId,
        msg: "folder-bulk-move-skipped",
      });
      return { successPath: sharedFilesPath(params.toString(), "folder-list") };
    }

    for (const folder of foldersToMove) {
      try {
        await prisma.sharedFolder.update({
          where: { id: folder.id },
          data: { parentId: targetParentId },
        });
      } catch {
        return { error: `目标目录中已存在同名文件夹：${folder.name}` };
      }
    }

    const skippedCount = folders.length - foldersToMove.length;
    const params = buildSharedFilesParams({
      ...redirectState,
      categoryId,
      folderId: currentFolderId,
      msg: `folder-bulk-moved-${foldersToMove.length}-skipped-${skippedCount}`,
    });
    return { successPath: sharedFilesPath(params.toString(), "folder-list") };
  }

  if (bulkAction === "DELETE_EMPTY") {
    const emptyFolders = folders.filter(
      (folder) => folder._count.children === 0 && folder._count.files === 0,
    );
    if (emptyFolders.length === 0) {
      const params = buildSharedFilesParams({
        ...redirectState,
        categoryId,
        folderId: currentFolderId,
        msg: "folder-bulk-delete-skipped",
      });
      return { successPath: sharedFilesPath(params.toString(), "folder-list") };
    }

    await prisma.sharedFolder.deleteMany({
      where: { id: { in: emptyFolders.map((folder) => folder.id) } },
    });

    const skippedCount = folders.length - emptyFolders.length;
    const params = buildSharedFilesParams({
      ...redirectState,
      categoryId,
      folderId: currentFolderId,
      msg: `folder-bulk-deleted-${emptyFolders.length}-skipped-${skippedCount}`,
    });
    return { successPath: sharedFilesPath(params.toString(), "folder-list") };
  }

  return { error: "不支持的文件夹批量操作" };
}

export async function deleteFolderFromForm(formData: FormData) {
  const redirectState = readSharedFilesRedirectState(formData);
  const folderId = text(formData.get("folderId"));
  const categoryId = text(formData.get("categoryId"));
  const returnFolderId = text(formData.get("returnFolderId"));
  const focusId = text(formData.get("focusId"));

  if (!folderId) {
    return { error: "文件夹不存在" };
  }

  const folder = await getFolderRecord(folderId);
  if (!folder || (categoryId && folder.categoryId !== categoryId)) {
    return { error: "文件夹不存在" };
  }

  const [childCount, fileCount] = await Promise.all([
    prisma.sharedFolder.count({ where: { parentId: folderId } }),
    prisma.sharedFile.count({ where: { folderId } }),
  ]);

  if (childCount > 0 || fileCount > 0) {
    return { error: "只能删除空文件夹" };
  }

  await prisma.sharedFolder.delete({
    where: { id: folderId },
  });

  const params = buildSharedFilesParams({
    ...redirectState,
    categoryId: folder.categoryId,
    folderId: returnFolderId || null,
    msg: "folder-deleted",
  });
  return { successPath: sharedFilesPath(params.toString(), focusId || "file-list") };
}

export async function uploadSharedFileFromForm(formData: FormData, actorId: string) {
  await ensureDefaultFileCategories();

  const redirectState = readSharedFilesRedirectState(formData);
  const categoryId = text(formData.get("categoryId"));
  const folderId = text(formData.get("folderId")) || null;
  const remarks = text(formData.get("remarks")).slice(0, 500);
  const titleInput = text(formData.get("title")).slice(0, 120);
  const file = formData.get("file");

  if (!categoryId) {
    return { error: "请选择分类" };
  }
  if (!(file instanceof File) || !file.size) {
    return { error: "请选择要上传的文件" };
  }

  const category = await prisma.fileCategory.findFirst({
    where: { id: categoryId, isActive: true },
  });
  if (!category) {
    return { error: "分类不存在" };
  }

  let folderLineage: Array<{ id: string; name: string; categoryId: string; parentId: string | null }> = [];
  if (folderId) {
    const lineage = await getFolderLineage(folderId);
    if (!lineage?.length || lineage[lineage.length - 1]?.categoryId !== categoryId) {
      return { error: "目标目录不存在" };
    }
    folderLineage = lineage;
  }

  let stored;
  try {
    stored = await storeSharedFile(
      file,
      category.name,
      folderLineage.map((folder) => folder.name),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "文件上传失败";
    return { error: message };
  }

  const title = titleInput || stored.originalName;

  await prisma.$transaction(async (tx) => {
    const created = await tx.sharedFile.create({
      data: {
        title,
        categoryId,
        folderId,
        filePath: stored.filePath,
        originalFileName: stored.originalName,
        mimeType: stored.mimeType,
        fileSizeBytes: stored.sizeBytes,
        remarks: remarks || null,
        uploadedById: actorId,
      },
    });

    await tx.sharedFileAudit.create({
      data: {
        fileId: created.id,
        actorId,
        action: "UPLOAD",
        note: remarks || null,
        fileTitleSnapshot: created.title,
      },
    });
  });

  const params = buildSharedFilesParams({
    ...redirectState,
    categoryId,
    folderId,
    msg: "uploaded",
  });

  return { successPath: sharedFilesPath(params.toString(), "file-list") };
}

export async function updateSharedFileStatusFromForm(formData: FormData, actor: { id: string; email: string }) {
  const redirectState = readSharedFilesRedirectState(formData);
  const fileId = text(formData.get("fileId"));
  const nextStatus = text(formData.get("nextStatus")).toUpperCase();
  const categoryId = text(formData.get("categoryId"));
  const folderId = text(formData.get("folderId"));

  if (!fileId || !Object.values(SharedFileStatus).includes(nextStatus as SharedFileStatus)) {
    return { error: "无效操作" };
  }

  const row = await prisma.sharedFile.findUnique({
    where: { id: fileId },
    select: { id: true, title: true },
  });
  if (!row) {
    return { error: "文件不存在" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.sharedFile.update({
      where: { id: fileId },
      data: {
        status: nextStatus as SharedFileStatus,
        archivedAt: nextStatus === SharedFileStatus.ARCHIVED ? new Date() : null,
        archivedByEmail:
          nextStatus === SharedFileStatus.ARCHIVED || nextStatus === SharedFileStatus.DELETED
            ? actor.email
            : null,
      },
    });
    await tx.sharedFileAudit.create({
      data: {
        fileId,
        actorId: actor.id,
        action: `STATUS_${nextStatus}`,
        note: row.title,
        fileTitleSnapshot: row.title,
      },
    });
  });

  const params = buildSharedFilesParams({
    ...redirectState,
    categoryId,
    folderId,
    msg: `status-${nextStatus.toLowerCase()}`,
  });

  return {
    successPath: sharedFilesPath(params.toString(), `file-${fileId}`),
  };
}

export async function permanentlyDeleteSharedFileFromForm(formData: FormData, actorId: string) {
  const redirectState = readSharedFilesRedirectState(formData);
  const fileId = text(formData.get("fileId"));
  const categoryId = text(formData.get("categoryId"));
  const folderId = text(formData.get("folderId"));

  if (!fileId) {
    return { error: "文件不存在" };
  }

  const row = await prisma.sharedFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      filePath: true,
      status: true,
      title: true,
    },
  });

  if (!row) {
    return { error: "文件不存在" };
  }

  if (row.status !== SharedFileStatus.DELETED) {
    return { error: "请先标记删除，再执行彻底删除" };
  }

  try {
    await deleteSharedFileObject(row.filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除文件失败";
    return { error: message };
  }

  await prisma.$transaction(async (tx) => {
    await tx.sharedFileAudit.create({
      data: {
        fileId,
        actorId,
        action: "DELETE_PERMANENT",
        note: row.title,
        fileTitleSnapshot: row.title,
      },
    });

    await tx.sharedFile.delete({
      where: { id: fileId },
    });
  });

  const params = buildSharedFilesParams({
    ...redirectState,
    categoryId,
    folderId,
    msg: "deleted-permanently",
  });

  return { successPath: sharedFilesPath(params.toString(), "file-list") };
}

export async function moveSharedFileFromForm(formData: FormData, actorId: string) {
  const redirectState = readSharedFilesRedirectState(formData);
  const fileId = text(formData.get("fileId"));
  const categoryId = text(formData.get("categoryId"));
  const targetFolderId = text(formData.get("targetFolderId")) || null;

  if (!fileId || !categoryId) {
    return { error: "无效操作" };
  }

  const file = await prisma.sharedFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      title: true,
      categoryId: true,
      folderId: true,
      status: true,
    },
  });
  if (!file || file.categoryId !== categoryId) {
    return { error: "文件不存在" };
  }
  if (file.status === SharedFileStatus.DELETED) {
    return { error: "已删除文件不能移动" };
  }

  let targetLabel = "根目录";
  if (targetFolderId) {
    const lineage = await ensureFolderInCategory(targetFolderId, categoryId);
    if (!lineage?.length) {
      return { error: "目标目录不存在" };
    }
    targetLabel = lineage.map((folder) => folder.name).join(" / ");
  }

  if (file.folderId === targetFolderId) {
    const params = buildSharedFilesParams({
      ...redirectState,
      categoryId,
      folderId: targetFolderId,
      msg: "file-move-skipped",
    });
    return { successPath: sharedFilesPath(params.toString(), `file-${fileId}`) };
  }

  await prisma.$transaction(async (tx) => {
    await tx.sharedFile.update({
      where: { id: fileId },
      data: { folderId: targetFolderId },
    });
    await tx.sharedFileAudit.create({
      data: {
        fileId,
        actorId,
        action: "MOVE",
        note: targetLabel,
        fileTitleSnapshot: file.title,
      },
    });
  });

  const params = buildSharedFilesParams({
    ...redirectState,
    categoryId,
    folderId: targetFolderId,
    msg: "file-moved",
  });
  return { successPath: sharedFilesPath(params.toString(), `file-${fileId}`) };
}

export async function applyBulkSharedFileActionFromForm(
  formData: FormData,
  actor: { id: string; email: string },
) {
  const redirectState = readSharedFilesRedirectState(formData);
  const categoryId = text(formData.get("categoryId"));
  const currentFolderId = text(formData.get("folderId")) || null;
  const bulkAction = text(formData.get("bulkAction")).toUpperCase();
  const targetFolderId = text(formData.get("targetFolderId")) || null;
  const fileIds = Array.from(
    new Set(
      formData
        .getAll("fileIds")
        .map((entry) => text(entry))
        .filter(Boolean),
    ),
  );

  if (!categoryId || fileIds.length === 0) {
    return { error: "请先选择要处理的文件" };
  }

  const files = await prisma.sharedFile.findMany({
    where: {
      id: { in: fileIds },
      categoryId,
    },
    select: {
      id: true,
      title: true,
      folderId: true,
      status: true,
    },
  });

  if (files.length !== fileIds.length) {
    return { error: "部分文件不存在或已不在当前分类中" };
  }

  if (bulkAction === "MOVE") {
    if (files.some((file) => file.status === SharedFileStatus.DELETED)) {
      return { error: "已删除文件不能批量移动" };
    }

    let targetLabel = "根目录";
    if (targetFolderId) {
      const lineage = await ensureFolderInCategory(targetFolderId, categoryId);
      if (!lineage?.length) {
        return { error: "目标目录不存在" };
      }
      targetLabel = lineage.map((folder) => folder.name).join(" / ");
    }

    const filesToMove = files.filter((file) => file.folderId !== targetFolderId);
    if (filesToMove.length === 0) {
      const params = buildSharedFilesParams({
        ...redirectState,
        categoryId,
        folderId: targetFolderId,
        msg: "file-bulk-move-skipped",
      });
      return { successPath: sharedFilesPath(params.toString(), "file-list") };
    }

    await prisma.$transaction(async (tx) => {
      for (const file of filesToMove) {
        await tx.sharedFile.update({
          where: { id: file.id },
          data: { folderId: targetFolderId },
        });
      }

      await tx.sharedFileAudit.createMany({
        data: filesToMove.map((file) => ({
          fileId: file.id,
          actorId: actor.id,
          action: "MOVE_BULK",
          note: targetLabel,
          fileTitleSnapshot: file.title,
        })),
      });
    });

    const params = buildSharedFilesParams({
      ...redirectState,
      categoryId,
      folderId: targetFolderId,
      msg: `file-bulk-moved-${filesToMove.length}`,
    });
    return { successPath: sharedFilesPath(params.toString(), "file-list") };
  }

  if (bulkAction === "ARCHIVE" || bulkAction === "DELETE" || bulkAction === "RESTORE") {
    const nextStatus =
      bulkAction === "ARCHIVE"
        ? SharedFileStatus.ARCHIVED
        : bulkAction === "DELETE"
          ? SharedFileStatus.DELETED
          : SharedFileStatus.ACTIVE;
    const filesToUpdate = files.filter((file) => {
      if (bulkAction === "ARCHIVE") {
        return file.status !== SharedFileStatus.ARCHIVED && file.status !== SharedFileStatus.DELETED;
      }
      if (bulkAction === "DELETE") {
        return file.status !== SharedFileStatus.DELETED;
      }
      return file.status !== SharedFileStatus.ACTIVE;
    });

    if (filesToUpdate.length === 0) {
      const params = buildSharedFilesParams({
        ...redirectState,
        categoryId,
        folderId: currentFolderId,
        msg:
          bulkAction === "ARCHIVE"
            ? "file-bulk-archive-skipped"
            : bulkAction === "DELETE"
              ? "file-bulk-delete-skipped"
              : "file-bulk-restore-skipped",
      });
      return { successPath: sharedFilesPath(params.toString(), "file-list") };
    }

    await prisma.$transaction(async (tx) => {
      for (const file of filesToUpdate) {
        await tx.sharedFile.update({
          where: { id: file.id },
          data: {
            status: nextStatus,
            archivedAt: nextStatus === SharedFileStatus.ARCHIVED ? new Date() : null,
            archivedByEmail:
              nextStatus === SharedFileStatus.ARCHIVED || nextStatus === SharedFileStatus.DELETED
                ? actor.email
                : null,
          },
        });
      }

      await tx.sharedFileAudit.createMany({
        data: filesToUpdate.map((file) => ({
          fileId: file.id,
          actorId: actor.id,
          action: `STATUS_${nextStatus}_BULK`,
          note: file.title,
          fileTitleSnapshot: file.title,
        })),
      });
    });

    const params = buildSharedFilesParams({
      ...redirectState,
      categoryId,
      folderId: currentFolderId,
      msg:
        bulkAction === "ARCHIVE"
          ? `file-bulk-archived-${filesToUpdate.length}`
          : bulkAction === "DELETE"
            ? `file-bulk-deleted-${filesToUpdate.length}`
            : `file-bulk-restored-${filesToUpdate.length}`,
    });
    return { successPath: sharedFilesPath(params.toString(), "file-list") };
  }

  return { error: "不支持的批量操作" };
}

export async function renameSharedFileFromForm(formData: FormData, actorId: string) {
  const redirectState = readSharedFilesRedirectState(formData);
  const fileId = text(formData.get("fileId"));
  const categoryId = text(formData.get("categoryId"));
  const folderId = text(formData.get("folderId")) || null;
  const nextTitle = text(formData.get("title")).slice(0, 120);

  if (!fileId || !categoryId || !nextTitle) {
    return { error: "文件标题不能为空" };
  }

  const file = await prisma.sharedFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      title: true,
      categoryId: true,
      folderId: true,
      status: true,
    },
  });

  if (!file || file.categoryId !== categoryId) {
    return { error: "文件不存在" };
  }
  if (file.status === SharedFileStatus.DELETED) {
    return { error: "已删除文件不能重命名" };
  }

  if (file.title === nextTitle) {
    const params = buildSharedFilesParams({
      ...redirectState,
      categoryId,
      folderId,
      msg: "file-rename-skipped",
    });
    return { successPath: sharedFilesPath(params.toString(), `file-${fileId}`) };
  }

  await prisma.$transaction(async (tx) => {
    await tx.sharedFile.update({
      where: { id: fileId },
      data: { title: nextTitle },
    });
    await tx.sharedFileAudit.create({
      data: {
        fileId,
        actorId,
        action: "RENAME",
        note: nextTitle,
        fileTitleSnapshot: nextTitle,
      },
    });
  });

  const params = buildSharedFilesParams({
    ...redirectState,
    categoryId,
    folderId,
    msg: "file-renamed",
  });
  return { successPath: sharedFilesPath(params.toString(), `file-${fileId}`) };
}
