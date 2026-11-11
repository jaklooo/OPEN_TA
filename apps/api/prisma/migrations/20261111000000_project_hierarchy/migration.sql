ALTER TABLE "Project" ADD COLUMN "parentId" TEXT;
CREATE INDEX "Project_parentId_idx" ON "Project"("parentId");
ALTER TABLE "Project" ADD CONSTRAINT "Project_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
