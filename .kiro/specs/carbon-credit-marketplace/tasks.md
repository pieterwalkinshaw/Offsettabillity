# Implementation Plan: Carbon Credit Marketplace

## Overview

This plan implements the Carbon Credit Marketplace for the Offsettable platform, enabling funders to purchase verified carbon credits from solar projects with PDF certificates and a sustainability dashboard. Implementation follows the ordering: shared types/schemas → Cloud Functions → Firestore rules/indexes → Frontend pages → Seed scripts → Integration tests.

## Tasks

- [x] 1. Shared types, schemas, and utility functions
  - [x] 1.1 Add carbon credit types to `shared/types.ts`
    - Add `CreditInventory`, `CreditPackage`, `CreditPackageTier`, `PurchaseTransaction`, `PurchaseTransactionStatus`, `ProjectAllocation`, and `Certificate` interfaces
    - Add `CreditPurchaseRequest` and `CreditPackageInput` request types
    - _Requirements: 1.1, 1.2, 2.4, 3.1, 4.5, 5.2_

  - [x] 1.2 Add Zod validation schemas to `shared/schemas.ts`
    - Add `CreditPurchaseSchema` with quantity validation (positive, max 2 decimal places, min 1)
    - Add `CreditPackageSchema` for admin package CRUD
    - Add `ExportDateRangeSchema` with start < end refinement
    - _Requirements: 2.1, 2.3, 4.1, 7.1_

  - [x] 1.3 Create price calculation utility in `shared/creditUtils.ts`
    - Implement `calculatePurchasePrice(quantity, unitPriceCents, packageDiscount?)` returning integer cents
    - Implement `formatZAR(cents)` for display formatting
    - Implement `generateCertificateId()` producing 16-char alphanumeric IDs
    - _Requirements: 2.2, 3.2, 4.5, 5.6_

  - [x] 1.4 Write property tests for price calculation (Property 6)
    - **Property 6: Price calculation is quantity times unit price in integer cents**
    - Verify `calculatePurchasePrice` always returns `Math.round(quantity * unitPriceCents)` for any valid quantity and unit price
    - **Validates: Requirements 2.2, 4.5**

  - [x] 1.5 Write property tests for quantity validation (Property 5)
    - **Property 5: Quantity validation accepts only positive values with at most two decimal places within bounds**
    - Verify schema accepts valid quantities and rejects invalid ones using fast-check arbitraries
    - **Validates: Requirements 2.1, 2.3**

  - [x] 1.6 Write property tests for schema validation (Property 11)
    - **Property 11: Purchase schema validates structure correctly**
    - Verify `CreditPurchaseSchema` accepts valid inputs and rejects malformed inputs
    - **Validates: Requirements 4.1**

  - [x] 1.7 Write property test for tonnage precision (Property 3)
    - **Property 3: Tonnage stored with two-decimal precision**
    - Verify that all generated tonnage values satisfy `Math.round(value * 100) / 100 === value`
    - **Validates: Requirements 1.2**

  - [x] 1.8 Write property test for package discount calculation (Property 8)
    - **Property 8: Package discount calculation is consistent**
    - Verify discount percentage equals `Math.round((1 - priceCents / (tonnage * unitPriceCents)) * 100)`
    - **Validates: Requirements 3.2**

