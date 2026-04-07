-- AlterTable
ALTER TABLE "SharedFileAudit"
ADD COLUMN "fileTitleSnapshot" TEXT,
ALTER COLUMN "fileId" DROP NOT NULL;

-- Backfill
UPDATE "SharedFileAudit" AS audit
SET "fileTitleSnapshot" = file."title"
FROM "SharedFile" AS file
WHERE audit."fileId" = file."id"
  AND audit."fileTitleSnapshot" IS NULL;

-- DropForeignKey
ALTER TABLE "SharedFileAudit" DROP CONSTRAINT "SharedFileAudit_fileId_fkey";

-- AddForeignKey
ALTER TABLE "SharedFileAudit"
ADD CONSTRAINT "SharedFileAudit_fileId_fkey"
FOREIGN KEY ("fileId") REFERENCES "SharedFile"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
