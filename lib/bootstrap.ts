import { prisma } from "@/lib/prisma";

const DEFAULT_FILE_CATEGORIES = [
  { name: "General", sortOrder: 10 },
  { name: "HR", sortOrder: 20 },
  { name: "Finance", sortOrder: 30 },
  { name: "Contracts", sortOrder: 40 },
];

export async function ensureDefaultFileCategories() {
  await prisma.fileCategory.createMany({
    data: DEFAULT_FILE_CATEGORIES,
    skipDuplicates: true,
  });
}
