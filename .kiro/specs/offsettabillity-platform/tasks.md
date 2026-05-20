# Implementation Plan: Offsettabillity Platform

## Overview

This plan implements the Offsettabillity verified ESG impact project funding platform using Next.js 16 (App Router) with Firebase backend. The implementation follows an incremental approach: shared foundations first, then core domain modules (auth, projects, verification, funding, leads), followed by public-facing pages and dashboards, and finally integration wiring.

## Tasks

- [x] 1. Set up project structure, shared types, and validation schemas
  - [x] 1.1 Create shared types and Zod validation schemas
    - Create `shared/types.ts` with all TypeScript interfaces (User, Project, TaxonomyCategory, Audit, Lead, FundingTransaction, Report, enums for roles, statuses, badges)
    - Create `shared/schemas.ts` with all Zod schemas (LeadCreateSchema, ProjectCreateSchema, AuditSubmitSchema, FundingCreateSchema, RegistrationSchema, TaxonomyCategorySchema)
    - Ensure schemas match the interface contracts defined in the design document
    - _Requirements: 1.1, 2.1, 3.1, 4.3, 5.1, 6.1_

  - [x] 1.2 Set up Firebase project configuration and emulator support
    - Create `firebase.json` with hosting rewrites, functions config, emulator ports
    - Create `.firebaserc` with project aliases
    - Create `.env.example` documenting all required environment variables
    - Update `src/lib/firebase/config.ts` to connect to emulators when `NEXT_PUBLIC_USE_EMULATORS=true`
    - _Requirements: 13.1_

  - [x] 1.3 Set up Cloud Functions project structure
    - Create `functions/` directory with `package.json`, `tsconfig.json`
    - Configure Node.js 20 runtime with TypeScript
    - Set up shared schema imports from `shared/` directory
    - Create function entry point `functions/src/index.ts`
    - _Requirements: 13.4_

  - [x] 1.4 Write property tests for registration validation (Property 1)
    - **Property 1: Registration validation and user document creation**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.7**
    - Use fast-check to generate valid/invalid registration inputs across all roles
    - Verify valid inputs create correct user documents; invalid inputs return field-specific errors

  - [x] 1.5 Write property tests for project creation invariants (Property 5)
    - **Property 5: Project creation invariants**
    - **Validates: Requirements 2.1, 2.2, 2.8**
    - Use fast-check to generate valid/invalid project inputs
    - Verify created projects have verificationStatus="draft", badge="None", fundingRaised=0

