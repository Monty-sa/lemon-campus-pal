# LEMON-045 Public GitHub & Verified Footer Release Gate

**Decision (2026-11-08, Asia/Riyadh): PRODUCTION READY / PUBLISHED.** Preview `6af0b61bce02902698c60467` and Production deployment published.

1. **LEMON-045 (Public GitHub & Student Footer Links)**:
   - Public GitHub Repository: `https://github.com/Monty-sa/lemon-campus-pal` (public, MIT license, College of Business Administration scope).
   - Verified footer links and copy:
     - GitHub URL: `https://github.com/Monty-sa/lemon-campus-pal`
     - Telegram URL: `https://t.me/Muntadar26`
     - Arabic Telegram label: `"تواصل معي"`
     - English Telegram label: `"Contact Me"`
     - Arabic disclaimer: `"جهد طلابي، غير رسمي."`
     - English disclaimer: `"Student effort, not official."`
   - Attributes: `target="_blank" rel="noopener noreferrer"` enforced on all external links.
   - Accessibility: keyboard `:focus-visible` styling, SVG icons marked `aria-hidden="true"`, accessible text and labels.
   - Theme & Responsive: seamless light/dark theme adaptation and mobile flex-wrap.
   - Netlify deployment remains independent of GitHub; no GitHub-to-Netlify webhook/automation activated.

2. **Deployments & Rollback Targets**:
   - Preview: `6af0b61bce02902698c60467` (`https://6af0b61bce02902698c60467--yourcampuspallemon.netlify.app`)
   - Previous rollback targets: `6af0b406fd8b4559f09a240a`, `6af0a8bea32da10e37ca7557`, `6af0a39cbcd450d091c80407`.

## LEMON-045 Evidence Matrix

| Gate | Status | Verified Evidence |
| --- | --- | --- |
| GitHub Repository | PASS | Public repo at `https://github.com/Monty-sa/lemon-campus-pal`, MIT license, verified README. |
| Footer GitHub Link | PASS | Verified `https://github.com/Monty-sa/lemon-campus-pal`, `target="_blank" rel="noopener noreferrer"`. |
| Footer Telegram Link | PASS | Verified `https://t.me/Muntadar26`, `target="_blank" rel="noopener noreferrer"`. |
| Localized Telegram Labels | PASS | `"Contact Me"` (EN) and `"تواصل معي"` (AR) verified in component and deployed bundle. |
| Concise Disclaimers | PASS | `"Student effort, not official."` (EN) and `"جهد طلابي، غير رسمي."` (AR) verified in component and deployed bundle. |
| Automated Tests | PASS | `src/components/footer-links.test.tsx`: 2/2 passed. |
| Types & Lint | PASS | `tsc --noEmit`: 0 errors. `npm run lint`: 0 errors. |
| Packaging & Build | PASS | `npm run build` and `npx netlify build` exited code 0. |
| Rollback Preservation | PRESERVED | Target `6af0b406fd8b4559f09a240a` and `6af0a8bea32da10e37ca7557` preserved. |

---

# LEMON-044 Student Professor Experiences Release Gate

**Decision (2026-11-08, Asia/Riyadh): PRODUCTION LIVE.** Deployment `6af0a8bea32da10e37ca7557` is published at `https://yourcampuspallemon.netlify.app`.

1. **LEMON-044 (Student Professor Experiences)**:
   - Added compact community section near bottom of Browse Sections linking to Telegram community `"دكاترة كلية ادارة الاعمال"` (`https://t.me/+br6ivC0jUog2MTQ0`).
   - Verified Arabic copy:
     - Heading: `"تبي تعرف الدكتور أكثر؟ 👀"`
     - Description: `"شوف تجارب طلاب الكلية وآراءهم عن الدكاترة قبل تختار شعبتك."`
     - Button: `"شوف تجارب الطلاب"`
   - Verified English copy:
     - Heading: `"Want to know more about your professor?"`
     - Description: `"Explore experiences shared by fellow Business students before choosing a section."`
     - Button: `"Explore Student Experiences"`
   - External link security: `target="_blank" rel="noopener noreferrer"`.
   - Subtle community link in section disclosure details and `CourseDetailsModal` next to instructor name.
   - Independent student community disclaimer prominently displayed (`مجتمع طلابي مستقل ولا يعتبر تقييماً رسمياً أو معتمداً من جامعة الملك فيصل` / `Independent student community · Not officially affiliated with or endorsed by KFU`).
   - Verified zero fabrication of reviews, zero Telegram API dependencies, full RTL/LTR responsiveness, dark/light theme integration.

2. **Deployments & Rollback Targets**:
   - Production: `6af0a8bea32da10e37ca7557` (`https://yourcampuspallemon.netlify.app`)
   - Preview: `6af0a611193c34155dbc6f16` (`https://6af0a611193c34155dbc6f16--yourcampuspallemon.netlify.app`)
   - Production rollback targets: `6af0a39cbcd450d091c80407` (LEMON-042D), `6af0a07955b356c017877f1b` (LEMON-042B/C), `6af09acb3ce2a6abbea35200` (LEMON-042).

## LEMON-044 Evidence Matrix

