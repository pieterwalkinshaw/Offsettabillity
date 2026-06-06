# Design Document: Carbon Credit Marketplace

## Overview

The Carbon Credit Marketplace extends the existing Offsettable platform to enable funders to purchase verified carbon credits generated from solar installations. It introduces a credit inventory system, flexible and packaged purchasing options, per-purchase PDF certificates for ESG audit evidence, and a cumulative sustainability dashboard with export capabilities. The existing funder role is extended to support carbon credit purchases alongside existing funding activities.

## Architecture

The architecture follows established patterns: Firestore for data, Cloud Functions v2 for server-side logic, Next.js static export for the frontend, and shared Zod schemas for validation. New Firestore collections (`creditInventory`, `creditPackages`, `purchaseTransactions`, `certificates`) are added alongside new Cloud Functions for purchase processing and certificate generation.

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js Static Export)                                │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │Marketplace│  │Sustainability│  │  Purchase Confirmation  │   │
│  │   Page    │  │  Dashboard   │  │        Page             │   │
│  └─────┬────┘  └──────┬───────┘  └────────────┬────────────┘   │
└────────┼───────────────┼──────────────────────┼─────────────────┘
         │               │                      │
         ▼               ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloud Functions v2 (onCall)                                     │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐   │
│  │credits_purchase│ │credits_packages│ │credits_certificate │   │
│  └───────┬──────┘  └───────────────┘  └─────────┬──────────┘   │
└──────────┼───────────────────────────────────────┼──────────────┘
           │                                       │
           ▼                                       ▼
┌──────────────────────┐              ┌────────────────────────┐
│  Firestore           │              │  Cloud Storage          │
│  - creditInventory   │              │  certificates/          │
│  - creditPackages    │              │    {funderId}/          │
│  - purchaseTransactions│            │      {txnId}.pdf        │
│  - certificates      │              └────────────────────────┘
└──────────────────────┘
```

## Components and Interfaces

## Data Models

### New Firestore Collections

#### `creditInventory` Collection

Each document represents the available carbon credit stock for a single verified solar project.

```typescript
// shared/types.ts additions

export interface CreditInventory {
  inventoryId: string;           // Auto-generated document ID
  projectId: string;             // FK to Project.projectId
  availableTonnage: number;      // Metric tons CO₂e, 2 decimal places
  totalTonnage: number;          // Original tonnage (never decrements)
  unitPriceCents: number;        // Price per ton in ZAR integer cents
  projectTitle: string;          // Denormalized for read performance
  projectLocation: string;       // Denormalized (address string)
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
}
```

**Indexes required:**
- `projectId` (equality) for lookup by project
- Composite: `availableTonnage > 0` for marketplace display

#### `creditPackages` Collection

Predefined bundles with volume discounts managed by admin.

```typescript
export type CreditPackageTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface CreditPackage {
  packageId: string;             // Auto-generated document ID
  name: string;                  // Display name (e.g. "Bronze Package")
  tier: CreditPackageTier;       // Tier identifier for ordering
  tonnage: number;               // Metric tons in this package
  priceCents: number;            // Total package price in ZAR integer cents
  discountPercentage: number;    // Calculated: (1 - priceCents / (tonnage * unitPriceCents)) * 100
  isActive: boolean;             // Only active packages shown in marketplace
  sortOrder: number;             // Display ordering
  createdAt: string;
  updatedAt: string;
}
```

#### `purchaseTransactions` Collection

Records each carbon credit purchase. Mirrors the `FundingTransaction` status lifecycle.

```typescript
export type PurchaseTransactionStatus = 'pending' | 'confirmed' | 'failed' | 'refunded';