- [x] 2. Implement user registration and authentication
  - [x] 2.1 Create registration Cloud Function with role-based fields
    - Implement `functions/src/auth/register.ts` using Firebase Admin SDK
    - Validate input with RegistrationSchema (Zod)
    - Create Firebase Auth account and Firestore user document in transaction
    - Handle role-specific fields (Funder: org name/type/industry/interests; Owner: org name/reg number/type; Auditor: qualifications/experience/specializations + set isApproved=false)
    - Implement orphaned auth account cleanup on Firestore write failure
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.9_

  - [x] 2.2 Implement UTM capture hook and session persistence
    - Create `src/lib/hooks/useUtmCapture.ts` to capture UTM params from URL on landing
    - Persist UTM params in sessionStorage for the browser session duration
    - Attach UTM params to registration and lead capture events
    - _Requirements: 1.8, 10.4_

  - [x] 2.3 Build registration page with role-based form
    - Create `src/app/(auth)/register/page.tsx` with multi-step wizard
    - Implement role selection (Funder, Owner, Auditor) with conditional fields
    - Add client-side Zod validation with inline error messages
    - Handle duplicate email error display while preserving form data
    - Include CV upload for Auditors (PDF/DOCX, max 5 MB)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7_

  - [x] 2.4 Implement AuthContext and login flow
    - Update `src/lib/auth/AuthContext.tsx` with Firebase Auth state management
    - Implement login page at `src/app/(auth)/login/page.tsx`
    - Add role-based route protection middleware
    - Implement token refresh handling
    - _Requirements: 13.4, 13.5_

  - [x] 2.5 Write property test for auditor approval gate (Property 2)
    - **Property 2: Auditor approval gate**
    - **Validates: Requirements 1.5**
    - Verify unapproved auditors are denied access to audit browsing/application endpoints

  - [x] 2.6 Write property test for UTM preservation on registration (Property 3)
    - **Property 3: UTM parameter preservation on registration**
    - **Validates: Requirements 1.8**
    - Verify UTM values from session are stored in user document on successful registration

  - [x] 2.7 Write property test for orphaned auth cleanup (Property 4)
    - **Property 4: Orphaned auth account cleanup**
    - **Validates: Requirements 1.9**
    - Verify auth account is deleted when Firestore document write fails

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement taxonomy management
  - [x] 4.1 Create taxonomy Cloud Functions (create, update, deactivate)
    - Implement `functions/src/admin/taxonomy.ts` with `taxonomy_create` and `taxonomy_update` callable functions
    - Validate with TaxonomyCategorySchema (Zod)
    - Enforce unique ID constraint across active and inactive categories
    - Implement deactivation (set isActive=false, prevent new project selection)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.2 Seed initial taxonomy categories
    - Create `scripts/seed-taxonomy.ts` to populate the 12 initial categories (energy-saving, renewable-energy, carbon-removal, education, health, food-security, clean-water, waste-management, biodiversity, housing, digital-inclusion, gender-equality)
    - Include primaryMetricLabel, sdgNumbers, icon, and sortOrder for each
    - _Requirements: 3.6_

  - [x] 4.3 Build admin taxonomy management page
    - Update `src/app/dashboard/admin/taxonomy/page.tsx` with CRUD interface
    - Display categories with sort order, active status, and edit/deactivate actions
    - Show inline validation errors on create/update failures
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.4 Write property test for taxonomy uniqueness and validation (Property 9)
    - **Property 9: Taxonomy category uniqueness and validation**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Use fast-check to generate random category inputs with duplicate IDs
    - Verify unique IDs accepted, duplicates rejected with field-specific errors

  - [x] 4.5 Write property test for category deactivation (Property 10)
    - **Property 10: Category deactivation preserves existing projects**
    - **Validates: Requirements 3.4**
    - Verify deactivated categories block new project selection but existing projects retain category data

- [x] 5. Implement project listing and onboarding
  - [x] 5.1 Create project Cloud Functions (create, update, submit)
    - Implement `functions/src/projects/create.ts` — validate with ProjectCreateSchema, set verificationStatus="draft", badge="None", fundingRaised=0
    - Implement `functions/src/projects/update.ts` — enforce edit permissions by status (all fields editable in draft; title/category/fundingGoal immutable after submission)
    - Implement `functions/src/projects/submit.ts` — require at least one document, transition status to "submitted"
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8_

  - [x] 5.2 Implement document upload with validation
    - Create `functions/src/projects/uploadDocument.ts` or handle via client SDK + Cloud Storage rules
    - Validate file type (PDF, PNG, JPEG only), file size (≤ 5 MB), document count (max 10 per project)
    - Store files at `projects/{projectId}/documents/` in Cloud Storage
    - On failure, retain existing documents unchanged and return specific error reason
    - _Requirements: 2.6, 2.9_

  - [x] 5.3 Build project creation wizard page
    - Create `src/app/(dashboard)/projects/new/page.tsx` with multi-step form
    - Category selection from active taxonomy with dynamic primary metric label
    - Location input with country selection (ISO 3166-1 alpha-2)
    - Funding goal input (display as ZAR, store as integer cents)
    - Document upload section with drag-and-drop, file type/size validation
    - Client-side Zod validation with inline errors
    - _Requirements: 2.1, 2.6, 3.7_

  - [x] 5.4 Write property test for project edit permissions (Property 6)
    - **Property 6: Project edit permissions by status**
    - **Validates: Requirements 2.4, 2.5**
    - Generate projects in various statuses with edit attempts on different fields

  - [x] 5.5 Write property test for document upload validation (Property 7)
    - **Property 7: Document upload validation**
    - **Validates: Requirements 2.6, 2.9**
    - Generate random file metadata (type, size, count) and verify acceptance/rejection

  - [x] 5.6 Write property test for project submission status transition (Property 8)
    - **Property 8: Project status transition on submission**
    - **Validates: Requirements 2.3, 2.7**
    - Verify draft projects with documents transition to "submitted"; projects without documents are rejected

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement verification system
  - [x] 7.1 Implement verification score calculation and badge determination
    - Create `src/lib/verification/score.ts` with `calculateVerificationScore` function using weighted components (doc: 0.20, audit: 0.40, methodology: 0.20, compliance: 0.20)
    - Create `src/lib/verification/badge.ts` with `determineBadge` function (None → Verified → Verified+ → Premium Assured)
    - Implement sub-score calculators (documentation, audit, methodology, compliance)
    - _Requirements: 4.4, 4.5, 4.6, 4.8_

  - [x] 7.2 Create audit workflow Cloud Functions
    - Implement `functions/src/admin/prescreenProject.ts` — transition project from "submitted" to "prescreened"
    - Implement `functions/src/admin/assignAudit.ts` — create Audit record with status "pending", enforce conflict of interest rules, notify auditor
    - Implement `functions/src/audits/submit.ts` — validate AuditSubmitSchema, transition audit to "completed", recalculate project verification score and badge
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 7.3 Write property test for verification badge determination (Property 11)
    - **Property 11: Verification badge determination**
    - **Validates: Requirements 4.4, 4.5, 4.6**
    - Generate random audit counts and scores, verify correct badge assignment

  - [x] 7.4 Write property test for verification score calculation (Property 12)
    - **Property 12: Verification score weighted calculation**
    - **Validates: Requirements 4.8**
    - Generate random component scores, verify weighted sum equals expected result (0–100)

  - [x] 7.5 Write property test for auditor conflict of interest (Property 13)
    - **Property 13: Auditor conflict of interest prevention**
    - **Validates: Requirements 4.7**
    - Generate random auditor-project relationship pairs, verify conflicts are rejected

  - [x] 7.6 Write property test for audit submission effects (Property 14)
    - **Property 14: Audit submission completes audit and recalculates score**
    - **Validates: Requirements 4.3**
    - Verify audit status transitions to "completed" and project score is recalculated

