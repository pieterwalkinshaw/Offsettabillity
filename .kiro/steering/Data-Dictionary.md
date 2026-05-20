# Steering Document: Data Dictionary

**Scope:** Canonical domain entities, field naming, and storage location for Offsettabillity.
**Principle:** One source of truth for every entity — if it's not in the dictionary, it doesn't exist in the schema.

---

## 1. Rules

1. **Every domain entity** must be registered in this document before its schema is created in code.
2. **Field names** follow camelCase in TypeScript and Firestore documents.
3. **PII fields** are marked with 🔒. These must be excluded from logs and analytics exports.
4. **Storage** indicates where the entity lives: `Firestore` or `Cloud Storage`.
5. **Owner** indicates which module has write authority.

---

## 2. Core Entities

### User

| Field | Type | PII | Storage | Notes |
|-------|------|-----|---------|-------|
| userId | string | | Firestore | Firebase Auth UID (primary key) |
| email | string | 🔒 | Firestore | Unique, login identifier |
| name | string | 🔒 | Firestore | Display name |
| role | enum | | Firestore | funder / owner / auditor / admin |
| organizationName | string | | Firestore | Optional, for corporate funders |
| organizationType | string | | Firestore | Optional (corporate, ngo, government, individual) |
| phone | string | 🔒 | Firestore | Optional |
| country | string | | Firestore | ISO 3166-1 alpha-2 |
| isApproved | boolean | | Firestore | For auditors: admin must approve |
| expertise | string[] | | Firestore | Auditor specializations |
| esgProfile | object | | Firestore | Funder preferences (industry, budget, interests) |
| utmSource | string | | Firestore | Marketing attribution |
| utmMedium | string | | Firestore | Marketing attribution |
| utmCampaign | string | | Firestore | Marketing attribution |
| createdAt | timestamp | | Firestore | |
| updatedAt | timestamp | | Firestore | |

**Owner:** `lib/auth`

### Project

| Field | Type | PII | Storage | Notes |
|-------|------|-----|---------|-------|
| projectId | string | | Firestore | Auto-generated UUID |
| title | string | | Firestore | Max 120 chars |
| description | string | | Firestore | Rich text, max 5000 chars |
| category | string | | Firestore | FK to TaxonomyCategory.id |
| subCategory | string | | Firestore | Free text refinement |
| ownerId | string | | Firestore | FK to User.userId |
| location | object | | Firestore | { lat, lng, address, country } |
| fundingGoal | number | | Firestore | Integer cents (ZAR) |
| fundingRaised | number | | Firestore | Integer cents (ZAR) |
| impactMetrics | object | | Firestore | { reportingPeriod, primaryMetric: {label, value} } |
| verificationScore | number | | Firestore | 0-100, calculated from audits |
| verificationStatus | enum | | Firestore | draft / submitted / prescreened / pending_audit / verified / live / funded |
| verificationBadge | enum | | Firestore | None / Verified / Verified+ / Premium Assured |
| riskLevel | enum | | Firestore | low / medium / high |
| status | enum | | Firestore | Same as verificationStatus (display state) |
| espQualification | object | | Firestore | { qualifies: bool, category: string, evidence: string } |
| sdgAlignment | string[] | | Firestore | UN SDG numbers (1-17) |
| documents | string[] | | Firestore | Cloud Storage paths |
| auditHistory | string[] | | Firestore | Array of Audit IDs |
| isFeatured | boolean | | Firestore | Admin-curated for homepage |
| createdAt | timestamp | | Firestore | |
| updatedAt | timestamp | | Firestore | |

**Owner:** `lib/firebase/projects`

### TaxonomyCategory

| Field | Type | PII | Storage | Notes |
|-------|------|-----|---------|-------|
| id | string | | Firestore | Stable identifier |
| name | string | | Firestore | Display name |
| description | string | | Firestore | Category explanation |
| primaryMetricLabel | string | | Firestore | What gets measured |
| icon | string | | Firestore | Lucide icon name |
| sdgNumbers | number[] | | Firestore | Related UN SDGs |
| isActive | boolean | | Firestore | Can be disabled |
| sortOrder | number | | Firestore | Display ordering |

**Owner:** `lib/firebase/taxonomy`

### Audit

