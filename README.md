# Banquet Management System

Production-focused monorepo scaffold for restaurant banquet event administration.

## Tech Stack

- Backend: Node.js, Express, Prisma, Zod
- Frontend: React, Vite, React Query, Zustand
- Export: PDFKit, ExcelJS

## Run Locally

1. Install dependencies
   - `npm install`
2. Copy env for API
   - `cp apps/api/.env.example apps/api/.env`
3. Generate Prisma client and migrate
   - `npm run prisma:generate -w @banquet/api`
   - `npm run prisma:migrate -w @banquet/api`
4. Start apps
   - `npm run dev`
