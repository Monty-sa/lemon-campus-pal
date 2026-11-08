# LEMON Project LIGHTSPEED — Performance Baseline Report

**Measured Date:** 2026-11-08  
**Target Environment:** Production (`https://yourcampuspallemon.netlify.app`)  
**Deployment Infrastructure:** Netlify Edge + Next.js 16 (Turbopack)  
**Methodology:** Direct empirical multi-run measurements (N=10 HTTP probes per endpoint, N=500 search queries, N=1000 GPA iterations, static bundle static-size extraction with raw, gzip, and brotli compression).

---

## 1. Executive Summary & Baselines

| Dimension | Baseline Value | Units / Notes | Primary Driver |
| :--- | :--- | :--- | :--- |
| **Homepage HTML Transfer** | 376.9 KB | Brotli compressed | Server-side rendered initial state contains full male dataset |
| **GPA Route HTML Transfer** | 9.3 KB | Brotli compressed | Lightweight static route document |
| **Total Client JavaScript** | 1,997.5 KB (324.8 KB br) | 12 static chunks | Eager bundling of all dialogs & heavy static dataset imports |
| **Largest JavaScript Chunk** | 991.2 KB (76.0 KB br) | `3b78yspj0y2a-.js` | Course snapshots, schemas, calendar calculations |
| **Total Application CSS** | 109.3 KB (16.8 KB br) | `globals.css` compiled | Full styling for calendar, catalog, and modals |
| **Male Snapshot Delivery** | 325.1 KB (br) / 462ms P50 | `/api/kfu/snapshot?category=11` | Dynamic API route, un-cached on client/edge |
| **Female Snapshot Delivery** | 451.0 KB (br) / 461ms P50 | `/api/kfu/snapshot?category=12` | Dynamic API route, un-cached on client/edge |
| **KFU Status Latency** | 0.7 KB (br) / 258ms P50 | `/api/kfu/status` | Dynamic API route |
| **Zod Parse Startup Cost** | 1.13ms (M) / 1.59ms (F) | Synchronous parsing on load | DataImportSchema verification of raw JSON |
| **Catalog Filter Latency** | 0.76ms P50 / 0.90ms P95 | Per-keystroke filter | Linear scan across sections with un-memoized text normalization |
| **Auto-Schedule Generation** | 0.03ms P50 / 0.19ms P95 | 3–6 courses combinations | Efficient recursive backtracking |
| **GPA Engine Calculation** | 0.0010ms P50 / 0.0019ms P95 | Cumulative & target scenario | Highly optimized mathematical calculation |

---

## 2. Production HTTP Network Waterfall (Empirical Measurements)

Measured over 10 consecutive requests per endpoint with `Accept-Encoding: gzip, deflate, br`:

| Endpoint / Document | Status | Size (Transferred) | Encoding | Cache-Control | Cold TTFB | Median TTFB | P95 TTFB | Median Total |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Homepage (`/`)** | 200 | 376.9 KB | Brotli | `public,max-age=0,must-revalidate` | 95.4 ms | 97.6 ms | 1094.9 ms | 99.1 ms |
| **GPA Page (`/gpa`)** | 200 | 9.3 KB | Brotli | `public,max-age=0,must-revalidate` | 95.7 ms | 96.6 ms | 386.9 ms | 96.9 ms |
| **Status API (`/api/kfu/status`)** | 200 | 0.7 KB | Brotli | `public,max-age=0,must-revalidate` | 246.2 ms | 258.4 ms | 270.9 ms | 258.8 ms |
| **Male Snapshot (`cat=11`)** | 200 | 325.1 KB | Brotli | `public,max-age=0,must-revalidate` | 333.1 ms | 367.4 ms | 410.7 ms | 462.5 ms |
| **Female Snapshot (`cat=12`)** | 200 | 451.0 KB | Brotli | `public,max-age=0,must-revalidate` | 344.8 ms | 367.2 ms | 455.3 ms | 461.5 ms |

---

## 3. Client Static Bundle Analysis

Total Chunks: 13 files (`.next/static/chunks/`):
- **Total JavaScript:** 1,997.5 KB raw / 397.9 KB gzip / 324.8 KB brotli
- **Total CSS:** 109.3 KB raw / 20.2 KB gzip / 16.8 KB brotli

### Chunk Breakdown (Ranked by Raw Size)

