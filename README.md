# OPEN_TA

OPEN_TA is a web application for thematic analysis with desktop and mobile coding workflows.

## Monorepo layout

- apps/web: Next.js frontend (landing, auth, projects, documents, thematic analysis, data view, import/export skeletons)
- apps/api: NestJS backend (auth, projects, documents, codes, themes, codings stubs)
- packages/shared: shared DTO contracts and schemas

## Quick start

1. Install Node.js 20+ and pnpm 9+.
2. Copy `.env.example` to `.env`.
3. Start database:
   - `docker compose up -d`
4. Install dependencies:
   - `pnpm install`
5. Generate Prisma client and migrate:
   - `pnpm --filter @open-ta/api prisma:generate`
   - `pnpm --filter @open-ta/api prisma:migrate`
6. Run apps:
   - `pnpm dev`

## API docs

After starting API, Swagger should be at:

- http://localhost:4000/api/docs

## Current implementation status

- Bootstrap complete for Day 1 architecture.
- API endpoints are scaffolded with validation DTOs.
- Prisma schema reflects projects, documents, codings, codes, and layer-1 themes.
- TXT parser is implemented; PDF/DOCX parser interfaces are ready.
- Frontend routes and responsive shell are scaffolded.

## Next implementation steps

1. Wire real database services into API controllers.
2. Replace auth placeholder with user persistence and refresh token flow.
3. Implement file upload endpoints and PDF/DOCX parsing adapters.
4. Connect frontend forms and coding interactions to API.
5. Implement CSV/XLSX export pipeline.
