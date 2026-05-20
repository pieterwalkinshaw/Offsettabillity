# Changelog

All notable changes to the Offsettabillity platform are documented here.

---

## [Unreleased] — Pre-Implementation Cleanup

### Removed
- All prototype/mock source files (18 files total)
- Mock localStorage-based data layer (`projects.ts`, `taxonomy.ts`)
- Mock authentication context (role-selector without Firebase Auth)
- Hardcoded ESG dashboard components (ESGDashboard, ESGScorecard, ESGDeepDives, ESGRiskPanel)
- All mock page implementations (homepage, login, dashboard, projects, taxonomy admin)
- Mock layout components (Header, Footer)
- Next.js boilerplate SVG assets (5 files)
- `CLAUDE.md` (redundant)

### Changed
- `src/app/layout.tsx` — stripped to minimal root layout without mock imports
- `src/app/page.tsx` — replaced with minimal placeholder
- `.gitignore` — added Firebase, Cloud Functions, and log entries
- `next.config.ts` — reset to minimal config

### Added
- `.kiro/docs/DECISIONS.md` — architectural decision log
- `.kiro/docs/CHANGELOG.md` — this file
- `.kiro/docs/SESSION-LOG.md` — session interaction log

### Status
- Build passes cleanly (`npm run build` ✓)
- Single static route: `/`
- Ready for spec-driven implementation (Task 1.1 onwards)

---
