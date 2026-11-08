# KFU data source

## LEMON-040 & LEMON-041: Simplified Catalog Status & Bilingual Localization Audit (2026-11-08)

| Item | Status | Verified Evidence |
| --- | --- | --- |
| Minimal Student-Focused Status UI | PASS | Cluttered developer-facing metadata (last attempted check, worker architecture, internal policies, duplicated timestamps) removed from public UI. Replaced with clean, compact status strip featuring localized heading ("شعب كلية إدارة الأعمال" / "Business Course Catalog"), freshness badge (Updated / Outdated), student category (Male / Female), course/section counts, single relative timestamp since last published snapshot, and unobtrusive seat verification note. |
| 100% Bilingual English Course Mapping | PASS | Audited all 192 unique courses across male and female catalogs. Expanded `VERIFIED_ENGLISH_COURSE_TITLES` in `src/lib/i18n/course-titles.ts` to cover 100% (192/192) of unique business college courses with academic English translations. |
| Bidirectional Search Compatibility | PASS | `src/lib/explorer-filters.ts` includes both Arabic and verified English titles in the search haystack, enabling seamless search in either language without requiring UI language switching. |
| Verification Test Suite | PASS | 7 dedicated tests in `src/lib/i18n/localization-audit.test.ts` verifying 100% course mapping, composite ID normalization, bidi isolation, export canvas rendering, and search symmetry. Full test suite: **39 files, 284 passed, 0 failed**. |
| Production Release & Rollback | PASS | Deployed to production at `https://yourcampuspallemon.netlify.app` (Deploy ID: `6af095fad6a293be1e1348e5`). Verified live endpoints `/api/kfu/status`, `/api/kfu/snapshot?category=11`, and `/api/kfu/snapshot?category=12`. Rollback targets preserved: `6af08e2c0365206f6d192121` and `6af08a32d23ada93bbf6fd79`. |

---

## LEMON-039H Targeted Post-Launch Hardening (2026-11-08)

| Item | Status | Verified Evidence |
| --- | --- | --- |
| Serverless Replay Prevention | PASS | Durable atomic nonce claims using Netlify Blobs (`claimNonce`) replace volatile process memory. Reject concurrent identical nonces across separate serverless instances within the 5-minute window. |
| Strongly Consistent Single Pointer | PASS | Atomic active-version pointer (`active:pointer`) couples male and female datasets to one unified version (`v_1794150041251`), preventing dataset skew and split-brain reads across client requests. |
| Deploy Preview Isolation | PASS | `resolveBlobsStoreName()` routes preview writes to `kfu-snapshots-deploy-preview`, leaving production store `kfu-snapshots` strictly untouched. |
| Worker Secret Protection at Rest | PASS | Ingestion secret stored in `%LOCALAPPDATA%\lemon-worker\config.json`. Audited via `icacls`: restricted to the owner account, `BUILTIN\Administrators`, and `SYSTEM`. Zero plaintext secrets in git or scripts. |
| Concurrency & Adversarial Tests | PASS | 16 dedicated hardening tests passing in `src/lib/kfu-monitor/windows-worker.test.ts`. Full test suite: **38 files, 277 passed, 0 failed**. |
| Live Production Ingestion | PASS | Live Windows worker executed via Task Scheduler (`manage-kfu-task.ps1 run`) completed with exit code `0`. Production endpoint `/api/kfu/status` reports `activeVersion: "v_1794150041251"`, male 164 courses / 389 sections, female 168 courses / 540 sections. |

---

## LEMON-039 Windows-Based Automated Refresh & Secure Ingestion (2026-11-08)