- [x] 8. Implement funding service
  - [x] 8.1 Create funding Cloud Functions
    - Implement `functions/src/funding/create.ts` — validate FundingCreateSchema, enforce eligibility (project must be "verified" or "live"), create FundingTransaction with status "pending"
    - Implement `functions/src/funding/confirmPayment.ts` — update transaction to "confirmed", increment project fundingRaised by confirmed amount (integer cents)
    - Implement `functions/src/funding/failPayment.ts` — update transaction to "failed", do NOT modify fundingRaised
    - Implement funding goal threshold check — transition project to "funded" when fundingRaised ≥ fundingGoal
    - Implement concentration notification — trigger admin alert when single funder exceeds 50% of fundingGoal
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 5.9_

  - [x] 8.2 Write property test for funding eligibility (Property 15)
    - **Property 15: Funding eligibility enforcement**
    - **Validates: Requirements 5.1, 5.2**
    - Generate random projects (various statuses) + amounts, verify only verified/live projects accept funding

  - [x] 8.3 Write property test for payment effects on fundingRaised (Property 16)
    - **Property 16: Payment confirmation effects on fundingRaised**
    - **Validates: Requirements 5.4, 5.5**
    - Verify confirmed payments increment fundingRaised; failed payments leave it unchanged

  - [x] 8.4 Write property test for funding goal threshold (Property 17)
    - **Property 17: Funding goal threshold triggers status transition**
    - **Validates: Requirements 5.6, 5.9**
    - Generate projects near funding goal, verify status transitions to "funded" when threshold met

  - [x] 8.5 Write property test for funding concentration notification (Property 18)
    - **Property 18: Funding concentration notification**
    - **Validates: Requirements 5.8**
    - Verify admin notification triggered when single funder exceeds 50% of fundingGoal

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement lead capture system
  - [x] 10.1 Create lead capture Cloud Function (public HTTP endpoint)
    - Implement `functions/src/leads/create.ts` as onRequest POST `/api/leads`
    - Validate with LeadCreateSchema (Zod) — require email (RFC 5322, max 254) and lead type
    - Implement rate limiting (5 requests per IP per 60-second sliding window)
    - Implement honeypot field detection (silently discard if honeypot non-empty)
    - Store lead with status="new", all provided fields, UTM params, marketingConsent, timestamp
    - Trigger async admin notification (defer to background)
    - Return success within 200ms target
    - Create duplicate leads for same email+type (no deduplication)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11_

  - [x] 10.2 Create lead management Cloud Function (admin)
    - Implement `functions/src/leads/update.ts` — admin-only callable to update lead status and notes
    - Restrict status transitions to: new, contacted, qualified, converted, lost
    - Record change timestamp
    - _Requirements: 6.4_

  - [x] 10.3 Write property test for lead capture validation (Property 19)
    - **Property 19: Lead capture validation and storage**
    - **Validates: Requirements 6.1, 6.3, 6.7, 6.8**
    - Generate random valid/invalid lead inputs, verify correct storage and rejection behavior

  - [x] 10.4 Write property test for lead status transitions (Property 20)
    - **Property 20: Lead status transitions**
    - **Validates: Requirements 6.4**
    - Verify only valid status values accepted; invalid values rejected

  - [x] 10.5 Write property test for marketing consent enforcement (Property 21)
    - **Property 21: Marketing consent enforcement**
    - **Validates: Requirements 6.9, 12.5**
    - Verify leads without consent are stored but not sent marketing communications

  - [x] 10.6 Write property test for duplicate lead creation (Property 22)
    - **Property 22: Duplicate lead creation**
    - **Validates: Requirements 6.10**
    - Verify same email+type creates new record rather than rejecting or updating

  - [x] 10.7 Write property test for rate limiting (Property 23)
    - **Property 23: Rate limiting on lead capture**
    - **Validates: Requirements 6.11, 13.6, 13.7**
    - Generate random IP sequences with timestamps, verify rate limit enforcement

  - [x] 10.8 Write property test for honeypot detection (Property 40)
    - **Property 40: Honeypot bot detection**
    - **Validates: Requirements 13.8**
    - Generate random submissions with/without honeypot values, verify silent discard behavior

