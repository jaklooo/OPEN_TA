ALTER TABLE "Theme" ADD COLUMN IF NOT EXISTS "color" TEXT NOT NULL DEFAULT '#115e59';

CREATE TABLE IF NOT EXISTS "ThemeCoding" (
    "themeId" TEXT NOT NULL,
    "codingId" TEXT NOT NULL,

    CONSTRAINT "ThemeCoding_pkey" PRIMARY KEY ("themeId","codingId")
);

CREATE INDEX IF NOT EXISTS "ThemeCoding_codingId_idx" ON "ThemeCoding"("codingId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ThemeCoding_themeId_fkey'
  ) THEN
    ALTER TABLE "ThemeCoding" ADD CONSTRAINT "ThemeCoding_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ThemeCoding_codingId_fkey'
  ) THEN
    ALTER TABLE "ThemeCoding" ADD CONSTRAINT "ThemeCoding_codingId_fkey" FOREIGN KEY ("codingId") REFERENCES "Coding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