- [x] 2. Checkpoint - Ensure shared types and schemas compile cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Cloud Functions — Purchase processing
  - [x] 3.1 Create `functions/src/credits/purchase.ts` — `credits_purchase` onCall function
    - Verify caller has `funder` role
    - Validate input with `CreditPurchaseSchema`
    - Atomic Firestore transaction: read inventory, verify availability, decrement tonnage, create purchaseTransaction with status `pending`
    - Return `{ transactionId, status: 'pending' }` wrapped in `ApiResponse`
    - _Requirements: 1.3, 1.4, 2.4, 4.1, 4.2, 4.3, 4.4, 4.5, 9.1, 9.2, 9.3_

  - [x] 3.2 Create `functions/src/credits/confirmPurchase.ts` — `credits_confirmPurchase` onCall function
    - Verify caller has `admin` role
    - Update purchaseTransaction status to `confirmed`
    - Trigger certificate generation asynchronously
    - _Requirements: 4.2, 4.3, 4.6_

  - [x] 3.3 Create `functions/src/credits/generateCertificate.ts` — Firestore-triggered function
    - Trigger on purchaseTransactions document update where status changes to `confirmed`
    - Read transaction, funder, and project data
    - Generate unique certificate ID (16-char alphanumeric via `crypto.randomBytes`)
    - Render PDF using pdfkit with required layout (header, cert ID, funder details, offset details, project details, verification reference, footer)
    - Upload PDF to Cloud Storage at `certificates/{funderId}/{transactionId}.pdf`
    - Create `certificates` Firestore document with metadata
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 3.4 Create `functions/src/credits/packages.ts` — Admin package management functions
    - `credits_packageCreate` — admin creates a new CreditPackage (validated with `CreditPackageSchema`)
    - `credits_packageUpdate` — admin updates an existing package
    - `credits_packageDeactivate` — admin sets `isActive: false`
    - _Requirements: 3.3_

  - [x] 3.5 Create `functions/src/credits/exportCSV.ts` — `credits_exportCSV` onCall function
    - Verify caller has `funder` or `admin` role
    - Validate date range with `ExportDateRangeSchema`
    - Query confirmed purchases within range (funder sees own, admin sees all)
    - Generate CSV with columns: date, project title, tonnage, amount paid (ZAR), certificate ID
    - Return download URL or inline data
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 3.6 Create `functions/src/credits/exportPDF.ts` — `credits_exportPDF` onCall function
    - Verify caller has `funder` or `admin` role
    - Validate date range with `ExportDateRangeSchema`
    - Generate PDF report with pdfkit: organisation name, reporting period, total tonnage, per-project breakdown, certificate IDs list
    - Store in Cloud Storage, return download URL
    - _Requirements: 7.1, 7.3, 7.4_

  - [x] 3.7 Export all credit functions from `functions/src/index.ts`
    - Add exports for `credits_purchase`, `credits_confirmPurchase`, `credits_generateCertificate`, `credits_packageCreate`, `credits_packageUpdate`, `credits_packageDeactivate`, `credits_exportCSV`, `credits_exportPDF`
    - _Requirements: All_

  - [x] 3.8 Write property test for inventory decrement logic (Property 1)
    - **Property 1: Inventory decrement equals purchase quantity**
    - For any confirmed purchase of Q tons from project with T available (Q ≤ T), resulting tonnage = T − Q
    - **Validates: Requirements 1.3, 4.3**

  - [x] 3.9 Write property test for insufficient inventory rejection (Property 2)
    - **Property 2: Insufficient inventory rejects purchase and preserves stock**
    - For any purchase where quantity > available tonnage, system rejects with INSUFFICIENT_INVENTORY and tonnage unchanged
    - **Validates: Requirements 1.4, 4.4**

  - [x] 3.10 Write property test for role-based access control (Property 19)
    - **Property 19: Role-based access control enforces funder-only purchases**
    - Unauthenticated → UNAUTHENTICATED, non-funder → PERMISSION_DENIED, funder → allowed
    - **Validates: Requirements 9.1, 9.2, 9.3**

- [x] 4. Checkpoint - Ensure Cloud Functions compile and unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Firestore security rules and indexes
  - [x] 5.1 Update `firestore.rules` with carbon credit collection rules
    - Add rules for `creditInventory` (read: authenticated, write: denied — functions only)
    - Add rules for `creditPackages` (read: authenticated, write: denied — functions only)
    - Add rules for `purchaseTransactions` (read: own funderId or admin, write: denied)
    - Add rules for `certificates` (read: own funderId or admin, write: denied)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 5.5_

  - [x] 5.2 Update `firestore.indexes.json` with composite indexes
    - Add index on `purchaseTransactions` (funderId ASC, status ASC, createdAt DESC)
    - Add index on `purchaseTransactions` (funderId ASC, createdAt DESC)
    - Add index on `creditInventory` (availableTonnage DESC)
    - Add index on `creditPackages` (isActive ASC, sortOrder ASC)
    - _Requirements: 6.2, 6.3, 3.4_

  - [x] 5.3 Write property test for data isolation (Property 20)
    - **Property 20: Data isolation — funders see only own records, admins see all**
    - Verify security rules allow funder access only to own funderId documents, admin access to all
    - **Validates: Requirements 9.4, 9.5, 5.5, 7.4**