| Gate | Status | Verified Evidence |
| --- | --- | --- |
| Telegram Link URL | PASS | Exact URL `https://t.me/+br6ivC0jUog2MTQ0` verified in component DOM and preview deployment bundle (`0uio8f-sioxgm.js`). |
| External Link Security | PASS | All link instances enforce `target="_blank"` and `rel="noopener noreferrer"`. |
| Localized Copy | PASS | Exact Arabic and English copy matches requirements; verified in `dictionary.ts`, tests, and production preview. |
| Subtle Instructor Links | PASS | Rendered in section cards and `CourseDetailsModal` only when instructor is identified. |
| Independent Disclaimer | PASS | Explicit independent student community disclaimer rendered under card description in both AR and EN. |
| Automated Tests | PASS | 43 test files, **305 passed, 0 failed** (`lemon-044-community.test.tsx`: 4/4 passed). |
| Static Analysis & Types | PASS | `npm run lint`: 0 errors. `tsc --noEmit`: 0 errors. |
| Builds & Packaging | PASS | `npm run build` and `npx netlify build` completed with code 0. |
| Rollback Preservation | PRESERVED | Target `6af0a39cbcd450d091c80407` preserved. |

---

# LEMON-042D Data & Privacy Modal UX & Final Timetable Polish Release Gate

**Decision (2026-11-08, Asia/Riyadh): PRODUCTION LIVE.** Deployment `6af0a39cbcd450d091c80407` is published at `https://yourcampuspallemon.netlify.app`.

1. **LEMON-042D (Compact Data & Privacy Modal UX)**:
   - Dialog width constrained to compact `440px` on desktop (`width: min(92vw, 440px)` on mobile) with no artificial min-height.
   - Replaced verbose explanations with one concise description:
     - English: `"Your schedules are saved on this device. Download a backup or restore it on another device."`
     - Arabic: `"جداولك محفوظة على هذا الجهاز. يمكنك حفظ نسخة احتياطية أو استعادتها على جهاز آخر."`
   - Two equal-width primary action buttons side-by-side (`.data-privacy-actions-grid`):
     - **Download Backup** / **حفظ نسخة احتياطية**
     - **Restore Backup** / **استعادة نسخة احتياطية**
   - Natural RTL and LTR alignment for all text, buttons, and summary elements.
   - Removed the large unencrypted warning banner; replaced with an unobtrusive single-line note (`🔒 Backup files are unencrypted text. Keep your backup private.` / `🔒 ملف النسخة غير مشفّر، احرص على حفظه في مكان خاص.`).
   - Collapsed secondary danger section (`<details className="data-privacy-danger-details">`) for "Delete My Data" (`حذف بياناتي`), preserving explicit confirmation before wiping guest storage.
   - Working backup/restore logic preserved: 5MB size limit, schema validation, non-destructive merge default, preview, and replace option.

2. **LEMON Final Timetable Polish**:
   - **Calendar-Event Typography:** Improved readability with slightly larger, clearer font sizes (`b`: `12.5px`, `span`: `11px`, `small`: `10px` with `font-variant-numeric: tabular-nums`). Preserved calendar geometry, positioning, and RTL/LTR layout without text overflow on short blocks.
   - **Compact CRN Section:** Compacted `.summary-strip` beneath timetable to max `680px` width; removed excessive horizontal empty space and redundant vertical labels. Kept selected CRN chips visible and the Copy button accessible.
   - **Verified Copy CRNs:** Guaranteed deduplication of active plan CRNs (`Array.from(new Set(...))`), preserved standard registration-compatible space-separated output format (`uniqueCrns.join(" ")`), and validated copy-success toast feedback.

3. **Deployments & Rollback Targets**:
   - Production: `6af0a39cbcd450d091c80407` (`https://yourcampuspallemon.netlify.app`)
   - Preview: `6af0a35ed87e80f9202ffbfc` (`https://6af0a35ed87e80f9202ffbfc--yourcampuspallemon.netlify.app`)
   - Preserved rollback targets: `6af0a07955b356c017877f1b` (LEMON-042B/C), `6af09acb3ce2a6abbea35200` (LEMON-042), `6af095fad6a293be1e1348e5`.

## LEMON-042D Evidence Matrix

| Gate | Status | Verified Evidence |
| --- | --- | --- |
| Compact Modal UX | PASS | Max-width `440px`, zero empty void, concise one-sentence description, two equal-width primary buttons. |
| Collapsed Danger Zone | PASS | "Delete My Data" moved into collapsed `<details>` away from primary actions, preserving explicit deletion confirmation. |
| RTL & LTR Natural Alignment | PASS | Tested under Arabic RTL and English LTR without misaligned buttons or text direction conflicts. |
| Timetable Event Typography | PASS | Larger crisp fonts (`12.5px` code, `11px` title, `10px` time), tabular numerals, and compact handling for short blocks. |
| Compact CRN Section | PASS | Max width `680px`, inline layout, unique active-plan CRN copying, registration-compatible space separation, and toast feedback. |
| Automated Tests | PASS | 42 test files, **305 passed, 0 failed** (`lemon-042d-polish.test.tsx`: 5/5 passed, `lemon-042b-c.test.tsx`: 8/8 passed, `planner.test.tsx`: 28/28 passed). |
| Static Analysis & Types | PASS | `npm run lint`: 0 errors, 0 warnings. `tsc --noEmit`: 0 errors. |
| Builds & Packaging | PASS | Turbopack `next build` (8 static/dynamic routes) and `npx netlify build` exited with code 0. |
| Live Production Verification | PASS | Live at `https://yourcampuspallemon.netlify.app`. Verified endpoints `/api/kfu/status`, `/api/kfu/snapshot?category=11` (164 courses / 389 sections), `/api/kfu/snapshot?category=12` (168 courses / 540 sections). |
| Rollback Preservation | PRESERVED | `6af0a07955b356c017877f1b`, `6af09acb3ce2a6abbea35200`, and `6af095fad6a293be1e1348e5` preserved. |