| Chunk Name | Type | Raw Size | Gzip Size | Brotli Size | Contents / Role |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `3b78yspj0y2a-.js` | JS | 991.2 KB | 105.0 KB | 76.0 KB | Main planner module, static course offerings dataset, i18n |
| `08g_m91vmu7r_.js` | JS | 424.3 KB | 108.7 KB | 89.4 KB | React framework, DOM runtime, Next.js page runtime |
| `33sv2kyjb3til.js` | JS | 228.1 KB | 71.4 KB | 61.1 KB | Client UI components, modals, timetable renderer |
| `1c0qt7trm4143.js` | JS | 164.9 KB | 45.3 KB | 38.3 KB | Supabase / storage / auth sub-tree |
| `0cz1d0mv5g_q7.js` | JS | 112.6 KB | 39.6 KB | 35.2 KB | PDF/PNG export engines & canvas utilities |
| `06vdttzddh-4a.css` | CSS | 109.3 KB | 20.2 KB | 16.8 KB | Global application stylesheet (`globals.css`) |
| `2eoxeemjtegat.js` | JS | 33.6 KB | 8.9 KB | 7.8 KB | AutoSchedule generator & search normalizer |
| `02volskv92edw.js` | JS | 33.2 KB | 10.3 KB | 8.9 KB | GPA calculator & modal sub-tree |
| Other runtime chunks | JS | 7.9 KB – 19.1 KB | 2.4 – 5.0 KB | 2.0 – 4.5 KB | Turbopack runtime bootstrap |

---

## 4. Key Architectural Bottlenecks Identified

### Bottleneck 1: Synchronous Dual Dataset Ingestion in Initial Bundle
- In `src/data/offerings.ts`: Both male (503 KB raw) AND female (700 KB raw) JSON snapshots are eagerly imported at build time.
- Both datasets undergo synchronous validation with `DataImportSchema.parse()` during initial module evaluation.
- Over 1.2 MB of JSON data is evaluated before the student ever interacts with the page, even though a male student never needs female sections, and vice versa.

### Bottleneck 2: Monolithic Client Component Tree
- Heavy modals and interactive panels in `src/components/planner.tsx`:
  - `AutoSchedulePanel` (1,180 lines, heavy permutations generator)
  - `DataPrivacyModal` (380 lines, backup export/restore parser)
  - `CourseDetailsModal` (278 lines)
  - `RegistrationGuideModal` (267 lines)
  - `OnboardingModal` (148 lines)
- These dialogs are currently imported statically, bundling their code directly into the critical initial render path even though none of them are displayed until the student clicks a button.

### Bottleneck 3: Uncached Dynamic Snapshot Delivery
- `/api/kfu/snapshot?category=11` and `?category=12` return `Cache-Control: public,max-age=0,must-revalidate` with no conditional `ETag` matching or edge caching.
- Every student category switch or page reload causes a full 325–451 KB network transfer over the wire.
- With atomic version pointers (`v_...`), snapshot payloads are content-addressable and immutable for a given active version. Adding `ETag` and `stale-while-revalidate` will eliminate redundant transfers and yield instant 304 Not Modified responses (0 KB transfer).

### Bottleneck 4: Course Filter Scan Optimization
- Course filtering performs `normalizeSearchText()` repeatedly during section iteration across all courses and instructors.
- Precomputing search tokens on section objects at load time reduces search latency from ~0.9ms to <0.1ms.

---

## 5. Phase-by-Phase Optimization Target Roadmap

1. **Phase 2 & 3: Initial Load & Dynamic Splitting**
   - Convert non-critical modals (`AutoSchedulePanel`, `DataPrivacyModal`, `CourseDetailsModal`, `RegistrationGuideModal`, `OnboardingModal`) to dynamic asynchronous components via `next/dynamic`.
   - Lazy load heavy export tools (html-to-image, jsPDF) only when user clicks export.
2. **Phase 4: Catalog Delivery & Edge Caching**
   - Update `/api/kfu/snapshot/route.ts` with `ETag` based on `snapshot.version` and `Cache-Control: public, max-age=300, stale-while-revalidate=86400`.
   - Support `If-None-Match` returning `304 Not Modified` when unchanged.
   - Separate initial static data payload from female catalog, fetching category 12 asynchronously with local memory caching.
3. **Phase 5 & 6: React Render & Search Optimization**
   - Memoize normalized search index for course catalog.
   - Defer calendar rerenders during fast text typing.
4. **Phase 7 & 8: Verification & Comparative Measurements**
   - Ensure all 45 test suites (309 tests) pass with zero functional regressions.
   - Run post-optimization benchmark script to verify payload reductions and TTFB improvements.