- [x] 11. Implement ESG calculator widget
  - [x] 11.1 Build ESG calculator component and allocation logic
    - Create `src/components/marketing/ESGCalculator.tsx` with industry selection and budget input
    - Implement allocation logic in `src/lib/calculator/allocate.ts` — distribute budget across active categories (percentage breakdowns summing to 100%, at least 3 categories)
    - Display results within 1 second without requiring personal information
    - Gate detailed report behind email input with format validation
    - On email submission, capture lead of type "calculator" with industry and budget
    - Mobile-responsive single-column layout below 640px
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 11.2 Write property test for ESG calculator allocation (Property 24)
    - **Property 24: ESG calculator allocation output**
    - **Validates: Requirements 7.1, 7.2**
    - Generate random industry + budget combinations, verify total equals input and percentages sum to 100%

  - [x] 11.3 Write property test for calculator input validation (Property 25)
    - **Property 25: Calculator input validation**
    - **Validates: Requirements 7.6**
    - Verify empty industry or out-of-range budget displays errors and produces no result

- [x] 12. Implement Firestore security rules
  - [x] 12.1 Write Firestore security rules
    - Create `firestore.rules` implementing role-based access control for all collections
    - Users: read own + admin reads all; write own profile
    - Projects: public read for verified+; owner write for drafts; admin full access
    - Audits: assigned auditor + project owner + admin read; admin create; assigned auditor + admin update
    - Leads: admin only (public writes via Cloud Function)
    - Taxonomy: public read; admin write
    - Funding: funder + project owner + admin read; funder create; admin update
    - Reports: access-level based (public/gated/private)
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 12.2 Write property test for RBAC enforcement (Property 38)
    - **Property 38: Role-based access control enforcement**
    - **Validates: Requirements 13.1, 13.2, 13.3**
    - Generate random role + resource + operation combinations, verify correct allow/deny

  - [x] 12.3 Write property test for token validation (Property 39)
    - **Property 39: Token validation on callable endpoints**
    - **Validates: Requirements 13.4, 13.5**
    - Verify expired/malformed tokens are rejected with UNAUTHENTICATED error

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement public project discovery pages
  - [x] 14.1 Build public project listing page
    - Create `src/app/(public)/projects/page.tsx` with SSG
    - Display only projects with verificationStatus "verified", "live", or "funded"
    - Sort by most recently verified first
    - Implement pagination (25 per page, max 100)
    - Add category filter (display only matching projects)
    - Show empty state with illustration when no projects match filter
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 14.2 Build project card component
    - Create `src/components/projects/ProjectCard.tsx`
    - Display: title (truncated to one line), category name, verification badge, funding progress (raised vs goal), primary impact metric (label + value), location country
    - Mobile-responsive (stack vertically on mobile)
    - _Requirements: 8.4_

  - [x] 14.3 Build project detail page
    - Create `src/app/(public)/projects/[id]/page.tsx`
    - Display full description, impact metrics with reporting period, audit history (findings + recommendation per audit), funding progress (raised vs goal with percentage), ESP qualification status
    - Show "verification in progress" notice if no completed audits
    - Include funding CTA for authenticated funders
    - Display total funding publicly; individual funder amounts only to owner/admin
    - _Requirements: 8.5, 8.6, 5.7_

  - [x] 14.4 Write property test for public listing status filter (Property 26)
    - **Property 26: Public project listing status filter**
    - **Validates: Requirements 8.1**
    - Generate random projects with various statuses, verify only verified/live/funded appear

  - [x] 14.5 Write property test for category filter correctness (Property 27)
    - **Property 27: Category filter correctness**
    - **Validates: Requirements 8.2**
    - Verify filtered results only contain projects matching selected category

  - [x] 14.6 Write property test for project card required fields (Property 28)
    - **Property 28: Project card required fields**
    - **Validates: Requirements 8.4**
    - Verify all required fields are present in rendered project card output