---

# LEMON-042B/C Guest Data Backup & Restore & Student Category UX Release Gate

**Decision (2026-11-08, Asia/Riyadh): PRODUCTION LIVE.** Deployment `6af0a07955b356c017877f1b` is published at `https://yourcampuspallemon.netlify.app`. 

1. **LEMON-042B (Guest Data Backup & Restore)**:
   - Completely removed large guest notice banner (`guest-notice-banner` / `guestModeCatalogNotice`) from Browse Sections.
   - Built student-friendly `DataPrivacyModal` accessible via topbar guest badge (`guest-privacy-btn`), footer links, and status modal.
   - "Download Backup" (`حفظ نسخة احتياطية`) and "Restore Backup" (`استعادة نسخة`) with zero exposure of the technical word "JSON" in primary UI.
   - Versioned backup format (`lemon-backup-YYYY-MM-DD.json`, schema v2) with safe backwards compatibility for legacy v1 backups.
   - Non-destructive plan restore (safe merge with collision re-naming and unique client IDs) or complete replace option.
   - Validates JSON structure and strictly enforces 5MB file size limit.
   - Clear disclosure that backup files are unencrypted and should be kept private.
   - Danger zone for "Delete My Data" (`حذف بياناتي`) with explicit confirmation.
2. **LEMON-042C (Student Category & Incomplete Schedule UX)**:
   - Replaced alarmist yellow warning banner with a subtle inline info indicator (`.dataset-warning-hint`) with proper singular and plural translation handling (EN: `"3 sections have incomplete schedule details."` / `"1 section has incomplete schedule details."`; AR: `"٣ شعب معلومات جدولها غير مكتملة."` / `"شعبة واحدة معلومات جدولها غير مكتملة."`).
   - Verified that incomplete schedule sections (TBA sections: CRNs 53210, 57230, 57231 in Male; CRN 64775 in Female) were never omitted from the dataset; retained them in catalog with explicit `"Time TBA"` / `"الوقت غير محدد (TBA)"` badge.
   - Total catalog counts preserved consistently (Male 164 courses / 389 sections, Female 168 courses / 540 sections).
3. **Simplified Status Modal**:
   - Removed the verbose `'Offline & Registration Rush Resilience'` card.
   - Retained concise student-facing statuses: planning engine, local guest storage (with Data & Privacy shortcut), and catalog snapshot freshness.
4. **Deployments & Rollback Targets**:
   - Production: `6af0a07955b356c017877f1b` (`https://yourcampuspallemon.netlify.app`)
   - Preview: `6af0a026b9edf6757ab14711` (`https://6af0a026b9edf6757ab14711--yourcampuspallemon.netlify.app`)
   - Preserved rollback targets: `6af09acb3ce2a6abbea35200` (LEMON-042), `6af095fad6a293be1e1348e5`, `6af08e2c0365206f6d192121`.

## LEMON-042B/C Evidence Matrix

| Gate | Status | Verified Evidence |
| --- | --- | --- |
| Backup & Restore (V2) | PASS | `src/lib/storage.ts`: `createLemonBackup`, `validateBackupFileContent` (<=5MB), `executeRestoreBackup` (non-destructive merge and replace), legacy v1 upgrade. |
| Student-Friendly UI | PASS | `DataPrivacyModal` with "Download Backup" and "Restore Backup". No "JSON" in primary UI. Separate danger zone for deleting local data. |
| Incomplete Schedule Indicator | PASS | Subtle `.dataset-warning-hint` with singular/plural support in English and Arabic. Hidden when 0 affected sections. |
| Catalog TBA Badges | PASS | Sections with 0 meetings retain `"Time TBA"` / `"الوقت غير محدد (TBA)"` badge in card headers, disclosure details, and table view. |
| Status Modal Simplification | PASS | Verbose resilience card removed; compact layout with guest storage Data & Privacy link. |
| Automated Tests | PASS | `vitest`: 41 test files, **300 passed, 0 failed** (`lemon-042b-c.test.tsx` 8/8, `lemon-042.test.tsx` 4/4, `lemon-033.test.tsx` 4/4, `planner.test.tsx` 28/28). |
| Static Analysis & Types | PASS | `npm run lint`: 0 errors, 0 warnings. `tsc --noEmit`: 0 errors. |
| Build & Packaging | PASS | `npm run build` (Turbopack) and `npx netlify build` exited 0. |
| Live Production Verification | PASS | Deployed `6af0a07955b356c017877f1b` live. Endpoints `/api/kfu/status`, `/api/kfu/snapshot?category=11` (164 courses / 389 sections), `/api/kfu/snapshot?category=12` (168 courses / 540 sections) verified healthy. |
| Rollback Preservation | PRESERVED | `6af09acb3ce2a6abbea35200` and `6af095fad6a293be1e1348e5` preserved in Netlify history. |

---

# LEMON-039H Targeted Post-Launch Hardening Release Gate