export interface PurchaseTransaction {
  transactionId: string;         // Auto-generated document ID
  funderId: string;              // FK to User.userId (role=funder)
  quantity: number;              // Metric tons purchased (2 decimal places)
  unitPriceCents: number;        // Price per ton at time of purchase
  totalAmountCents: number;      // Total in ZAR integer cents
  currency: string;              // ISO 4217, always "ZAR"
  status: PurchaseTransactionStatus;
  packageId?: string;            // FK to CreditPackage (if package purchase)
  projectAllocations: ProjectAllocation[];  // Which projects supply the credits
  certificateId?: string;        // FK to Certificate (set after generation)
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAllocation {
  projectId: string;
  projectTitle: string;          // Denormalized
  tonnage: number;               // Tons allocated from this project
}
```

#### `certificates` Collection

Metadata for generated PDF certificates stored in Cloud Storage.

```typescript
export interface Certificate {
  certificateId: string;         // Unique alphanumeric ID (≥12 chars)
  transactionId: string;         // FK to PurchaseTransaction
  funderId: string;              // FK to User.userId
  funderOrganisationName: string;// Denormalized from User
  tonnageOffset: number;         // Total tons on this certificate
  projectTitle: string;          // Primary project title
  projectLocation: string;       // Primary project location
  storagePath: string;           // Cloud Storage path: certificates/{funderId}/{transactionId}.pdf
  generatedAt: string;           // ISO 8601 timestamp
}
```

### Zod Schemas

```typescript
// shared/schemas.ts additions

import { z } from 'zod/v4';

// ─── Carbon Credit Purchase Schema ──────────────────────────────────────────

export const CreditPurchaseSchema = z.object({
  quantity: z.number().min(1).max(100000).refine(
    (val) => Number(val.toFixed(2)) === val,
    { message: 'Quantity must have at most 2 decimal places' }
  ),
  projectAllocations: z.array(z.object({
    projectId: z.string().min(1),
    tonnage: z.number().min(0.01),
  })).min(1),
  packageId: z.string().optional(),
});

// ─── Credit Package Admin Schema ─────────────────────────────────────────────

export const CreditPackageSchema = z.object({
  name: z.string().min(1).max(100),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']),
  tonnage: z.number().min(1).max(100000),
  priceCents: z.number().int().min(100).max(999999999),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
});

// ─── Export Date Range Schema ────────────────────────────────────────────────

export const ExportDateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
}).refine(
  (data) => new Date(data.startDate) < new Date(data.endDate),
  { message: 'Start date must be before end date' }
);

export type CreditPurchaseInput = z.infer<typeof CreditPurchaseSchema>;
export type CreditPackageInput = z.infer<typeof CreditPackageSchema>;
export type ExportDateRangeInput = z.infer<typeof ExportDateRangeSchema>;
```

## Cloud Functions

### `credits_purchase` (onCall, role: funder)

Processes a carbon credit purchase request.

**Flow:**
1. Verify caller has `funder` role
2. Validate input with `CreditPurchaseSchema`
3. Within a Firestore transaction:
   a. Read all referenced `creditInventory` documents
   b. Verify total available tonnage >= requested quantity
   c. Decrement `availableTonnage` on each allocated inventory document
   d. Create `purchaseTransactions` document with status `pending`
4. Return `{ transactionId, status: 'pending' }`

**Error responses:**
- `UNAUTHENTICATED` — no Firebase Auth token
- `PERMISSION_DENIED` — role is not `funder`
- `VALIDATION_ERROR` — input fails schema
- `INSUFFICIENT_INVENTORY` — requested quantity exceeds available stock

```typescript
// functions/src/credits/purchase.ts

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { CreditPurchaseSchema } from '../../../shared/schemas';
import type { ApiResponse } from '../../../shared/types';

