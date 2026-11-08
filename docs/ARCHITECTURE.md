# Architecture

LEMON is split into three boundaries:

1. **Acquisition:** `src/lib/kfu-importer.ts` and `scripts/import-kfu.ts` fetch and normalize the public source. The browser does not scrape KFU.
2. **Domain:** Zod schemas in `src/lib/schema.ts` and deterministic schedule rules in `src/lib/schedule.ts` are independent of React.
3. **Presentation:** the Next.js app reads validated snapshot data, while user-created plans stay in browser local storage.

Each course, section, plan, and import carries a term ID. Cross-term additions throw an error. Sections contain zero or more meeting blocks and optional linked-section IDs, instructor, location, capacity, restrictions, and provenance. This supports richer future imports without changing the timetable engine.

Guest mode remains the default: plan data is small, personal, and device-local, and no account or database is required. Imported offering data is a versioned snapshot and contains no private student data.

An optional cloud boundary is prepared but not wired into the UI. `src/lib/cloud/config.ts` validates public Supabase configuration, `src/lib/cloud/schedules.ts` validates plans and plans merge-first local-to-cloud migration, and `supabase/migrations/0001_schedules.sql` defines private, owner-only schedule rows with RLS. Cloud plans use the same domain shape as local plans; offering data stays in the bundled snapshot. See [Auth and private cloud storage](AUTH_AND_STORAGE.md).