**Decision (2026-11-08, Asia/Riyadh): PRODUCTION LIVE (HARDENED).** Deployment `6af08e2c0365206f6d192121` is published at `https://yourcampuspallemon.netlify.app`. Serverless replay prevention is hardened with durable atomic nonce claims (`claimNonce`) in Netlify Blobs replacing in-memory state. Male and female datasets are published and read under one strongly consistent active-version pointer (`active:pointer`) with strong read consistency and rollback preservation. Deploy previews are isolated (`resolveBlobsStoreName()`) from the production blob store. The Windows worker secret is protected at rest in `%LOCALAPPDATA%\lemon-worker\config.json`. Concurrency and replay tests pass (38 test files, 277 passed, 0 failed). Live production refresh was triggered via Windows Task Scheduler (`LEMON - KFU Hourly Refresh`) and verified with exit code `0` (`activeVersion: "v_1794150041251"`). Prior production deploys `6af08a32d23ada93bbf6fd79` and `6af0753f303d255f44846425` remain preserved in Netlify deployment history as rollback targets.

## LEMON-039H Hardening Evidence Matrix

| Gate | Status | Verified Evidence |
| --- | --- | --- |
| Serverless Replay Prevention | PASS | Nonce claims use Netlify Blobs (`claimNonce`) with conditional creation (`onlyIfNew: true`). In-memory `seenNonces` removed. Rejects duplicate nonces across multiple serverless Lambda instances. |
| Single Active-Version Pointer | PASS | `active:pointer` points to immutable snapshot versions (`version:${version}:${category}`). `getActiveSnapshot()` resolves category data through the active pointer first with strong consistency, preventing cross-dataset skew or split-brain catalog reads. |
| Deploy Preview Isolation | PASS | `resolveBlobsStoreName()` maps `CONTEXT=deploy-preview` to `kfu-snapshots-deploy-preview`, isolating preview builds and PR branches from the production store `kfu-snapshots`. |
| Protected Windows Worker Secret | PASS | Audited ACL on `%LOCALAPPDATA%\lemon-worker\config.json` via `icacls`: strictly restricted to the owner account, `BUILTIN\Administrators`, and `SYSTEM`. Zero secret plaintext in git, logs, or scripts. |
| Concurrency & Adversarial Tests | PASS | Added tests 13-16 in `windows-worker.test.ts`: concurrent simultaneous replay race (exactly one 200, one 403), atomic pointer consistency, preview store routing, durable nonce rejection. Full test suite: **38 test files, 277/277 passed**, exit 0. |
| Production Release & Live Verification | PASS | Deploy `6af08e2c0365206f6d192121` live at `https://yourcampuspallemon.netlify.app`. Verified endpoints: `/api/kfu/status`, `/api/kfu/snapshot?category=11` (164 courses / 389 sections, `v_1794150041251`), `/api/kfu/snapshot?category=12` (168 courses / 540 sections, `v_1794150041251`). |
| Windows Task Scheduler | ACTIVE (Ready) | Task `LEMON - KFU Hourly Refresh` executed cleanly (Exit code 0). Next run scheduled automatically every 60 minutes. |
| Rollback Preservation | PRESERVED | Deploy `6af08a32d23ada93bbf6fd79` (LEMON-039) and `6af0753f303d255f44846425` (LEMON-037) preserved in Netlify history. |

---

# LEMON-039 Windows-Based Automated KFU Refresh Release Gate

**Decision (2026-11-08, Asia/Riyadh): PRODUCTION LIVE.** Deployment `6af08a32d23ada93bbf6fd79` is published at `https://yourcampuspallemon.netlify.app`. The Windows-based data-fetching worker (`scripts/kfu-worker.ts`) and authenticated ingestion endpoint (`/api/kfu/ingest`) are fully operational, tested (38 test files, 273 passed, 0 failed), and verified in live production. Windows Task Scheduler task `LEMON - KFU Hourly Refresh` is active and running every 60 minutes in user context. The prior production deployment `6af0753f303d255f44846425` remains preserved in Netlify deployment history as the rollback target. Guest-only mode remains enforced (`NEXT_PUBLIC_GUEST_ONLY_MODE=true`).

## LEMON-039 Evidence Matrix

| Gate | Status | Verified Evidence |
| --- | --- | --- |
| Windows Host KFU Fetch | PASS | Male (11): HTTP 200, 164 courses, 389 sections, 1,223,315 bytes; Female (12): HTTP 200, 168 courses, 540 sections, 1,760,609 bytes. Direct Banner table parsing without redirection. |
| Ingestion Security & HMAC | PASS | Tested under unit and live integration tests: HMAC-SHA256 signature verification, 5-minute timestamp replay check, duplicate nonce rejection, and server-side schema/integrity validation. Secret stored in `%LOCALAPPDATA%\lemon-worker\config.json`. |
| Atomic Publishing (Netlify Blobs) | PASS | Immutable versioned snapshots (`version:${version}:${category}`), read-back verification before pointer swap, atomic active pointer update (`active:11`, `active:12`, `metadata`), and rollback preservation (`previous:11`, `previous:12`). |
| Windows Scheduled Task | ACTIVE (Ready) | Task `LEMON - KFU Hourly Refresh` configured for the standard owner account, with no elevated admin privileges, and runs hourly. Execution observed and verified with exit code `0`. Next run scheduled automatically. |
| Live Production Verification | PASS | Deploy `6af08a32d23ada93bbf6fd79` live at `https://yourcampuspallemon.netlify.app`. Verified endpoints: `/api/kfu/status`, `/api/kfu/snapshot?category=11`, `/api/kfu/snapshot?category=12`. |
| Automated Tests & Quality Gates | PASS | `npm test`: **38 files, 273/273 tests**, exit 0. ESLint: 0 errors, 0 warnings. TypeScript: exit 0. Next.js build: Turbopack exit 0. Netlify build: exit 0. |
| Rollback Preservation | PRESERVED | Deploy `6af0753f303d255f44846425` preserved in Netlify history. |

---