- [x] 6. Frontend — Marketplace page
  - [x] 6.1 Create marketplace page at `src/app/(dashboard)/credits/page.tsx`
    - Display hero section with total available credits aggregated across all projects
    - Display credit package cards (Bronze, Silver, Gold) with tonnage, discount %, total price (formatted ZAR)
    - Custom quantity input with real-time price calculation using `calculatePurchasePrice`
    - Project allocation selector for choosing credit source
    - Purchase CTA button with confirmation flow
    - Implement all five UI states: loading (skeleton), empty (no inventory), loaded, error (retry)
    - Use query params for view state: `?view=packages`, `?view=custom`, `?view=confirm&txn={id}`
    - _Requirements: 1.5, 2.1, 2.2, 3.1, 3.2, 3.4, 3.5, 4.6, 8.2, 8.4_

  - [x] 6.2 Write unit tests for Marketplace page
    - Test loading, empty, loaded, and error states render correctly
    - Test package cards display correct discount info
    - Test custom quantity input validates bounds and precision
    - Test disabled packages when inventory insufficient
    - _Requirements: 2.1, 3.4, 3.5_

  - [x] 6.3 Write property test for total available credits aggregation (Property 4)
    - **Property 4: Total available credits equals sum of individual inventories**
    - Verify aggregation logic sums all `availableTonnage > 0` values correctly
    - **Validates: Requirements 1.5**

  - [x] 6.4 Write property test for active package filtering (Property 9)
    - **Property 9: Only active packages are displayed**
    - Verify only packages with `isActive === true` appear in listing
    - **Validates: Requirements 3.4**

  - [x] 6.5 Write property test for package disable logic (Property 10)
    - **Property 10: Packages disabled when inventory insufficient**
    - Verify packages where `package.tonnage > totalAvailableInventory` are disabled
    - **Validates: Requirements 3.5**

- [x] 7. Frontend — Purchase confirmation and sustainability dashboard
  - [x] 7.1 Create purchase confirmation view at `src/app/(dashboard)/credits/page.tsx` (confirm view)
    - Full-page confirmation with purchase summary (tonnage, price, date)
    - Project allocation breakdown
    - Certificate download link (shown once generated)
    - "Return to Dashboard" and "View Sustainability Dashboard" CTAs
    - _Requirements: 4.6, 5.5_

  - [x] 7.2 Create sustainability dashboard at `src/app/(dashboard)/credits/sustainability/page.tsx`
    - Summary cards: total CO₂e offset, number of purchases, total spent (formatted ZAR)
    - Timeline chart (Recharts AreaChart): monthly offset over trailing 12 months
    - Per-project breakdown table: project title, location, tonnage, % of total
    - Certificates list: date, certificate ID, tonnage, download link
    - Export controls: date range picker + CSV/PDF export buttons
    - Implement all five UI states: loading, empty (zero purchases → CTA to marketplace), loaded, error
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3_

  - [x] 7.3 Write property test for total offset aggregation (Property 14)
    - **Property 14: Total offset aggregation equals sum of confirmed purchase tonnages**
    - Verify total CO₂e equals sum of `quantity` across all `status === 'confirmed'` transactions
    - **Validates: Requirements 6.1**

  - [x] 7.4 Write property test for monthly offset bucketing (Property 15)
    - **Property 15: Monthly offset bucketing groups purchases correctly**
    - Verify purchases grouped into correct calendar months and monthly sums equal total offset
    - **Validates: Requirements 6.2**

  - [x] 7.5 Write property test for per-project breakdown (Property 16)
    - **Property 16: Per-project breakdown sums to total offset**
    - Verify per-project tonnage breakdown sums to same total as overall CO₂e offset
    - **Validates: Requirements 6.3**

