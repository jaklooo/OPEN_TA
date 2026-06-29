CREATE TABLE IF NOT EXISTS "ThemeReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemeReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ThemeReport_themeId_key" ON "ThemeReport"("themeId");
CREATE INDEX IF NOT EXISTS "ThemeReport_projectId_idx" ON "ThemeReport"("projectId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ThemeReport_projectId_fkey'
  ) THEN
    ALTER TABLE "ThemeReport" ADD CONSTRAINT "ThemeReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ThemeReport_themeId_fkey'
  ) THEN
    ALTER TABLE "ThemeReport" ADD CONSTRAINT "ThemeReport_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