# LEMON-038 Automated KFU Data Refresh Release Gate

**Decision (2026-11-08, Asia/Riyadh): RELEASE BLOCKED ON EXTERNAL SOURCE PERIMETER POLICY. PRODUCTION PRESERVED AT 6af0753f303d255f44846425.** 
The complete LEMON-038 hourly refresh architecture, validation suite (12/12 passing), durable storage persistence (Netlify Blobs), dynamic client consumption without full rebuilds, and defensive rollback mechanisms are fully built and verified. However, live execution from deployed Netlify Lambda functions revealed that King Faisal University's Ellucian Banner portal (`ssb-ar.kfu.edu.sa`) actively redirects inbound requests from international cloud datacenter IP ranges (AWS Lambda) to the public SharePoint homepage (`title: "الصفحة الرئيسية  - جامعة الملك فيصل"`, 101,849 bytes). LEMON-038's defensive validator successfully detected this, refused to overwrite the catalog, and preserved the verified baseline. In accordance with safety rules, production is kept unchanged at the known-good rollback release (`6af0753f303d255f44846425`).

## LEMON-038 Evidence Matrix

| Gate | Status | Verified Evidence |
| --- | --- | --- |
| Authorization Record | PASS | Owner explicitly attested full university authorization for automated collection and republication. |
| Test Suite | PASS | `npm test`: **37 test files, 261 passed, 0 failed** (`automated-refresh.test.ts`: 12/12 passed). |
| Static Analysis & Types | PASS | `npm run lint`: 0 errors, 0 warnings. `tsc --noEmit`: 0 errors. |
| Next.js & Netlify Builds | PASS | `npm run build` and `npx netlify build` succeeded cleanly with Turbopack and function bundler. |
| Netlify Blobs Persistence | PASS | Store `kfu-snapshots` is live and operational in deployed Netlify server environment. Deployed endpoint `/api/kfu/snapshot` returned `source: "durable_storage"`. |
| Defensive Snapshot Guardrails | PASS | Live test against deployed endpoint `/api/cron/kfu-refresh` proved that 0-course/redirected responses are rejected, durable storage is protected, and last-known-good snapshots are preserved. |
| Upstream KFU Reachability from Cloud | BLOCKED | KFU's WAF redirects AWS Lambda datacenter IPs away from `ssb-ar.kfu.edu.sa` to the SharePoint homepage. External automation cannot collect live timetable data without a domestic Saudi egress route or official KFU API feed. |
| Production Status | PRESERVED (6af0753f303d255f44846425) | Live production URL `https://yourcampuspallemon.netlify.app` remains safe, guest-only, and operational. |

---

# LEMON-037 Final Security, Stability & Public Launch Gate

**Decision (2026-11-08, Asia/Riyadh): GUEST-ONLY LIVE.** Deployment `6af0753f303d255f44846425` is published at `https://yourcampuspallemon.netlify.app` with site SSO disabled for anonymous guest access. The active-plan reload regression is fixed and verified in the deployed artifact. FULL MODE remains **BLOCKED** because migration 0006 has not been validated/applied in authorized staging and no two distinct user-scoped staging identities were available for live RLS/OAuth tests. The public configuration explicitly sets `NEXT_PUBLIC_GUEST_ONLY_MODE=true`; this disables Supabase clients in both browser and server code even if cloud variables are later present. Google login, callbacks with session exchange, cloud sync, admin data, and account notification storage therefore remain disabled for this release. The prior production deployment `6aef730b9f504d3daf0cabd0` is preserved as the rollback target. Physical iPad verification and live two-identity RLS remain outstanding.

## LEMON-037 evidence matrix

| Gate | Status | Evidence / limit |
| --- | --- | --- |
| Guest/account local isolation | PASS (automated/local) | Identity-scoped keys, explicit guest import consent, Keep Separate, non-destructive merge, logout restoration of the selected guest plan, failed-sync preservation, and guest→A→guest/A→B regressions are covered. A verified stale async A→B race was fixed with identity-generation cancellation and immediate identity-cache switching. Browser local storage remains scoped only to the browser profile; this is not cryptographic isolation between people sharing that profile. |
| Live RLS and migration 0006 | BLOCKED | Static SQL review confirms 0006 removes anonymous notification grants/policies and the recursive admin policy without deleting records. No authorized staging database or two user-scoped credentials were available; migration application and cross-account CRUD were not performed. |
| Google OAuth | DISABLED | FULL MODE criteria are blocked. Guest-only mode prevents Supabase client construction and server session exchange. Existing account records and feature code are preserved. |
| Dependency security | PASS for production / DOCUMENTED for development | `npm audit --omit=dev`: 0 vulnerabilities. Full audit: 8 moderate findings, all in the `eslint-config-next`/`typescript-eslint`/`minimatch` development lint chain. The offered remediation is an incompatible Next ESLint-config downgrade, so no unsafe forced change was applied. |
| KFU recurring refresh | INACTIVE / BLOCKED | Netlify defines `@hourly`, but the approval flag is unset and the function fails closed before fetching. No real successful scheduled refresh or publication exists; bundled male/female snapshots remain last-known-good. See `DATA_SOURCE.md`. |
| Automated tests | PASS | `npm test`: **34 files, 245/245 tests**, exit 0. Added a regression test that restores the selected guest plan after logout instead of falling back to the first plan. |
| ESLint | PASS | `npm run lint`: exit 0. |
| TypeScript | PASS | `npm run typecheck`: exit 0. |
| Next.js production build | PASS | `npm run build`: Next.js 16.4.5 (Turbopack), exit 0, 8/8 static pages generated from the final source. |
| Netlify build/draft | PASS | Fresh CLI build `6af0753f303d255f44846425`: 18 files, 2 functions, 3 redirects, 1 header rule, CSS `/_next/static/chunks/*.css` present. No `--no-build` reuse. |
| Browser acceptance | PASS for guest scope / BLOCKED for account scope | Anonymous desktop and mobile tests against the deployed artifact: catalog (164/389), Auto Schedule save, active-plan persistence across reload/switch/second save, GPA 5.00 with reload persistence, PDF (139 KB) and PNG (121 KB) exports, AR/EN/RTL, dark/light themes, 390px and 320px with no page overflow, 834px clean, zero console errors or failed requests. Account journeys remain BLOCKED; physical iPad remains NOT VERIFIED. |