export const credits_purchase = onCall(async (request): Promise<ApiResponse<{ transactionId: string }>> => {
  // 1. Auth check
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const db = getFirestore();
  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  const userData = userDoc.data();

  if (!userData || userData.role !== 'funder') {
    throw new HttpsError('permission-denied', 'Funder role required.');
  }

  // 2. Validate input
  const parseResult = CreditPurchaseSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', 'Validation failed.');
  }

  const input = parseResult.data;

  // 3. Atomic transaction
  const transactionId = db.collection('purchaseTransactions').doc().id;

  await db.runTransaction(async (txn) => {
    let totalAvailable = 0;
    const inventoryRefs: Array<{ ref: FirebaseFirestore.DocumentReference; data: FirebaseFirestore.DocumentData; allocatedTonnage: number }> = [];

    for (const allocation of input.projectAllocations) {
      const inventoryQuery = await txn.get(
        db.collection('creditInventory').where('projectId', '==', allocation.projectId)
      );

      if (inventoryQuery.empty) {
        throw new HttpsError('failed-precondition', `No inventory for project ${allocation.projectId}`);
      }

      const inventoryDoc = inventoryQuery.docs[0];
      const inventoryData = inventoryDoc.data();

      if (inventoryData.availableTonnage < allocation.tonnage) {
        throw new HttpsError('failed-precondition', 'INSUFFICIENT_INVENTORY');
      }

      totalAvailable += inventoryData.availableTonnage;
      inventoryRefs.push({ ref: inventoryDoc.ref, data: inventoryData, allocatedTonnage: allocation.tonnage });
    }

    // Decrement inventory
    for (const { ref, allocatedTonnage } of inventoryRefs) {
      txn.update(ref, { availableTonnage: FieldValue.increment(-allocatedTonnage), updatedAt: new Date().toISOString() });
    }

    // Create transaction record
    const unitPriceCents = inventoryRefs[0].data.unitPriceCents;
    const totalAmountCents = Math.round(input.quantity * unitPriceCents);

    txn.set(db.collection('purchaseTransactions').doc(transactionId), {
      transactionId,
      funderId: request.auth!.uid,
      quantity: input.quantity,
      unitPriceCents,
      totalAmountCents,
      currency: 'ZAR',
      status: 'pending',
      packageId: input.packageId || null,
      projectAllocations: input.projectAllocations.map((a) => ({
        projectId: a.projectId,
        projectTitle: inventoryRefs.find((r) => r.data.projectId === a.projectId)?.data.projectTitle || '',
        tonnage: a.tonnage,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  return { success: true, data: { transactionId } };
});
```

### `credits_confirmPurchase` (onCall, role: admin)

Confirms a pending purchase and triggers certificate generation.

**Flow:**
1. Verify caller has `admin` role
2. Update `purchaseTransactions` document status to `confirmed`
3. Trigger `credits_generateCertificate` asynchronously

### `credits_generateCertificate` (Firestore trigger)

Triggered when a `purchaseTransactions` document's status changes to `confirmed`.

**Flow:**
1. Read transaction, funder, and project data
2. Generate unique certificate ID (12+ alphanumeric chars using `crypto.randomBytes`)
3. Render PDF using a lightweight PDF library (e.g., `pdfkit`)
4. Upload PDF to Cloud Storage at `certificates/{funderId}/{transactionId}.pdf`
5. Create `certificates` Firestore document with metadata

```typescript
// Certificate ID generation
import { randomBytes } from 'crypto';

function generateCertificateId(): string {
  return randomBytes(9).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  // Produces 16-char alphanumeric ID
}
```

### `credits_packages` (onCall, role: admin for write, public for read)

CRUD operations for credit packages:
- `credits_packageCreate` — admin creates a new package
- `credits_packageUpdate` — admin updates an existing package
- `credits_packageDeactivate` — admin sets `isActive: false`

### `credits_exportCSV` (onCall, role: funder | admin)

Generates CSV export of purchase history within a date range.

### `credits_exportPDF` (onCall, role: funder | admin)

Generates PDF sustainability report within a date range.

## Frontend Pages

### Marketplace Page (`/credits` via query param navigation)

**Route:** `src/app/(dashboard)/credits/page.tsx`

**Layout:**
- Hero section showing total available credits across all projects
- Package cards (Bronze, Silver, Gold) with tonnage, discount %, total price
- Custom quantity input with real-time price calculation
- Project allocation selector (which projects supply the credits)
- Purchase CTA button

**States:** Loading (skeleton), Empty (no inventory), Loaded (packages + input), Error (retry)

**Query params:**
- `?view=packages` — default, shows package selection
- `?view=custom` — shows custom quantity input
- `?view=confirm&txn={transactionId}` — purchase confirmation

### Purchase Confirmation Page (`/credits?view=confirm&txn={id}`)

Full-page confirmation displaying:
- Purchase summary (tonnage, price, date)
- Project allocation breakdown
- Certificate download link (available after generation completes)
- "Return to Dashboard" and "View Sustainability Dashboard" CTAs

### Sustainability Dashboard (`/credits/sustainability`)

**Route:** `src/app/(dashboard)/credits/sustainability/page.tsx`

**Sections:**
1. **Summary cards** — Total CO₂e offset, Number of purchases, Total spent (ZAR)
2. **Timeline chart** (Recharts AreaChart) — Monthly offset over trailing 12 months
3. **Project breakdown table** — Project title, location, tonnage, % of total
4. **Certificates list** — Date, certificate ID, tonnage, download link
5. **Export controls** — Date range picker + CSV/PDF export buttons

**States:** Loading, Empty (zero purchases → CTA to marketplace), Loaded, Error

### Admin Credit Management (existing admin section)

**Route:** `src/app/(dashboard)/admin/credits/page.tsx`

- Inventory overview (per-project available tonnage)
- Package management (create/edit/deactivate)
- Transaction list (all purchases, status management)

## Sidebar Integration

The `DashboardSidebar` component's `NAV_ITEMS_BY_ROLE` configuration is extended:

```typescript
// Addition to funder nav items in DashboardSidebar.tsx
import { Leaf } from 'lucide-react';

// Insert after "My Funded Projects" in funder nav:
{ label: 'Carbon Credits', href: '/credits', icon: Leaf },

// Insert in admin nav:
{ label: 'Credit Inventory', href: '/admin/credits', icon: Leaf },
```

### Funder Overview Summary Card

A new `CarbonOffsetSummaryCard` component is added to the funder overview page:

```typescript
// src/components/dashboard/CarbonOffsetSummaryCard.tsx
interface CarbonOffsetSummaryCardProps {
  totalTonnage: number;      // Aggregated CO₂e offset
  purchaseCount: number;     // Number of confirmed purchases
}
```

## Firestore Security Rules

```
// Additions to firestore.rules

match /creditInventory/{inventoryId} {
  allow read: if request.auth != null;
  allow write: if false; // Only via Cloud Functions
}

match /creditPackages/{packageId} {
  allow read: if request.auth != null;
  allow write: if false; // Only via admin Cloud Functions
}

match /purchaseTransactions/{transactionId} {
  allow read: if request.auth != null && (
    resource.data.funderId == request.auth.uid ||
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
  );
  allow write: if false; // Only via Cloud Functions
}

match /certificates/{certificateId} {
  allow read: if request.auth != null && (
    resource.data.funderId == request.auth.uid ||
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
  );
  allow write: if false; // Only via Cloud Functions
}
```

## Firestore Indexes

```json
{
  "collectionGroup": "purchaseTransactions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "funderId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "purchaseTransactions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "funderId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "creditInventory",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "availableTonnage", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "creditPackages",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "isActive", "order": "ASCENDING" },
    { "fieldPath": "sortOrder", "order": "ASCENDING" }
  ]
}
```

## Seed Script

**Path:** `scripts/seed-carbon-credits.ts`

Follows the existing `--prod` flag pattern for emulator vs production targeting.

**Seed data includes:**
- Credit inventory records for both existing solar projects (SunRise Credits: 11 tons, Solar Schools: 156 tons)
- Three active credit packages (Bronze: 5 tons, Silver: 25 tons, Gold: 100 tons)
- One inactive "Platinum" package for testing
- Two sample purchase transactions (one confirmed, one pending)
- One sample certificate for the confirmed transaction

```typescript
// scripts/seed-carbon-credits.ts (structure)

const isProduction = process.argv.includes('--prod');
if (!isProduction) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
}

// Unit price: R150 per ton (15000 cents)
const UNIT_PRICE_CENTS = 15000;

const creditInventory = [
  {
    inventoryId: 'inv-sunrise-credits',
    projectId: 'sunrise-credits-solar-families',
    availableTonnage: 11.00,
    totalTonnage: 11.00,
    unitPriceCents: UNIT_PRICE_CENTS,
    projectTitle: 'SunRise Credits: Solar Power for African Families',
    projectLocation: 'Limpopo, South Africa',
    createdAt: '2025-04-15T10:00:00Z',
    updatedAt: '2025-04-15T10:00:00Z',
  },
  {
    inventoryId: 'inv-solar-schools',
    projectId: 'solar-schools-community-education',
    availableTonnage: 156.00,
    totalTonnage: 156.00,
    unitPriceCents: UNIT_PRICE_CENTS,
    projectTitle: 'Solar Schools: Powering Education in Off-Grid Communities',
    projectLocation: 'KwaZulu-Natal, South Africa',
    createdAt: '2025-05-01T10:00:00Z',
    updatedAt: '2025-05-01T10:00:00Z',
  },
];

const creditPackages = [
  {
    packageId: 'pkg-bronze',
    name: 'Bronze Package',
    tier: 'bronze',
    tonnage: 5,
    priceCents: 6750000,  // R67,500 (10% discount from R75,000)
    discountPercentage: 10,
    isActive: true,
    sortOrder: 1,
  },
  {
    packageId: 'pkg-silver',
    name: 'Silver Package',
    tier: 'silver',
    tonnage: 25,
    priceCents: 30000000, // R300,000 (20% discount from R375,000)
    discountPercentage: 20,
    isActive: true,
    sortOrder: 2,
  },
  {
    packageId: 'pkg-gold',
    name: 'Gold Package',
    tier: 'gold',
    tonnage: 100,
    priceCents: 105000000, // R1,050,000 (30% discount from R1,500,000)
    discountPercentage: 30,
    isActive: true,
    sortOrder: 3,
  },
  {
    packageId: 'pkg-platinum',
    name: 'Platinum Package',
    tier: 'platinum',
    tonnage: 500,
    priceCents: 450000000, // R4,500,000 (40% discount from R7,500,000)
    discountPercentage: 40,
    isActive: false, // Inactive for testing
    sortOrder: 4,
  },
];
```

## Error Handling

| Error Code | HTTP Status | Trigger |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No Firebase Auth token on purchase endpoint |
| `PERMISSION_DENIED` | 403 | Non-funder role attempts purchase |
| `VALIDATION_ERROR` | 400 | Input fails Zod schema validation |
| `INSUFFICIENT_INVENTORY` | 409 | Requested quantity > available tonnage |
| `NOT_FOUND` | 404 | Transaction or certificate not found |
| `INTERNAL` | 500 | Unexpected server error |

## Price Calculation Logic

All monetary values are stored and transmitted as ZAR integer cents to avoid floating-point errors.

```typescript
// Pure function — no side effects, suitable for property testing
export function calculatePurchasePrice(
  quantity: number,
  unitPriceCents: number,
  packageDiscount?: number
): number {
  const basePrice = quantity * unitPriceCents;
  if (packageDiscount && packageDiscount > 0) {
    return Math.round(basePrice * (1 - packageDiscount / 100));
  }
  return Math.round(basePrice);
}

// Display formatting (frontend only)
export function formatZAR(cents: number): string {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}
```

## Certificate PDF Layout

The generated PDF certificate includes:
1. **Header** — Offsettable logo, "Carbon Credit Certificate" title
2. **Certificate ID** — Unique 16-char alphanumeric (e.g., `OT7kM9pL2xR4nQ5w`)
3. **Funder details** — Organisation name, purchase date
4. **Offset details** — Tonnage (e.g., "25.00 metric tons CO₂e avoided")
5. **Project details** — Title, location, verification badge
6. **Verification reference** — Link to project page on platform
7. **Footer** — "Verified by Offsettable" + generation timestamp

## Integration Points

| Existing Component | Change Required |
|---|---|
| `DashboardSidebar.tsx` | Add "Carbon Credits" nav item for funder role |
| `shared/types.ts` | Add new interfaces and type exports |
| `shared/schemas.ts` | Add purchase and package Zod schemas |
| `functions/src/index.ts` | Export new credit functions |
| `firestore.rules` | Add rules for new collections |
| `firestore.indexes.json` | Add composite indexes for new collections |
| Funder overview page | Add `CarbonOffsetSummaryCard` |

## Testing Strategy

| Layer | Tool | Focus |
|-------|------|-------|
| Property tests | Vitest + fast-check | Price calculation, quantity validation, inventory logic, aggregation, schema validation, access control |
| Unit tests | Vitest | Component rendering states, specific edge cases, certificate ID format |
| Integration tests | Vitest + Firestore emulator | Purchase transaction flow, certificate generation trigger, security rules |
| E2E | Manual / Playwright | Full purchase flow, dashboard display, export downloads |

**Property test priority:** Price calculation (Property 6), inventory decrement (Property 1), quantity validation (Property 5), schema validation (Property 11), aggregation logic (Properties 14–16), and data isolation (Property 20) are all pure-function or logic-layer properties well suited to fast-check with 100+ iterations.

**Integration test priority:** Certificate generation (Property 12–13, timed requirement 5.1), Firestore transaction atomicity (Property 1–2), and security rules (Property 19–20).

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Inventory decrement equals purchase quantity

*For any* confirmed purchase of quantity Q from a project with available tonnage T (where Q ≤ T), the resulting available tonnage SHALL equal T − Q exactly.

**Validates: Requirements 1.3, 4.3**

### Property 2: Insufficient inventory rejects purchase and preserves stock

*For any* purchase request where the requested quantity exceeds the available tonnage for a project, the system SHALL reject the purchase with an INSUFFICIENT_INVENTORY error and the available tonnage SHALL remain unchanged.

**Validates: Requirements 1.4, 4.4**

### Property 3: Tonnage stored with two-decimal precision

*For any* tonnage value stored in creditInventory, the value SHALL be representable as a number with at most two decimal places (i.e., `Math.round(value * 100) / 100 === value`).

**Validates: Requirements 1.2**

### Property 4: Total available credits equals sum of individual inventories

*For any* set of creditInventory documents, the total available credits displayed in the marketplace SHALL equal the sum of all individual `availableTonnage` values where `availableTonnage > 0`.

**Validates: Requirements 1.5**

### Property 5: Quantity validation accepts only positive values with at most two decimal places within bounds

*For any* numeric input, the marketplace SHALL accept it as a valid quantity if and only if it is positive, has at most two decimal places, and is between 1 and the total available inventory (inclusive).

**Validates: Requirements 2.1, 2.3**

### Property 6: Price calculation is quantity times unit price in integer cents

*For any* valid quantity and unit price in cents, the calculated total price SHALL equal `Math.round(quantity * unitPriceCents)`, producing an integer result.

**Validates: Requirements 2.2, 4.5**

### Property 7: Transaction record contains all required fields

*For any* confirmed purchase, the resulting PurchaseTransaction document SHALL contain: transactionId, funderId, quantity, unitPriceCents, totalAmountCents (integer), currency ("ZAR"), status, projectAllocations (with projectId, projectTitle, tonnage for each), and createdAt timestamp.

**Validates: Requirements 2.4**

### Property 8: Package discount calculation is consistent

*For any* credit package with a tonnage and priceCents, the displayed discount percentage SHALL equal `Math.round((1 - priceCents / (tonnage * unitPriceCents)) * 100)` relative to the standard per-ton price.

**Validates: Requirements 3.2**

### Property 9: Only active packages are displayed

*For any* set of creditPackage documents, the marketplace SHALL display only those where `isActive === true`, and no inactive packages shall appear in the listing.

**Validates: Requirements 3.4**

### Property 10: Packages disabled when inventory insufficient

*For any* credit package where `package.tonnage > totalAvailableInventory`, the marketplace SHALL disable that package and display an insufficient stock indicator.

**Validates: Requirements 3.5**

### Property 11: Purchase schema validates structure correctly

*For any* input object, the CreditPurchaseSchema SHALL accept it if and only if it contains valid projectAllocations (non-empty array of objects with projectId string and tonnage > 0), a positive quantity with at most 2 decimal places, and optionally a packageId string.

**Validates: Requirements 4.1**

### Property 12: Certificate contains all required fields

*For any* generated certificate, it SHALL contain: a unique certificate ID (≥12 alphanumeric characters), purchase date, funder organisation name, tonnage offset, project title, project location, and a verification reference to the source project.

**Validates: Requirements 5.2, 5.6**

### Property 13: Certificate storage path follows convention

*For any* generated certificate with a given funderId and transactionId, the Cloud Storage path SHALL equal `certificates/{funderId}/{transactionId}.pdf` and the corresponding Firestore document SHALL reference this path along with transactionId, funderId, and generatedAt timestamp.

**Validates: Requirements 5.3, 5.4**

### Property 14: Total offset aggregation equals sum of confirmed purchase tonnages

*For any* funder with a set of confirmed purchaseTransactions, the sustainability dashboard's total CO₂e offset SHALL equal the sum of `quantity` across all transactions with `status === 'confirmed'`.

**Validates: Requirements 6.1**

### Property 15: Monthly offset bucketing groups purchases correctly

*For any* set of confirmed purchases with various `createdAt` timestamps, the monthly timeline chart SHALL group each purchase into its correct calendar month and the sum of all monthly buckets SHALL equal the total offset.

**Validates: Requirements 6.2**

### Property 16: Per-project breakdown sums to total offset

*For any* funder's confirmed purchases, the per-project tonnage breakdown SHALL sum to the same total as the overall CO₂e offset, and each project's attributed tonnage SHALL equal the sum of allocations to that project across all confirmed transactions.

**Validates: Requirements 6.3**

### Property 17: CSV export contains all required columns with correct data

*For any* set of confirmed purchases within a date range, the generated CSV SHALL contain one row per purchase with columns: date, project title, tonnage, amount paid (ZAR formatted from cents), and certificate ID — and the row count SHALL equal the number of confirmed purchases in the range.

**Validates: Requirements 7.2**

### Property 18: PDF export contains all required sections

*For any* export request with a valid date range, the generated PDF report SHALL contain: the funder's organisation name, the reporting period matching the requested range, total tonnage offset (sum of purchases in range), per-project breakdown, and a list of all certificate IDs for purchases in the range.

**Validates: Requirements 7.3**

### Property 19: Role-based access control enforces funder-only purchases

*For any* user attempting to access purchase endpoints, the system SHALL permit the operation if and only if the user is authenticated AND has the `funder` role. Unauthenticated requests SHALL receive `UNAUTHENTICATED`, and authenticated non-funder requests SHALL receive `PERMISSION_DENIED`.

**Validates: Requirements 9.1, 9.2, 9.3**

### Property 20: Data isolation — funders see only own records, admins see all

*For any* funder attempting to read purchaseTransactions or certificates, they SHALL only receive documents where `funderId` matches their own userId. For any admin, they SHALL receive all documents regardless of funderId.

**Validates: Requirements 9.4, 9.5, 5.5, 7.4**
