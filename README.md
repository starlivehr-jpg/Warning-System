# STAR LIVE ONLINE — Warning System

ระบบบริหารจัดการหนังสือเตือนพนักงาน (HR Warning Management System)

## Technology
- React + TypeScript + Vite
- Supabase Auth + PostgreSQL + Row Level Security (RLS)
- Cloudflare Pages/Workers สำหรับ hosting (ขั้นตอน deploy แยกจากการสร้าง source code)

## Current status
This repository is the clean starting point for the application. No production database, credentials, employee records, or sample personal data are included.

## Requirements
- Node.js 20+
- npm 10+
- A dedicated Supabase project for Warning System (do not reuse the Job Application database)

## Local setup
1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the dedicated Warning System Supabase project.
3. Run `npm install`.
4. Run `npm run dev`.

## Database
Apply SQL migrations in `supabase/migrations` to the dedicated Warning System project only after the project has been selected and approved.

## Security principles
- RLS is required for all HR data.
- Never put service-role keys or database passwords in frontend environment variables.
- Do not commit real employee data, warning letters, evidence, or secrets.
- All sensitive actions must be attributable to an authenticated user.