## Production launch evidence

| Item | Evidence |
| --- | --- |
| Published deploy | `6af0753f303d255f44846425`, state `ready`, deployed to production through Netlify `restoreSiteDeploy` so the tested artifact is the published artifact. |
| Public URL | `https://yourcampuspallemon.netlify.app` returns `200` for `/` and `/gpa`; CSS returns `200` with `text/css`. |
| Guest-only enforcement | No Supabase project/site environment variables are configured. `/api/admin/metrics` returns `503` (`Supabase not configured`), `/api/cron/kfu-refresh` returns `401` without the unset cron secret, notification reads return `[]`, and `/admin` renders the non-private unavailable state. The planner shows the guest badge and no Sign in control. |
| Active-plan persistence | Deployed-browser evidence: generated plan saved → reload kept it; switched to the first plan → reload kept the first plan; saved a second generated plan → reload kept the newest plan. Local keys stayed guest-scoped. |
| Rollback | Prior production deploy `6aef730b9f504d3daf0cabd0` remains in site history and can be republished with `restoreSiteDeploy`. Note that rollback restores the older, previously broken artifact. |

## Exact next action for FULL MODE

Apply migrations through 0006 to an authorized staging Supabase project, then use two distinct non-service-role sessions to prove reciprocal schedule/profile/notification isolation, repeated login/logout/account switching, explicit guest import, rejected cross-account notification operations, and Google callback allowlists. Record sanitized request outcomes and database state. Do not enable account variables until that matrix passes.

---

# Prior LEMON-033 Release Candidate Audit — Privacy, Auth, Data Freshness & Product Polish

**Decision (2026-11-08, Asia/Riyadh): LOCAL RELEASE CANDIDATE — PASS for exercised local scope. PUBLIC LAUNCH APPROVAL — BLOCKED.** No deployment, live migration, production mutation, live polling, KFU contact, or external load test was performed. Cross-account live staging identity RLS verification remains **BLOCKED** pending authorized staging credentials. Physical device testing on real iPad hardware remains **NOT VERIFIED**.

## Full quality gate

| Check | Status | Evidence |
| --- | --- | --- |
| Lint | PASS | `npm run lint`: exit 0, 0 errors, 0 warnings. |
| Typecheck | PASS | `npm run typecheck`: `tsc --noEmit`, exit 0. |
| All discovered tests | PASS | `npm test`: **31 files, 231/231 tests passing**, exit 0. (Up from 222 in LEMON-032 baseline, +9 tests covering user data isolation, GPA schedule import, export metadata, and LEMON-033 UI flows). |
| Production build | PASS | `npm run build`: Next.js 16.4.5 (Turbopack), exit 0; all 8 page-data jobs completed. |
| Diff whitespace | PASS | `git diff --check`, exit 0. |
| Live KFU validation | NOT TESTED | `validate:kfu` makes live requests; not run under no-contact / unauthorized polling restriction. |

## Six Priorities Matrix (LEMON-033)

| Priority / Area | Status | Evidence / Limits |
| --- | --- | --- |
| **P0 — 1. Strict User Data Isolation & Local-First Storage** | PASS (local/unit) / BLOCKED (live RLS) | Strict storage key namespacing implemented (`lemon.guest.*` vs `lemon.user.<userId>.*`). Guest plans are never silently auto-uploaded to cloud on login without explicit user consent prompt. Guest backup export (`exportGuestBackup`) and clean local clear (`clearGuestStorage`) with modal confirmation verified in UI tests. Cross-account live RLS gate remains **BLOCKED** because live staging identities were not provided. |
| **P0 — 2. Simplify and Verify Authentication** | PASS | Google OAuth is now the prominent, primary sign-in action for university students. Legacy email/password authentication is preserved for existing accounts and password resets, with clear UI guidance; new email registration is cleanly disabled. Server-side admin verification with allowlist enforced. |
| **P0 — 3. KFU Data Freshness & Honest Status** | PASS | Clear distinction between `lastAttemptedCheck`, `lastSuccessfulImport`, and `lastPublishedSnapshot`. Honest reason documented: automated polling is inactive pending university authorization. Bilingual stale snapshot banner (>12h) warns that data is a snapshot and disclaims real-time seat availability. |
| **P1 — 4. Connect GPA Calculator to Saved Schedules** | PASS | Accessible "Import from My Schedule" / "استيراد من جدولي" action in `/gpa`. Correctly reads active schedule plan, maps to catalog courses, deduplicates multiple meeting times/sections into a single unique course entry, populates catalog credit hours, leaves projected grades blank for user entry, and offers Replace vs Merge modal. |
| **P1 — 5. Redesign PDF / PNG Schedule Exports** | PASS | Export canvas (2200x1400) redesigned to include localized course title, course code, instructor name (or localized unassigned), section, CRN, and meeting times. Dynamic time-axis avoids blank early hours without clipping late classes. Structured legend table rendered below timetable with full bilingual RTL/LTR support. |
| **P1 — 6. Real iPad Compatibility** | PASS (CSS/Responsive) / NOT VERIFIED (Physical hardware) | Touch targets ≥44px (`min-height: 44px; min-width: 44px`), smooth momentum scrolling (`-webkit-overflow-scrolling: touch`), no hover-dependent critical controls, and responsive media queries supporting 768px, 810/820/834px, 1024px, 1180px CSS px without horizontal overflow. Physical device validation on real iPad hardware is marked **NOT VERIFIED**. |