- [x] 8. Frontend — Dashboard integration and admin page
  - [x] 8.1 Update `DashboardSidebar.tsx` with Carbon Credits navigation
    - Add "Carbon Credits" nav item with Leaf icon for funder role, linking to `/credits`
    - Add "Credit Inventory" nav item with Leaf icon for admin role, linking to `/admin/credits`
    - _Requirements: 8.1_

  - [x] 8.2 Create `CarbonOffsetSummaryCard` component for funder overview page
    - Display total CO₂e offset and purchase count
    - Add to funder dashboard overview alongside existing funding metrics
    - _Requirements: 8.3_

  - [x] 8.3 Create admin credit management page at `src/app/(dashboard)/admin/credits/page.tsx`
    - Inventory overview: per-project available tonnage listing
    - Package management: create/edit/deactivate credit packages
    - Transaction list: all purchases with status management (confirm/reject)
    - _Requirements: 3.3, 9.4_

- [x] 9. Checkpoint - Ensure frontend builds successfully with `next build`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Seed script and integration tests
  - [x] 10.1 Create `scripts/seed-carbon-credits.ts`
    - Follow existing `--prod` flag pattern for emulator vs production targeting
    - Seed credit inventory records for existing solar projects (SunRise Credits: 11 tons, Solar Schools: 156 tons)
    - Seed three active credit packages (Bronze: 5 tons, Silver: 25 tons, Gold: 100 tons) + one inactive Platinum
    - Seed two sample purchase transactions (one confirmed, one pending)
    - Seed one sample certificate for the confirmed transaction
    - Use unit price of R150/ton (15000 cents)
    - _Requirements: 1.1, 3.1, 3.3_

  - [x] 10.2 Write property test for CSV export content (Property 17)
    - **Property 17: CSV export contains all required columns with correct data**
    - Verify CSV contains correct row count and columns: date, project title, tonnage, amount paid, certificate ID
    - **Validates: Requirements 7.2**

  - [x] 10.3 Write property test for PDF export content (Property 18)
    - **Property 18: PDF export contains all required sections**
    - Verify PDF report contains organisation name, reporting period, total tonnage, per-project breakdown, certificate IDs
    - **Validates: Requirements 7.3**

  - [x] 10.4 Write property test for certificate fields (Property 12)
    - **Property 12: Certificate contains all required fields**
    - Verify generated certificate contains: unique ID (≥12 alphanumeric chars), purchase date, funder org name, tonnage, project title, project location, verification reference
    - **Validates: Requirements 5.2, 5.6**

  - [x] 10.5 Write property test for certificate storage path (Property 13)
    - **Property 13: Certificate storage path follows convention**
    - Verify path equals `certificates/{funderId}/{transactionId}.pdf` for any funderId/transactionId combination
    - **Validates: Requirements 5.3, 5.4**

  - [x] 10.6 Write integration tests for purchase transaction flow
    - Test full purchase flow: validate → decrement inventory → create transaction → confirm → generate certificate
    - Test atomic transaction behaviour: failed purchase preserves inventory
    - Test concurrent purchases respect inventory limits
    - _Requirements: 1.3, 4.2, 4.3, 4.4, 5.1_

- [x] 11. Final checkpoint - Ensure all tests pass and project builds
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using Vitest + fast-check
- Unit tests validate specific examples and edge cases
- All monetary values use ZAR integer cents throughout
- Implementation language: TypeScript (matching existing codebase)
- Frontend uses query params for state management consistent with static export architecture
- Cloud Functions use v2 `onCall` pattern consistent with existing codebase

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "1.5", "1.6", "1.7", "1.8"] },
    { "id": 2, "tasks": ["3.1", "3.4"] },
    { "id": 3, "tasks": ["3.2", "3.5", "3.6", "3.7"] },
    { "id": 4, "tasks": ["3.3", "3.8", "3.9", "3.10"] },
    { "id": 5, "tasks": ["5.1", "5.2"] },
    { "id": 6, "tasks": ["5.3", "6.1"] },
    { "id": 7, "tasks": ["6.2", "6.3", "6.4", "6.5", "7.1"] },
    { "id": 8, "tasks": ["7.2", "8.1", "8.2", "8.3"] },
    { "id": 9, "tasks": ["7.3", "7.4", "7.5"] },
    { "id": 10, "tasks": ["10.1"] },
    { "id": 11, "tasks": ["10.2", "10.3", "10.4", "10.5", "10.6"] }
  ]
}
```