- [x] 15. Implement Google Ads landing pages and homepage
  - [x] 15.1 Build category landing pages with static generation
    - Create `src/app/(public)/categories/[id]/page.tsx` with `generateStaticParams` for all active categories
    - Include: category-relevant headline, trust signals (badges, stats), primary CTA (lead form or calculator), 3–6 featured projects, secondary CTA (consultation)
    - Return 404 for inactive or nonexistent category IDs
    - Supplement with primary CTA if fewer than 3 featured projects
    - Target LCP < 2.5s via static generation
    - _Requirements: 10.1, 10.2, 10.3, 10.7, 10.8_

  - [x] 15.2 Build homepage with hero, calculator, and featured projects
    - Create `src/app/(public)/page.tsx` (or update existing `src/app/page.tsx`)
    - Include hero section with primary CTA above the fold
    - Embed ESG Calculator widget visible in initial viewport
    - Display featured verified projects
    - Trust signals (platform statistics, verification badges)
    - Mobile-first responsive layout (single-column below 640px)
    - _Requirements: 7.4, 10.5, 10.6_

  - [x] 15.3 Implement shared layout components (Header, Footer, lead forms)
    - Update `src/components/layout/Header.tsx` with sticky header and primary CTA button visible without scrolling
    - Update `src/components/layout/Footer.tsx` with newsletter signup and trust badges
    - Create `src/components/forms/LeadCaptureForm.tsx` reusable component with honeypot field, consent checkbox (unchecked by default), UTM attachment
    - Create `src/components/forms/ConsultationForm.tsx` for secondary CTAs
    - _Requirements: 10.5, 6.8, 13.8_

  - [x] 15.4 Write property test for category landing page existence (Property 31)
    - **Property 31: Category landing page existence**
    - **Validates: Requirements 10.1, 10.8**
    - Verify active categories have pages at `/categories/{id}`; inactive/nonexistent return 404

  - [x] 15.5 Write property test for UTM session persistence (Property 32)
    - **Property 32: UTM session persistence and attachment**
    - **Validates: Requirements 10.4**
    - Verify UTM params persisted for session and attached to subsequent lead/registration events

