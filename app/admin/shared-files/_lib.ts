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

  return { successQuery: "msg=category-created" };
}

export async function uploadSharedFileFromForm(formData: FormData, actorId: string) {
  await ensureDefaultFileCategories();

  const categoryId = text(formData.get("categoryId"));
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

  let stored;
  try {
    stored = await storeSharedFile(file, category.name);
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
      },
    });
  });

  return { successQuery: "msg=uploaded" };
}

export async function updateSharedFileStatusFromForm(formData: FormData, actor: { id: string; email: string }) {
  const fileId = text(formData.get("fileId"));
  const nextStatus = text(formData.get("nextStatus")).toUpperCase();

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
      },
    });
  });

  return {
    successQuery: `msg=${enc(`status-${nextStatus.toLowerCase()}`)}`,
  };
}

export async function permanentlyDeleteSharedFileFromForm(formData: FormData) {
  const fileId = text(formData.get("fileId"));
  if (!fileId) {
    return { error: "文件不存在" };
  }

  const row = await prisma.sharedFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      title: true,
      filePath: true,
      status: true,
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

  await prisma.sharedFile.delete({
    where: { id: fileId },
  });

  return { successQuery: "msg=deleted-permanently" };
}
