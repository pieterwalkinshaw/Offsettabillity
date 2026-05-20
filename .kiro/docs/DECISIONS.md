# Decision Log

This document tracks architectural and implementation decisions made during the Offsettabillity platform build.

---

## Decision 001: Repository Cleanup Before Implementation

**Date:** 2025-01-XX
**Context:** The repository contained prototype/mock code from an earlier exploration phase. Before starting spec-driven implementation, we needed a clean slate.
**Decision:** Remove all mock implementations and keep only the foundational config files.

### Removed (prototype code, will be rebuilt by spec tasks):

| File/Directory | Reason | Rebuilt By |
|---|---|---|
| `src/types/index.ts` | Incomplete types, replaced by `shared/types.ts` | Task 1.1 |
| `src/lib/firebase/projects.ts` | localStorage mock, no real Firebase | Task 5.1 |
| `src/lib/firebase/taxonomy.ts` | localStorage mock | Task 4.1 |
| `src/lib/firebase/config.ts` | Missing emulator support | Task 1.2 |
| `src/lib/auth/AuthContext.tsx` | Mock auth (no Firebase Auth) | Task 2.4 |
| `src/components/dashboard/esg/*` | Hardcoded mock data, not in spec | Tasks 18.x |
| `src/app/page.tsx` | Hardcoded homepage | Task 15.2 |
| `src/app/login/page.tsx` | Mock role-selector login | Task 2.4 |
| `src/app/dashboard/page.tsx` | Mock dashboard | Tasks 18.x |
| `src/app/dashboard/admin/taxonomy/page.tsx` | Mock taxonomy admin | Task 4.3 |
| `src/app/dashboard/projects/new/page.tsx` | Mock project form | Task 5.3 |
| `src/app/projects/page.tsx` | Mock project listing | Task 14.1 |
| `src/app/projects/[id]/page.tsx` | Mock project detail | Task 14.3 |
| `src/components/layout/Header.tsx` | Mock header | Task 15.3 |
| `src/components/layout/Footer.tsx` | Mock footer | Task 15.3 |
| `public/*.svg` (5 files) | Next.js boilerplate assets | N/A |
| `CLAUDE.md` | Redundant (just referenced AGENTS.md) | N/A |

### Kept (still useful):

| File | Reason |
|---|---|
| `package.json` | Correct dependencies (next, react, firebase, lucide, recharts, tailwind) |
| `tsconfig.json` | Proper strict TypeScript config |
| `next.config.ts` | Minimal, will be extended as needed |
| `src/app/globals.css` | Good theme/color system foundation |
| `src/app/layout.tsx` | Minimal root layout (stripped of mock imports) |
| `eslint.config.mjs` | ESLint config |
| `postcss.config.mjs` | PostCSS/Tailwind config |
| `AGENTS.md` | Next.js 16 guidance (referenced by steering rules) |
| `.gitignore` | Updated with Firebase/functions entries |

### Rationale:
- Mock code used localStorage instead of Firestore, had no validation, no real auth
- Starting fresh ensures no conflicts between old patterns and spec-driven implementation
- A minimal placeholder `page.tsx` keeps the app buildable during development

---

## Decision 002: Project Name Correction

**Date:** 2025-01-XX
**Context:** The package.json uses `"name": "offsettable"` but the project is called "Offsettabillity".
**Decision:** Keep as-is for now. The npm package name doesn't affect functionality. Will be corrected when relevant.

---

## Decision 003: Turbopack Root Warning

**Date:** 2025-01-XX
**Context:** Next.js 16 detects a `package-lock.json` in `C:\Users\pwalk\` and infers that as workspace root.
**Decision:** Ignore the warning for now. It doesn't affect builds. The `turbopack.root` config option can be set if it causes issues later.

---
