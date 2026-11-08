# LEMON-002 validation report

**Validation date:** 2026-11-07 (Asia/Riyadh); final gate rerun 21:23–21:25 (UTC+3)  
**Dataset:** term `144820`, college `06`, category `11`  
**Recommendation:** **CONDITIONAL PASS** (all automated release gates PASS; governance conditions remain)

## Executive result

The imported snapshot contains **164 courses and 389 sections**. An independent parser compared all **389/389** stored sections with the live official HTML and found **0 field mismatches** and **0 snapshot-only CRNs**. A deliberately varied evidence sample of **30 sections** (more than the required 25) passed every checked field.

The schedule engine, persistence, named plans, CRN copy path, and print path pass automated coverage. Browser validation also confirmed that a renamed plan and selected CRN survived a full page reload. Public beta remains conditional on resolving the operational permission/cadence for future source imports.

## Final verification gate

The complete gate below was rerun against the final working tree on **2026-11-07, 21:23–21:25 Asia/Riyadh (UTC+3)**. Results are from fresh command output, not carried forward from the previous session.

| Gate | Command | Result |
| --- | --- | --- |
| Independent source validation | `npm run validate:kfu` | **PASS** — HTTP 200; 1,247,938 bytes; SHA-256 `7952e5b59722b9364d7568d87ee9ad2f7e54fdf20e6edeb5e03aab022c1292bc`; 389/389 records passed; 0 mismatches; 0 snapshot-only CRNs; 30/30 sample passed |
| ESLint | `npm run lint` | **PASS** — no errors or warnings |
| TypeScript | `npm run typecheck` | **PASS** — no diagnostics |
| Automated tests | `npm test` | **PASS** — 5 test files, 25/25 tests passed, 0 failed, 0 skipped |
| Production build | `npm run build` | **PASS** — Next.js 16.4.5 (Turbopack); compiled successfully; build-time TypeScript passed; 3/3 static pages generated |

The validation run regenerated [`data/validation-evidence.json`](../data/validation-evidence.json) with `generatedAt` `2026-11-07T18:23:56.805Z`; its source hash is identical to the stored snapshot hash.

### Test-selector ambiguity resolution

The earlier duplicate plan-name selector was caused by test DOM leakage: the first planner test rendered a second planner without unmounting the first. The shared setup now calls `afterEach(cleanup)`, and the planner test uses strict single-element `getByRole` selectors for the plan name, CRN copy button, and print button. The suite passes with isolated renders, so a future duplicate element will fail the test instead of being silently accepted.

## Verified university facts

These facts come from KFU's own pages; they are not numeric-code guesses:

| Item | Verified meaning | Evidence |
| --- | --- | --- |
| Term `144820` | Second semester of academic year 1448 | KFU's registration page links year 1448 with `sm=10` as first semester. Its selector defines `10`/`20`, labels `20` as second semester, and builds `p_trm_code` by concatenating year + semester. |
| College `06` | College of Business Administration (`إدارة الأعمال`) | KFU selector's college list maps `p_col_code: "06"` to `إدارة الأعمال`. |
| Category `11` | Male students (`طلاب`) | KFU selector constructs links with `sex="11"` under `طلاب`; it separately maps `12` to `طالبات`. |

