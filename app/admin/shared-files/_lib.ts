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

function buildSharedFilesParams(input: {
  categoryId?: string | null;
  folderId?: string | null;
  msg: string;
}) {
  const params = new URLSearchParams();
  if (input.categoryId) params.set("categoryId", input.categoryId);
  if (input.folderId) params.set("folderId", input.folderId);
  params.set("msg", input.msg);
  return params;
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

  return { successPath: sharedFilesPath("msg=category-created", "category-form") };
}

export async function createFolderFromForm(formData: FormData) {
  await ensureDefaultFileCategories();

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

    const query = `categoryId=${enc(categoryId)}&folderId=${enc(created.id)}&msg=folder-created`;
    return { successPath: sharedFilesPath(query, `folder-${created.id}`) };
  } catch {
    return { error: "同一目录下已存在同名文件夹" };
  }
}

export async function renameFolderFromForm(formData: FormData) {
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
    const params = new URLSearchParams();
    params.set("categoryId", folder.categoryId);
    if (returnFolderId) params.set("folderId", returnFolderId);
    params.set("msg", "folder-rename-skipped");
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

  const params = new URLSearchParams();
  params.set("categoryId", folder.categoryId);
  if (returnFolderId) {
    params.set("folderId", returnFolderId);
  } else if (folderId) {
    params.set("folderId", folderId);
  }
  params.set("msg", "folder-renamed");
  return { successPath: sharedFilesPath(params.toString(), focusId || `folder-${folderId}`) };
}

export async function moveFolderFromForm(formData: FormData) {
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
    categoryId,
    folderId,
    msg: "folder-moved",
  });
  return { successPath: sharedFilesPath(params.toString(), "current-folder-admin") };
}

export async function deleteFolderFromForm(formData: FormData) {
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

  const params = new URLSearchParams();
  params.set("categoryId", folder.categoryId);
  if (returnFolderId) params.set("folderId", returnFolderId);
  params.set("msg", "folder-deleted");
  return { successPath: sharedFilesPath(params.toString(), focusId || "file-list") };
}

export async function uploadSharedFileFromForm(formData: FormData, actorId: string) {
  await ensureDefaultFileCategories();

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

  const params = new URLSearchParams();
  params.set("categoryId", categoryId);
  if (folderId) params.set("folderId", folderId);
  params.set("msg", "uploaded");

  return { successPath: sharedFilesPath(params.toString(), "file-list") };
}

export async function updateSharedFileStatusFromForm(formData: FormData, actor: { id: string; email: string }) {
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

  const params = new URLSearchParams();
  if (categoryId) params.set("categoryId", categoryId);
  if (folderId) params.set("folderId", folderId);
  params.set("msg", `status-${nextStatus.toLowerCase()}`);

  return {
    successPath: sharedFilesPath(params.toString(), `file-${fileId}`),
  };
}

export async function permanentlyDeleteSharedFileFromForm(formData: FormData, actorId: string) {
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

  const params = new URLSearchParams();
  if (categoryId) params.set("categoryId", categoryId);
  if (folderId) params.set("folderId", folderId);
  params.set("msg", "deleted-permanently");

  return { successPath: sharedFilesPath(params.toString(), "file-list") };
}

export async function moveSharedFileFromForm(formData: FormData, actorId: string) {
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
    const params = new URLSearchParams();
    params.set("categoryId", categoryId);
    if (targetFolderId) params.set("folderId", targetFolderId);
    params.set("msg", "file-move-skipped");
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

  const params = new URLSearchParams();
  params.set("categoryId", categoryId);
  if (targetFolderId) params.set("folderId", targetFolderId);
  params.set("msg", "file-moved");
  return { successPath: sharedFilesPath(params.toString(), `file-${fileId}`) };
}

export async function renameSharedFileFromForm(formData: FormData, actorId: string) {
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
    categoryId,
    folderId,
    msg: "file-renamed",
  });
  return { successPath: sharedFilesPath(params.toString(), `file-${fileId}`) };
}
