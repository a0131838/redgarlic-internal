import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { createSharedFileAccessResponse } from "@/lib/shared-file-storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  await requireEmployee();
  const params = await context.params;

  const file = await prisma.sharedFile.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      filePath: true,
      originalFileName: true,
      mimeType: true,
    },
  });

  if (!file || file.status === "DELETED") {
    return new Response("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";

  return createSharedFileAccessResponse({
    filePath: file.filePath,
    originalFileName: file.originalFileName,
    mimeType: file.mimeType,
    download,
  });
}