- [x] 16. Implement impact reporting
  - [x] 16.1 Create report generation Cloud Function
    - Implement `functions/src/reports/generate.ts` — produce PDF within 30 seconds
    - Include: project title, category, location, funding goal/raised, verification badge/score, full audit trail, impact metrics, ESP qualification, SDG alignment, funder contribution summary
    - Implement access levels: public (all users), gated (email required → lead capture), private (funder + admin only)
    - Never produce partial reports on failure; return error with reason
    - Handle projects with no completed audits (include notice)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 16.2 Write property test for report content completeness (Property 29)
    - **Property 29: Report content completeness**
    - **Validates: Requirements 9.1, 9.4, 9.5**
    - Verify generated reports contain all required fields

  - [x] 16.3 Write property test for report access level enforcement (Property 30)
    - **Property 30: Report access level enforcement**
    - **Validates: Requirements 9.2, 9.3**
    - Verify public/gated/private access levels are correctly enforced

- [x] 17. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Implement role-based dashboards
  - [x] 18.1 Build funder dashboard
    - Create `src/app/(dashboard)/overview/page.tsx` with role-based rendering
    - Funder view: funded projects (up to 25, paginated), total impact contribution (sum of confirmed funding in ZAR cents), up to 10 verified projects matching ESG profile interests not yet funded
    - Implement skeleton loading states and empty state illustrations
    - Inline error with retry action per section on data fetch failure
    - _Requirements: 11.1, 11.6, 11.7, 11.8_

  - [x] 18.2 Build project owner dashboard
    - Owner view: projects with verification status/badge, funding progress (% of goal), pending actions (drafts needing submission, submitted awaiting pre-screening, unresolved audit findings)
    - Skeleton loading states and empty state ("No projects yet. Submit your first.")
    - Inline error with retry per section
    - _Requirements: 11.2, 11.6, 11.7, 11.8_

  - [x] 18.3 Build auditor dashboard
    - Auditor view: assigned audits (pending/in_progress), available projects matching specializations with no conflict of interest, completed audits (up to 25, paginated)
    - Skeleton loading states and empty state illustrations
    - Inline error with retry per section
    - _Requirements: 11.3, 11.6, 11.7, 11.8_

  - [x] 18.4 Build admin dashboard
    - Admin view: pending auditor approvals (isApproved=false), projects awaiting pre-screening (status="submitted"), lead pipeline summary (grouped by status with counts), platform metrics (users by role, projects by status, total funding raised, leads this month)
    - Skeleton loading states and empty state illustrations
    - Inline error with retry per section
    - _Requirements: 11.4, 11.6, 11.7, 11.8_

  - [x] 18.5 Implement role-based navigation and route protection
    - Create dashboard sidebar with role-based menu items (only show permitted capabilities)
    - Implement route guards that redirect unauthorized users
    - _Requirements: 11.5_

  - [x] 18.6 Write property test for funder dashboard data (Property 33)
    - **Property 33: Role-based dashboard data — Funder**
    - **Validates: Requirements 11.1**
    - Verify funder sees funded projects, total contribution, and matching recommendations

  - [x] 18.7 Write property test for owner dashboard data (Property 34)
    - **Property 34: Role-based dashboard data — Owner**
    - **Validates: Requirements 11.2**
    - Verify owner sees projects with status/badge, funding progress, and pending actions

  - [x] 18.8 Write property test for auditor dashboard data (Property 35)
    - **Property 35: Role-based dashboard data — Auditor**
    - **Validates: Requirements 11.3**
    - Verify auditor sees assigned audits, available projects, and completed audits

  - [x] 18.9 Write property test for role-based navigation (Property 36)
    - **Property 36: Role-based navigation restriction**
    - **Validates: Requirements 11.5**
    - Verify navigation only shows items permitted by user's role

- [x] 19. Implement data privacy and compliance
  - [x] 19.1 Implement cookie consent banner
    - Create `src/components/ui/CookieConsent.tsx` with accept all / reject non-essential / customize options
    - Allow essential cookies without consent; block analytics/marketing until consent given
    - Persist preference for minimum 6 months before re-prompting
    - _Requirements: 12.1, 12.7_

  - [x] 19.2 Implement account deletion with PII anonymization
    - Create `functions/src/auth/deleteAccount.ts` — replace PII fields (email, name, phone) with anonymized placeholders within 30 days
    - Retain non-PII data for platform integrity
    - Add account settings page with deletion request option
    - _Requirements: 12.2_

  - [x] 19.3 Implement PII exclusion from logs and consent management
    - Configure Cloud Functions logging to exclude PII fields (email, name, phone)
    - Implement marketing consent withdrawal via account settings (update within 24 hours)
    - Ensure lead forms include consent checkbox with privacy policy link
    - _Requirements: 12.3, 12.4, 12.5, 12.6_

  - [x] 19.4 Write property test for PII anonymization (Property 37)
    - **Property 37: PII anonymization on account deletion**
    - **Validates: Requirements 12.2**
    - Verify PII fields are replaced with anonymized placeholders while non-PII data is retained

