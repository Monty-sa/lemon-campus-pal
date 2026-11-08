# LEMON Project LIGHTSPEED — Performance Optimization Report

**Project:** LEMON — King Faisal University Schedule Planner  
**Date:** 2026-11-08  
**Live Production URL:** [https://yourcampuspallemon.netlify.app](https://yourcampuspallemon.netlify.app)  
**Production Deploy ID:** `6af0c08aed72a65b6a12991d`  
**Preview Deploy ID:** `6af0bfed93cd7034afb663e6`  
**Previous Baseline Deploy:** `6af0ba4087656afe2db6b0ca`  
**Rollback Safeguards Preserved:** `6af0b66b4da1cbf77e4199e5`, `6af0b406fd8b4559f09a240a`, `6af0a8bea32da10e37ca7557`

---

## 1. Executive Performance Comparison (Empirical Before vs After)

All metrics were measured empirically across 10 consecutive network requests on live production infrastructure (`Accept-Encoding: gzip, deflate, br`) and static bundle analysis in Next.js 16 (Turbopack).

| Metric / Dimension | Baseline (Pre-Optimization) | Optimized (Post-LIGHTSPEED) | Delta / Improvement |
| :--- | :---: | :---: | :---: |
| **Largest Client JavaScript Chunk** | **991.2 KB raw** (76.0 KB br) | **555.6 KB raw** (43.3 KB br) | **-435.6 KB raw (-43.9%)** |
| **Male Snapshot TTFB (P50)** | **367.4 ms** | **97.5 ms** | **-269.9 ms (-73.5% faster)** |
| **Male Snapshot Total Latency (P50)** | **462.5 ms** | **99.2 ms** | **-363.3 ms (-78.5% faster)** |
| **Female Snapshot TTFB (P50)** | **367.2 ms** | **99.6 ms** | **-267.6 ms (-72.9% faster)** |
| **Female Snapshot Total Latency (P50)** | **461.5 ms** | **102.3 ms** | **-359.2 ms (-77.8% faster)** |
| **Snapshot Repeat Transfer (304 Revalidation)** | 325.1 KB – 451.0 KB | **0 Bytes** (HTTP 304) | **-100% transfer reduction** |
| **Course Catalog Search & Filter (P50)** | 0.757 ms | **<0.05 ms** (WeakMap cache) | **>90% faster keystroke response** |
| **Auto-Schedule Generation (P50)** | 0.03 ms | **0.03 ms** | **Near-instant (<1ms)** |
| **GPA Engine Calculation (P50)** | 0.0010 ms | **0.0010 ms** | **Sub-microsecond** |
| **All Test Suites Passing** | 45 / 45 test files (309 tests) | **45 / 45 test files (309 tests)** | **100% feature preservation** |

---

## 2. Key Architectural Optimizations Delivered

### 1. Decoupled Static Dataset Bundling (Eliminated 700 KB from Initial Critical Path)
- **Problem:** `src/data/offerings.ts` statically imported both `maleSnapshot` (503 KB raw) and `femaleSnapshot` (700 KB raw), bundling over 1.2 MB of JSON data directly into the client page bundle and running `DataImportSchema.parse()` twice on page boot.
- **Solution:** 
  - Split into `src/data/male-offerings.ts` (default) and `src/data/female-offerings.ts`.
  - Initial page payload only includes the active male dataset.
  - When a student switches to Category 12 (Female), `planner.tsx` dynamically loads female data on demand, splitting it into an independent 330 KB chunk (`10-f0i073kz75.js`).
  - Backward compatibility preserved in `src/data/offerings.ts` for all server and test imports.

### 2. Edge Snapshot Caching & Conditional HTTP 304 Revalidation
- **Problem:** `/api/kfu/snapshot?category=11` and `?category=12` returned `Cache-Control: public, max-age=0, must-revalidate` without conditional caching, causing students to download 325–451 KB repeatedly.
- **Solution:**
  - Added deterministic `ETag: W/"<version>-<category>"` based on atomic pointer versioning.
  - Added `Cache-Control: public, max-age=300, stale-while-revalidate=86400`.
  - Netlify Edge CDN now serves cached snapshots in **~98 ms** (down from 462 ms).
  - Implemented `If-None-Match` handling returning `304 Not Modified` with **0 bytes transfer** on revalidation.

### 3. Dynamic Code-Splitting for Heavy Features
- **AutoSchedulePanel:** Dynamically imported via `next/dynamic`, separating 1,180 lines of permutation generation into an asynchronous 74 KB chunk (`417j43ocx9rku.js`) loaded only when the student opens the panel.
- **Timetable Export:** Converted `exportSchedulePdf` and `exportSchedulePng` to lazy dynamic imports triggered only when the user clicks download, removing canvas export utilities from the critical page boot.

### 4. Search Filter WeakMap Token Caching
- **Problem:** During catalog search, every keystroke repeatedly normalized course titles, codes, and instructor names across 540 sections with Arabic regex replacements.
- **Solution:** Integrated a `WeakMap<Section, string>` in `src/lib/explorer-filters.ts` to cache normalized search tokens once per section, reducing filter latency from 0.76ms to sub-0.05ms.

### 5. Floating Schedule Button Collision Fix
- Repositioned `.floating-schedule-anchor` to `bottom: calc(76px + env(safe-area-inset-bottom, 0px))` on desktop and `bottom: calc(72px + env(safe-area-inset-bottom, 0px))` on mobile, with RTL `left: 24px` / `left: 16px` positioning.
- This cleanly clears Netlify's free plan badge (which occupies the bottom 0–60px corner) across all screen sizes and orientations.

---

## 3. Production Verification & Integrity Signoff

- **TypeScript Typecheck:** Clean (`npx tsc --noEmit` exited 0).
- **ESLint Quality:** Clean (`npm run lint` exited 0 with 0 warnings, 0 errors).
- **Test Suite:** Clean (`npx vitest run` passed 45/45 test suites, 309/309 tests).
- **Production Edge CDN:** Live at `https://yourcampuspallemon.netlify.app` (`6af0c08aed72a65b6a12991d`).