## Functional and reliability matrix

| Area | Status | Evidence / limit |
| --- | --- | --- |
| Guest first visit, preferences, named plans, edit/delete, reload | PASS | Isolated local production browser on port 3002: completed setup, added CRN 85169, renamed and persisted a plan, created/renamed/deleted a temporary plan, reloaded and reopened the retained plan. Owner's existing dev browser data was not modified. |
| Auto Schedule | PASS | Browser selected courses 0603-101 and 0603-103, tested a no-match hard constraint, generated and compared options, saved a new two-section plan, reloaded and reopened it. Rebuilt browser confirmed Generate More expands five results to ten. |
| Course explorer and provenance | PASS | Browser switched to female category (168 courses/540 sections), searched 0603-101, filtered by department and availability, inspected CRN 84032 meetings and instructor. Snapshot seat wording disclaims live availability. Source review confirms generator candidates come from `data.sections` for the selected category/term. |
| GPA | PASS | Browser checked empty state, A+ 3 credits = 15 points/5.00, B 3 credits = 12 points/4.00, cumulative projection 3.55 from 3.5/30 prior hours, impossible 4.00 target, reload persistence, and reset. |
| AR/EN, RTL/LTR, themes | PASS | Browser toggled languages and verified document direction; toggled light/dark/system theme. |
| Responsive and exports | PASS | Rebuilt browser: document scroll width was within viewport at 320px (305/320), 390px (375/390), and desktop 1280px (1265/1280); PNG and PDF export actions reported success. File contents/print output were not independently inspected. |
| Browser console/hydration | PASS | No error or warning entries in exercised browser flows after rebuild. Bounded to those journeys. |
| Failed network, storage-disabled, Supabase outage | NOT TESTED | No live outage was induced. Unit tests cover storage write exceptions and unconfigured cloud mode; production outage recovery remains unverified. |
| Auth login, Google callback, logout, guest migration, cloud sync | BLOCKED | No authorized test identities were supplied. Callback redirect and cache-isolation cases pass unit tests; full browser journeys and cross-account behavior remain unverified. |

## Security matrix

| Check | Status | Evidence / limit |
| --- | --- | --- |
| Server identity and private admin access | PASS (local static/anonymous) | Admin page/API use `auth.getUser()` and admin allowlist checks; anonymous local `/api/admin/metrics` returned 401, while `/admin` rendered a nonprivate sign-in state. Privileged client is server only. |
| RLS policies and grants | FAIL (migration pending) | Static review found guest push endpoint/auth-key exposure through `user_id IS NULL` policies and anonymous guest notification reads in migration 0005. Corrective migration `0006_release_privacy.sql` removes those policies/grants and the recursive admin allowlist policy. It has **not** been applied to a live database. |
| Cross-account read/write, admin role, session isolation, guest migration | BLOCKED | No two authorized identities or approved production-safe database access. Never inferred client RLS isolation from service-role access. Local tests cover prior-account cache rejection and same-account pending edits only. |
| Secret exposure | PASS (local file/build scan) | `.env.local` and `client_secret*.json` are ignored and untracked; no `SUPABASE_SERVICE_ROLE_KEY` or `CRON_SECRET` name found in `.next/static`. Values were not read or printed. Deployment settings were not inspected. |

**Manual two-identity verification:** In an approved staging Supabase project after applying migrations, create authorized non-admin users A and B. In separate clean browsers, have A create a schedule and notification subscription, then have B query/update A's exact IDs with the publishable client key and B's own JWT; every read must return no row and every write must fail or affect zero rows. Repeat in reverse, then sign out A and sign in B in the same browser to verify no A plan appears or migrates. Check admin page/API with a non-admin and an allowlisted admin, and verify anonymous guest notification/subscription reads fail. Record requests, status, and database state without using a service-role key for isolation checks.

## KFU integrity and operations

| Check | Status | Evidence / limit |
| --- | --- | --- |
| Male catalog, term 144820 / college 06 / category 11 | PASS (offline) | Bundled import `2026-11-07T18:03:12.960Z`: 164 unique courses, 389 unique sections/CRNs; zero invalid course relations, time records, or provenance fields. Three sections have no published meeting times and are excluded from generation. |
| Female catalog, term 144820 / college 06 / category 12 | PASS (offline) | Bundled import `2026-11-07T20:39:46.576Z`: 168 unique courses, 540 unique sections/CRNs; zero invalid course relations, time records, or provenance fields. One section has no published meeting time. |
| Source timestamps and stale wording | PASS (local) | UI displays import time and snapshot-only availability disclaimer; freshness status is computed from the timestamp and has unit coverage. It does not prove current KFU accuracy. |
| Atomic refresh and last-known-good | FAIL (operational gap) | Current monitor validates candidates but has no snapshot publisher; it now reports `snapshotPublished: false` accurately. Bundled static snapshot remains available when monitor work fails, but no approved atomic publish/rollback runbook exists. |
| Permission and refresh restrictions | BLOCKED | Existing `DATA_SOURCE.md` documents no affirmative KFU automation permission. Netlify schedule remains commented out; refresh endpoint now requires both a configured secret and explicit approval, including dry runs. No polling was activated. |