Sources: [official KFU registration page](https://www.kfu.edu.sa/ar/Deans/AdmissionRecordsDeanship/Documents/acadPlan/registeration.html?trg=regPlan), [official KFU schedule selector](https://www.kfu.edu.sa/ar/Deans/AdmissionRecordsDeanship/Documents/acadPlan/studyTables.html?cry=1448&sm=20).

## Source-to-record comparison

The validator made one GET request to the public official endpoint and independently parsed the raw table rows. It did not reuse the production importer. It compared CRN, course code/name, credits, section code, source status, instructor, activity, and the complete ordered set of meeting days/start/end times.

| Measure | Result |
| --- | ---: |
| HTTP response | 200 |
| Live HTML bytes | 1,247,938 |
| SHA-256 (live and stored source) | `7952e5b59722b9364d7568d87ee9ad2f7e54fdf20e6edeb5e03aab022c1292bc` |
| Raw meeting rows | 592 |
| Live unique sections | 389 |
| Snapshot sections | 389 |
| Full records compared/passed | 389 / 389 |
| Field mismatches | 0 |
| Snapshot-only CRNs | 0 |

The full machine-readable evidence is in [`data/validation-evidence.json`](../data/validation-evidence.json).

### Representative 30-section sample

`Meetings` is the number of independently parsed meeting blocks after grouping repeated source rows by CRN. Each row passed all compared fields, including the Arabic course name and exact meeting days/times.

| # | CRN | Course | Credits | Source status | Meetings | Instructor | Result |
| ---: | --- | --- | ---: | --- | ---: | --- | --- |
| 1 | 86944 | 0677-308 | 3 | open | 1 | named | PASS |
| 2 | 53210 | 0603-302 | 3 | closed | 0 | missing | PASS |
| 3 | 57230 | 0606-490 | 6 | closed | 0 | missing | PASS |
| 4 | 57231 | 0606-490 | 6 | closed | 0 | missing | PASS |
| 5 | 63953 | 0602-202 | 3 | closed | 2 | missing | PASS |
| 6 | 63988 | 0602-305 | 3 | closed | 2 | missing | PASS |
| 7 | 64014 | 0602-430 | 3 | closed | 2 | missing | PASS |
| 8 | 64042 | 0602-431 | 3 | closed | 2 | missing | PASS |
| 9 | 84029 | 0603-101 | 3 | closed | 2 | missing | PASS |
| 10 | 84028 | 0603-101 | 3 | open | 2 | named | PASS |
| 11 | 77034 | 0603-103 | 3 | open | 2 | named | PASS |
| 12 | 76074 | 0603-302 | 3 | open | 2 | named | PASS |
| 13 | 78427 | 0604-201 | 3 | open | 2 | named | PASS |
| 14 | 63808 | 0604-202 | 3 | open | 2 | named | PASS |
| 15 | 85169 | 0602-207 | 3 | open | 1 | named | PASS |
| 16 | 53317 | 0603-407 | 6 | open | 1 | named | PASS |
| 17 | 53937 | 0603-407 | 6 | open | 1 | named | PASS |
| 18 | 53940 | 0603-407 | 6 | open | 1 | named | PASS |
| 19 | 84691 | 0604-205 | 1 | open | 1 | named | PASS |
| 20 | 85170 | 0602-302 | 3 | closed | 1 | missing | PASS |
| 21 | 85168 | 0602-303 | 3 | closed | 1 | missing | PASS |
| 22 | 63965 | 0602-304 | 3 | closed | 1 | missing | PASS |
| 23 | 85174 | 0602-331 | 3 | closed | 1 | missing | PASS |
| 24 | 85172 | 0602-332 | 3 | closed | 1 | missing | PASS |
| 25 | 85173 | 0602-401 | 3 | closed | 1 | missing | PASS |
| 26 | 85171 | 0602-402 | 3 | closed | 1 | missing | PASS |
| 27 | 53318 | 0602-499 | 6 | closed | 1 | missing | PASS |
| 28 | 53930 | 0602-499 | 6 | closed | 1 | missing | PASS |
| 29 | 53931 | 0602-499 | 6 | closed | 1 | missing | PASS |
| 30 | 53932 | 0602-499 | 6 | closed | 1 | missing | PASS |

Coverage within the sample: 10 multi-meeting, 3 no-meeting, 19 missing-instructor, 11 open, 19 closed, 29 theory, and 1 distinct source activity (`ا ختياري`). The complete evidence file records the raw and normalized values, including the exact times.

## Dataset profile and normalization findings

- Source statuses: **277 open**, **112 closed**.
- **145** sections have multiple meeting blocks.
- **114** sections omit an instructor.
- Three source sections omit day/time. They are retained with an empty meeting list and a visible warning; no time is invented.
- The source does not publish seat capacity or remaining-seat counts in this output. LEMON now says “available at import time” and explicitly states that the label does not guarantee a seat or registration.

## Schedule-engine audit

The conflict rule uses half-open intervals: two meetings conflict only when `startA < endB && startB < endA` on a shared day and term. Therefore adjacent classes are permitted, while a one-minute overlap conflicts.

Automated cases cover:

- every meeting block in multi-meeting sections;
- shared-day conflicts from multi-day blocks;
- adjacent times (no conflict) and one-minute overlaps (conflict);
- identical-time sections of the same course;
- different-term selections (ignored by the current-term conflict scan);
- unique-course credit totals, so two sections of one course are not double-counted.

No reproducible schedule-engine defect remained after this audit.

## Persistence and export validation

| Workflow | Evidence | Result |
| --- | --- | --- |
| Local persistence | Browser reload retained selected CRN `63953` | PASS |
| Named plans | Browser reload retained plan name `خطة تحقق الإصدار`; component test covers save/reload behavior | PASS |
| CRN copying | Component test verifies the exact CRN string passed to `navigator.clipboard.writeText`; browser UI showed the success toast | PASS |
| Print/PDF | Component test verifies the print control invokes `window.print`; browser path was exercised after reload; print CSS remains present | PASS |

PDF generation is provided by the browser/OS print dialog, not by a separate server-side renderer.

## Correctness fixes made

- Replaced neutral guessed metadata with KFU-verified term, college, and student-category labels.
- Scoped availability labels to the import snapshot and added an explicit no-guarantee notice.
- Made missing source meetings visible instead of presenting a blank schedule.
- Added independent full-snapshot validation evidence and edge-case tests.

No university field was edited merely to satisfy a test.

## Source-access review

The SSB endpoint was public and unauthenticated during validation. Its conventional `robots.txt` returned 404. KFU's main robots file did not block the public selector path, but neither fact grants automation permission. KFU's published [Information Security Framework and Policy](https://www.kfu.edu.sa/ar/Deans/it/DocLib3/Information-Security-Framework-and-Policy.pdf) describes portal access as personal use and prohibits misuse; no explicit published authorization for automated SSB collection was found. Validation used a single read-only request and bypassed no restriction.

**Unresolved operational assumption:** recurring automated imports are acceptable. Until KFU grants permission or supplies an approved feed, LEMON should keep imports manual, sparse, and reviewable.

## Conclusion

**CONDITIONAL PASS.** Data fidelity, planner correctness, and every automated release gate pass on the final tree. No reproducible code, test, type, lint, build, or snapshot-validation failure remains. The condition is operational/legal rather than a known data mismatch: establish an approved source-access method and import freshness policy before a public beta.