- [x] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Integration wiring and final assembly
  - [x] 21.1 Wire funding flow end-to-end
    - Connect project detail page funding CTA → funding Cloud Function → payment gateway redirect → confirmation callback → fundingRaised update
    - Display funding progress on project cards and detail pages
    - Show funding confirmation page with receipt
    - _Requirements: 5.1, 5.3, 5.4, 5.7_

  - [x] 21.2 Wire verification workflow end-to-end
    - Connect admin pre-screen action → auditor assignment → auditor submission → score recalculation → badge update → project status transition
    - Display verification badge on project cards and detail pages
    - Show audit trail on project detail page
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 21.3 Wire lead capture across all touchpoints
    - Connect ESG calculator email gate → lead capture function
    - Connect consultation forms → lead capture function
    - Connect gated report access → lead capture function
    - Connect newsletter signup → lead capture function
    - Ensure UTM params attached from session on all lead captures
    - Ensure honeypot field present on all public forms
    - _Requirements: 6.1, 6.2, 7.3, 9.3, 10.4, 13.8_

  - [x] 21.4 Wire admin lead management interface
    - Build admin leads page at `src/app/(dashboard)/leads/page.tsx`
    - Display leads grouped by status with counts
    - Allow status updates and notes (max 2000 chars)
    - _Requirements: 6.4_

  - [x] 21.5 Set up CI/CD pipeline with GitHub Actions
    - Create `.github/workflows/ci.yml` — on PR: install, typecheck, lint, build
    - Create `.github/workflows/deploy.yml` — on merge to main: build + deploy to Firebase Hosting, Cloud Functions, Firestore rules
    - _Requirements: 13.1_

  - [x] 21.6 Write integration tests for critical paths
    - Test full registration → login → dashboard flow (all roles)
    - Test project creation → submission → pre-screen → audit → verification → funding
    - Test lead capture from calculator → admin notification → lead management
    - Test UTM capture → lead form → attribution stored
    - _Requirements: 1.1, 2.1, 4.1, 5.1, 6.1, 10.4_

- [x] 22. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementation uses TypeScript with Zod for validation
- Financial values are stored as integer cents (ZAR) to avoid floating-point precision errors
- All Cloud Functions use Firebase Functions v2 (Gen 2) with Node.js 20 runtime
- Public pages use SSG for performance (LCP < 2.5s target); dashboard pages use CSR
- Firestore Security Rules enforce access control at the database level

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["2.1", "2.2", "4.1", "4.2", "12.1"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "2.6", "2.7", "4.3", "4.4", "4.5", "12.2", "12.3"] },
    { "id": 4, "tasks": ["5.1", "5.2", "7.1", "10.1", "10.2"] },
    { "id": 5, "tasks": ["5.3", "5.4", "5.5", "5.6", "7.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8"] },
    { "id": 6, "tasks": ["7.3", "7.4", "7.5", "7.6", "8.1", "11.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "8.4", "8.5", "11.2", "11.3"] },
    { "id": 8, "tasks": ["14.1", "14.2", "14.3"] },
    { "id": 9, "tasks": ["14.4", "14.5", "14.6", "15.1", "15.2", "15.3"] },
    { "id": 10, "tasks": ["15.4", "15.5", "16.1"] },
    { "id": 11, "tasks": ["16.2", "16.3", "18.1", "18.2", "18.3", "18.4", "18.5"] },
    { "id": 12, "tasks": ["18.6", "18.7", "18.8", "18.9", "19.1", "19.2", "19.3"] },
    { "id": 13, "tasks": ["19.4", "21.1", "21.2", "21.3", "21.4", "21.5"] },
    { "id": 14, "tasks": ["21.6"] }
  ]
}
```