## Confirmed defects corrected

- Auto Schedule hid Generate More after an ordinary full result page; result pagination now exposes remaining combinations.
- Shared browser cache could mix a previous account's plans into a different account; login now uses verified ownership and preserved guest data.
- Guest notification policies exposed device-bound private rows; local API access is now limited to verified users and migration 0006 closes database grants/policies when applied.
- The KFU dry-run route could bypass approval or accept an unset secret; both gates are required before any fetch.
- Auth callback accepted a backslash redirect that could resolve off-origin; redirect origin is now checked.
- Missing CRNs after a category switch were mislabeled as cancelled; they are reported as unavailable in that snapshot.
- Monitor success overstated publication; reporting now reflects validation only.
- Header and GPA/plan grid widths caused horizontal page overflow on small screens; rebuilt browser widths passed.

## LEMON-040 & LEMON-041 Release Gate: Simplified Catalog Status & Bilingual Audit (2026-11-08)

| Check | Status | Evidence / Verification |
| --- | --- | --- |
| Simplified Catalog Status Section | PASS | Replaced verbose developer metadata (attempted checks, worker name, attestation, internal policies) with clean student-focused status strip: localized heading (`Business Course Catalog` / `شعب كلية إدارة الأعمال`), freshness pill (`Updated` / `Outdated`), student category (`Male` / `Female`), course and section counts, single relative timestamp since last published snapshot, and unobtrusive seat verification note. |
| 100% Course Translation Coverage | PASS | All 192 unique courses across male and female catalogs mapped in `VERIFIED_ENGLISH_COURSE_TITLES` with standard academic business English titles. Zero English UI screens falling back to untranslated Arabic titles. |
| Bidirectional Search | PASS | Search queries match Arabic or English course titles seamlessly without requiring language switching. |
| Quality Gates | PASS | ESLint: 0 errors, 0 warnings. TypeScript (`tsc --noEmit`): 0 errors. Full test suite: **39 test files, 284 tests passed, 0 failed**. Next.js & Netlify builds: clean. |
| Production Release & Rollback | PASS | Live production deployed to `https://yourcampuspallemon.netlify.app` (Deploy ID: `6af095fad6a293be1e1348e5`). Verified live endpoints `/api/kfu/status`, `/api/kfu/snapshot?category=11`, and `/api/kfu/snapshot?category=12`. Preserved rollback deploy IDs: `6af08e2c0365206f6d192121`, `6af08a32d23ada93bbf6fd79`, and `6af0753f303d255f44846425`. |

## LEMON-042 Release Gate: Targeted UX Polish (2026-11-08)

| Area | Status | Evidence / Verification |
| --- | --- | --- |
| 1. GPA Page | PASS | Desktop container widened (`max-width: 1360px`, `padding: 24px 28px`) with responsive desktop grid (`minmax(0, 1fr) 350px`, widening to `1.4fr 360px` on large displays). Streamlined empty state eliminating redundant button rows. Preserved 100% of calculations, what-if scenarios, local drafts, and schedule import modal. |
| 2. Weekly Calendar | PASS | Displaying full course codes (`0603-101` instead of trailing numbers). Rendered start and end times (`08:00 – 08:50`). Added compact attribute on short/dense blocks preventing label clipping while maintaining color coding, geometry, and PDF/PNG export fidelity. |
| 3. System Status Modal | PASS | Substantially condensed modal (`max-width: 440px`, reduced padding and vertical gap). Displays concise operational states (Planning Engine, Guest Storage/Account Sync, KFU Catalog data freshness). Replaced bulky resilience card with compact, sleek banner. Retained internal diagnostic logging. |
| 4. Course Catalog | PASS | Improved section card density with tightened padding and compact action bars. Implemented accessible expansion pattern for courses with >4 sections (`Show all N sections / Show fewer`) preserving selected section visibility. Added truthful snapshot tooltips clarifying section availability without implying live seat capacity. |
| Quality Gates | PASS | ESLint: 0 errors, 0 warnings. TypeScript (`tsc --noEmit`): 0 errors. Full test suite: **40 test files, 288 tests passed, 0 failed**. Next.js & Netlify builds: clean. |
| Production Release & Rollback | PASS | Live production deployed to `https://yourcampuspallemon.netlify.app` (Deploy ID: `6af09acb3ce2a6abbea35200`). Preview Deploy ID: `6af09a8a30ccb00fce3caee3`. Preserved rollback targets: `6af095fad6a293be1e1348e5`, `6af08e2c0365206f6d192121`, `6af08a32d23ada93bbf6fd79`. |

## Release checkpoint and next action

Git is on `main` at `5ba6904` with extensive modified and untracked work that predates this audit, including files also touched by the fixes. **No checkpoint commit was made** because committing those whole files would also capture the owner's pre-existing changes; nothing was discarded or stashed. Local release candidate evidence is this report plus the passing gate, not a public deployment authorization.

**Next action:** Apply migration 0006 in an authorized staging database and perform the two-identity manual matrix above; then close KFU acquisition permission and atomic refresh/rollback ownership before requesting public launch approval. Rerun the full gate after any resulting code, data, or dependency change.
