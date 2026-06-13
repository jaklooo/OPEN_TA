ALTER TABLE "Theme" ADD COLUMN IF NOT EXISTS "documentId" TEXT;

CREATE TABLE IF NOT EXISTS "ThemeTheme" (
    "childThemeId" TEXT NOT NULL,
    "parentThemeId" TEXT NOT NULL,

    CONSTRAINT "ThemeTheme_pkey" PRIMARY KEY ("childThemeId","parentThemeId")
);

CREATE INDEX IF NOT EXISTS "Theme_projectId_documentId_layer_idx" ON "Theme"("projectId", "documentId", "layer");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Theme_documentId_fkey'
  ) THEN
    ALTER TABLE "Theme" ADD CONSTRAINT "Theme_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ThemeTheme_childThemeId_fkey'
  ) THEN
    ALTER TABLE "ThemeTheme" ADD CONSTRAINT "ThemeTheme_childThemeId_fkey" FOREIGN KEY ("childThemeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ThemeTheme_parentThemeId_fkey'
  ) THEN
    ALTER TABLE "ThemeTheme" ADD CONSTRAINT "ThemeTheme_parentThemeId_fkey" FOREIGN KEY ("parentThemeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
