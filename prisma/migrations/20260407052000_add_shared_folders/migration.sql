-- CreateTable
CREATE TABLE "SharedFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedFolder_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SharedFile"
ADD COLUMN "folderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SharedFolder_categoryId_parentId_name_key" ON "SharedFolder"("categoryId", "parentId", "name");

-- CreateIndex
CREATE INDEX "SharedFolder_categoryId_parentId_createdAt_idx" ON "SharedFolder"("categoryId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "SharedFile_folderId_status_createdAt_idx" ON "SharedFile"("folderId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "SharedFolder" ADD CONSTRAINT "SharedFolder_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FileCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedFolder" ADD CONSTRAINT "SharedFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SharedFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedFile" ADD CONSTRAINT "SharedFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "SharedFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