| Item | Status | Verified Evidence |
| --- | --- | --- |
| Architecture | OPERATIONAL | Windows host acts as the data-fetching worker (`scripts/kfu-worker.ts`), fetching both male and female course listings via domestic network egress and publishing to Netlify backend via authenticated HTTPS endpoint (`/api/kfu/ingest`). Zero additional subscription or hosting costs. |
| Local Windows Access | PASS | Both official KFU endpoints succeed from Windows host: Male: 164 courses / 389 sections (1,223,315 bytes, HTTP 200); Female: 168 courses / 540 sections (1,760,609 bytes, HTTP 200). Clean Banner tables, no SharePoint redirection. |
| Ingestion Security | PASS | Dedicated `KFU_INGESTION_SECRET` authentication, HMAC-SHA256 signature verification over `${timestamp}:${nonce}:${rawBody}`, 5-minute replay window, duplicate nonce tracking, 15MB payload size protection, and strict schema validation. Secret stored in protected Windows user profile (`%LOCALAPPDATA%\lemon-worker\config.json`). |
| Atomic Publishing & Storage | PASS | Netlify Blobs (`kfu-snapshots`) stores immutable versioned snapshots (`version:${version}:${category}`), read-back verification before pointer swap, atomic active pointer update (`active:11`, `active:12`, `metadata`), and rollback preservation (`previous:11`, `previous:12`). |
| Windows Scheduled Task | ACTIVE (Ready) | Task `LEMON - KFU Hourly Refresh` registered in standard Windows user context without elevated Administrator privileges. Runs every 60 minutes (`RepetitionInterval: 1 hour`). Live execution verified with exit code `0` (`SCHED_S_TASK_SUCCESS`). |
| Live Production Verification | PASS | Live production site `https://yourcampuspallemon.netlify.app` updated and verified: `/api/kfu/status` reports `refreshSource: "windows_worker"` with active version `v_1794149047593`, `maleCourseCount: 164`, `femaleCourseCount: 168`. Client UI consumes new snapshots without rebuilds. |

---

## LEMON-038 Automated Refresh & Network Perimeter Findings (2026-11-08)

| Item | Status | Verified Evidence |
| --- | --- | --- |
| Owner Authorization | CONFIRMED | Explicit owner attestation confirming full university authorization for automated collection and republication (`LEMON-038`). |
| Refresh Architecture | IMPLEMENTED & VERIFIED | End-to-end `FETCH → PARSE → VALIDATE → COMPARE → STAGE → ATOMIC PUBLISH → VERIFY` pipeline in `src/lib/kfu-monitor/`. Full Vitest suite: 12/12 dedicated test scenarios passing. |
| Durable Snapshot Storage | OPERATIONAL (Netlify Blobs) | Netlify Blobs store `kfu-snapshots` is live and verified in the real deployed environment (`6af0840998ea5ae1123b5bd1`). Active keys (`active:11`, `active:12`, `metadata`) store and serve male (164 courses / 389 sections) and female (168 courses / 540 sections) data without full Next.js rebuilds. |
| Defensive Snapshot Guardrails | PROVEN ACTIVE | When upstream sources return incomplete, malformed, or 0-course data, the validator rejects the candidate, aborts staging, preserves the last-known-good snapshot (`preservedPreviousSnapshot: true`), and refuses to corrupt durable storage. |
| Cloud Datacenter Upstream Fetch | BLOCKED BY KFU WAF | Invocations originating from AWS Lambda / Netlify infrastructure (US datacenter IPs) to `ssb-ar.kfu.edu.sa` are redirected by KFU's perimeter WAF to the public SharePoint homepage (`title: "الصفحة الرئيسية  - جامعة الملك فيصل"`, 101,849 bytes). LEMON's guardrails detect this redirection and reject publication. |
| Hourly Scheduled Function | CONFIGURED / DISABLED | `@hourly` configured in `netlify.toml` with `kfu-monitor.ts`. Automated hourly requests remain blocked until a domestic Saudi egress proxy or official university direct API endpoint is routed. Production remains safe and protected. |

---

## LEMON-037 launch gate (2026-11-08)

