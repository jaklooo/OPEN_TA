# OPEN_TA

OPEN_TA is a web application for qualitative coding and thematic analysis. It supports document upload, text coding, theme layering, data review, and CSV/XLSX export.

## Features

- Project-based document library
- Paste, TXT, DOCX, and PDF document ingestion
- Desktop and mobile-friendly coding workflow
- Text selection coding with reusable code names and descriptions
- Colored coding highlights by code
- Code editing and deletion
- Document-level and global thematic analysis
- Multi-layer theme building
- Data view for document and project-level codes/themes
- CSV and XLSX export of coding results

## Monorepo Layout

- `apps/web` - Next.js frontend
- `apps/api` - NestJS API
- `packages/shared` - shared package placeholder for future contracts/utilities

## Requirements

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+

## Local Setup

Install dependencies:

```bash
pnpm install
```

Create environment variables:

```bash
cp .env.example .env
```

Start local Postgres:

```bash
docker compose up -d
```

Generate Prisma client and run migrations:

```bash
pnpm --filter @open-ta/api prisma:generate
pnpm --filter @open-ta/api prisma:migrate:local
```

Start the API and web app:

```bash
pnpm dev
```

Default local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api`
- Swagger docs: `http://localhost:4000/api/docs`

## Environment Variables

API:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_ACCESS_SECRET` - secret for access tokens
- `JWT_REFRESH_SECRET` - secret for refresh tokens
- `CORS_ORIGIN` - comma-separated allowed frontend origins, for example `https://your-app.vercel.app`
- `PORT` - API port, defaults to `4000`
- `HOST` - API host, defaults to `0.0.0.0`

Web:

- `NEXT_PUBLIC_API_URL` - public API base URL, for example `https://your-api.up.railway.app/api`

## Production Notes

In production, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `CORS_ORIGIN` must be set. Do not reuse the placeholder values from `.env.example`.

A recommended deployment shape is:

- `apps/web` on Vercel
- `apps/api` on Railway, Render, Fly.io, or another Node hosting provider
- PostgreSQL on Railway or any managed Postgres provider

## Development Commands

```bash
pnpm --filter @open-ta/web typecheck
pnpm --filter @open-ta/api typecheck
pnpm --filter @open-ta/api prisma:migrate
```

## License

MIT
