# LEMON · Your Campus Pal

LEMON is an independent bilingual campus-planning app currently dedicated exclusively to students of the College of Business Administration at King Faisal University. It helps students explore published business-course offerings, compare timetable options, generate conflict-free schedules, calculate GPA on KFU's 5.0 scale, and back up or restore local plans.

Live site: https://yourcampuspallemon.netlify.app

LEMON is not a registration system and is not affiliated with or endorsed by King Faisal University.

## Features

- Male and female course catalogs with CRNs, sections, filters, and meeting details
- Multiple locally saved timetable plans with conflict detection
- Auto Schedule generation and ranking
- KFU 5.0 GPA calculator with plan import
- JSON backup/restore and PDF/PNG timetable export
- Arabic/English, RTL/LTR, light/dark/system themes, and responsive layouts

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zod, Vitest, Netlify Functions/Blobs, and optional Supabase account infrastructure.

## Local setup

Requirements: Node.js 22 and npm.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. The default configuration is guest-only and requires no credentials. Copy `.env.example` to `.env.local` only when you need to override the documented placeholders.

Run the complete local quality gate with:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Environment variables

See [`.env.example`](.env.example) for the complete placeholder-only template.

- `NEXT_PUBLIC_GUEST_ONLY_MODE=true` keeps public account and cloud-sync features disabled.
- Supabase public settings are optional and must only be enabled after the documented OAuth/RLS release gates pass.
- Service-role, ingestion, cron, and worker signing secrets are server-only. Never prefix them with `NEXT_PUBLIC_` or commit them.
- Private Windows worker configuration, logs, locks, and credentials live outside this repository.

## Privacy and data

The public site currently runs in guest-only mode. Plans, preferences, and GPA drafts are stored in the student's browser profile and are not uploaded. Browser-local storage is not cryptographic isolation between people who share the same browser profile. Clearing site data or changing devices removes local plans unless the student exports a backup.

Course data is limited to the KFU College of Business Administration and is derived from publicly accessible KFU course listings under the owner's stated authorization for automated collection and republication. Snapshots can become stale and never guarantee a seat or successful registration; students must verify availability in KFU's official systems. See [DATA_SOURCE.md](docs/DATA_SOURCE.md) for provenance, freshness, and operational evidence.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes. Report security issues privately using [SECURITY.md](SECURITY.md); do not open a public vulnerability issue.

LEMON's application source code is available under the [MIT License](LICENSE). KFU course data and other third-party material are excluded from that grant; see [DATA_LICENSE.md](DATA_LICENSE.md).