| Field | Type | PII | Storage | Notes |
|-------|------|-----|---------|-------|
| auditId | string | | Firestore | Auto-generated UUID |
| projectId | string | | Firestore | FK to Project |
| auditorId | string | | Firestore | FK to User (role=auditor) |
| status | enum | | Firestore | pending / in_progress / completed / rejected |
| findings | string | | Firestore | Auditor's written findings |
| scoreContribution | number | | Firestore | Points added to verification score |
| methodology | string | | Firestore | Verification methodology used |
| evidenceDocuments | string[] | | Firestore | Cloud Storage paths |
| recommendation | enum | | Firestore | approve / conditional / reject |
| createdAt | timestamp | | Firestore | |
| completedAt | timestamp | | Firestore | Nullable |

**Owner:** `functions/audits`

### Lead

| Field | Type | PII | Storage | Notes |
|-------|------|-----|---------|-------|
| leadId | string | | Firestore | Auto-generated UUID |
| email | string | 🔒 | Firestore | Required |
| name | string | 🔒 | Firestore | Optional |
| company | string | | Firestore | Optional |
| phone | string | 🔒 | Firestore | Optional |
| type | enum | | Firestore | calculator / report_request / consultation / newsletter / auditor_inquiry |
| source | string | | Firestore | Page URL where captured |
| projectId | string | | Firestore | Nullable, if related to specific project |
| message | string | | Firestore | Optional free text |
| industry | string | | Firestore | From calculator |
| budget | number | | Firestore | From calculator (annual revenue) |
| utmSource | string | | Firestore | Google Ads attribution |
| utmMedium | string | | Firestore | |
| utmCampaign | string | | Firestore | |
| utmContent | string | | Firestore | Ad variant |
| utmTerm | string | | Firestore | Search keyword |
| status | enum | | Firestore | new / contacted / qualified / converted / lost |
| assignedTo | string | | Firestore | Admin user handling the lead |
| notes | string | | Firestore | Internal follow-up notes |
| createdAt | timestamp | | Firestore | |
| updatedAt | timestamp | | Firestore | |

**Owner:** `functions/leads`

### FundingTransaction

| Field | Type | PII | Storage | Notes |
|-------|------|-----|---------|-------|
| transactionId | string | | Firestore | Auto-generated UUID |
| projectId | string | | Firestore | FK to Project |
| funderId | string | | Firestore | FK to User (role=funder) |
| amount | number | | Firestore | Integer cents |
| currency | string | | Firestore | ISO 4217 (default ZAR) |
| status | enum | | Firestore | pending / confirmed / failed / refunded |
| paymentReference | string | | Firestore | External payment gateway ref |
| createdAt | timestamp | | Firestore | |

**Owner:** `functions/funding`

### Report

| Field | Type | PII | Storage | Notes |
|-------|------|-----|---------|-------|
| reportId | string | | Firestore | Auto-generated UUID |
| projectId | string | | Firestore | FK to Project |
| title | string | | Firestore | Report title |
| fileUrl | string | | Cloud Storage | Path to generated PDF |
| accessLevel | enum | | Firestore | public / gated / private |
| generatedAt | timestamp | | Firestore | |

**Owner:** `functions/projects`

---

## 3. Project Categories (Taxonomy)

The platform supports the following project categories, aligned with South African ESP (Enterprise and Supplier Development) and social spending requirements:

| ID | Category | Primary Metric | SDG Alignment | ESP Qualifying |
|----|----------|---------------|---------------|----------------|
| energy-saving | Energy Saving & Efficiency | kWh Saved / CO₂e Avoided | 7, 13 | Yes |
| renewable-energy | Renewable Energy | MWh Generated | 7, 13 | Yes |
| carbon-removal | Carbon Removal & Sequestration | Tons CO₂e Removed | 13, 15 | Yes |
| education | Education & Skills Development | People Trained / Employed | 4, 8 | Yes |
| health | Healthcare & Wellness | Lives Impacted | 3 | Yes |
| food-security | Food Security & Agriculture | Meals Provided / Hectares | 2 | Yes |
| clean-water | Clean Water & Sanitation | Liters Provided / Communities | 6 | Yes |
| waste-management | Waste Management & Recycling | Tons Diverted from Landfill | 12 | Yes |
| biodiversity | Biodiversity & Conservation | Hectares Protected | 14, 15 | Yes |
| housing | Affordable Housing | Units Built / Families Housed | 11 | Yes |
| digital-inclusion | Digital Inclusion & Connectivity | People Connected | 9 | Yes |
| gender-equality | Gender Equality & Empowerment | Women/Girls Impacted | 5 | Yes |

---

## 4. Maintenance Rules

- **Adding an entity:** Add it to this document first, then create the TypeScript type.
- **Adding a field:** Add it here, mark PII if applicable, then add to code.
- **Removing a field:** Mark as `[DEPRECATED]` here first. Remove from code in a subsequent release.