| Question | Status | Evidence |
| --- | --- | --- |
| Display of the bundled public course-listing snapshot | APPROVED BY OWNER / DOCUMENTARY SCOPE NOT REVIEWED | The owner reports KFU approval for access to publicly accessible course listings. No written approval artifact was present in the repository, so this review cannot expand that statement beyond the currently bundled snapshot. |
| Recurring automated requests | BLOCKED | No evidence reviewed here explicitly authorizes hourly polling or republishes a refreshed feed. Public HTML and robots behavior are not permission. |
| Scheduled refresh | INACTIVE | `netlify.toml` declares `@hourly`, but `KFU_MONITOR_CRON_ENABLED` is unset in inspected Netlify production/deploy-preview/dev scopes. The function returns 403 before fetching while unset. Actual interval: none. |
| Last real successful automated refresh/publication | NONE VERIFIED | The monitor validates candidates only and has no publisher. It accurately returns `snapshotPublished: false`; no successful scheduled invocation or atomic publication was observed. |
| Bundled snapshots | PASS (offline validation) | Male snapshot: imported `2026-11-07T18:03:12.960Z`, 164 courses/389 sections. Female snapshot: imported `2026-11-07T20:39:46.576Z`, 168 courses/540 sections. These timestamps are import evidence, not live freshness claims. |

Recurring activation requires a written scope covering automated frequency and republication, plus an approved atomic publisher/rollback design and a witnessed scheduled invocation. Until then, no recurring external request is authorized.

Inspection date: **2026-11-07** (Asia/Riyadh).

## Official endpoint

LEMON's snapshot was obtained with one ordinary, unauthenticated GET request to:

`https://ssb-ar.kfu.edu.sa/PROD_ar/ws?p_trm_code=144820&p_col_code=06&p_sex_code=11`

The response was HTTP 200, server-rendered HTML, 1,247,938 bytes, with no redirect or login. The importer makes one request with a descriptive user agent and does not crawl or poll the service.

## Verified parameter meanings

The meanings below are verified from KFU's own schedule selector, not inferred from the digits:

- `144820`: academic year `1448` plus KFU semester selector value `20`, labelled **the second semester** (`الفصل الدراسي الثاني`).
- `06`: **College of Business Administration** (`إدارة الأعمال`).
- `11`: **male students** (`طلاب`). The same official selector labels `12` as `طالبات`.

Official evidence:

- [KFU registration page](https://www.kfu.edu.sa/ar/Deans/AdmissionRecordsDeanship/Documents/acadPlan/registeration.html?trg=regPlan) links to the schedule selector with year 1448 and semester value 10, labelled first semester.
- [KFU schedule selector](https://www.kfu.edu.sa/ar/Deans/AdmissionRecordsDeanship/Documents/acadPlan/studyTables.html?cry=1448&sm=20) defines semester values 10/20 and labels, includes college code 06, labels category 11 as male students, and constructs the source term by concatenating the year and semester value.

## Normalization

Repeated source rows with the same CRN are grouped into one section with multiple meeting blocks. The importer preserves CRN, course code and Arabic name, credits, section code, source availability state, instructor when supplied, activity, prerequisites/restrictions, meeting days, and start/end minutes.

The inspected output does not expose classroom, capacity, remaining seats, or a registration guarantee. Availability is therefore displayed as a snapshot-only source label. Three sections (`53210`, `57230`, `57231`) have no published meeting day/time; they are retained and explicitly shown as missing a source meeting rather than being fabricated or discarded.

## Access constraints

- `https://ssb-ar.kfu.edu.sa/robots.txt` returned 404 on the inspection date.
- KFU's main `robots.txt` does not disallow the public schedule-selector path, but that is not affirmative permission to automate the SSB endpoint.
- KFU's published [Information Security Framework and Policy](https://www.kfu.edu.sa/ar/Deans/it/DocLib3/Information-Security-Framework-and-Policy.pdf) describes portal use as personal use and prohibits misuse. No explicit permission for automated collection was found.

Accordingly, imports remain manual, one-shot, and reviewable. A public-beta operator should obtain written permission or an approved feed before establishing recurring automated imports. No access restriction was bypassed.

## Reproducibility

Run `npx tsx scripts/validate-kfu-snapshot.ts` to fetch the official HTML once, parse it independently of the production importer, compare every CRN and normalized field, and regenerate `data/validation-evidence.json`.
