# Steering Document: API Contracts

**Scope:** API design conventions for Offsettabillity Cloud Functions endpoints.
**Principle:** Consistency across every function — predictable request/response patterns.

---

## 1. Function Naming & URL Structure

- All callable functions use Firebase Functions v2 `onCall` for authenticated operations.
- HTTP functions (webhooks, public endpoints) use `onRequest`.
- Naming convention: `{domain}_{action}` (e.g., `leads_create`, `projects_submit`).

### Public HTTP Endpoints (no auth required)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/leads` | POST | Capture a new lead (contact form, calculator) |
| `/api/projects/public` | GET | List verified public projects |
| `/api/projects/public/:id` | GET | Get single public project detail |
| `/api/categories` | GET | List active taxonomy categories |

### Authenticated Callable Functions

| Function | Purpose | Required Role |
|----------|---------|---------------|
| `projects_create` | Submit a new project | owner |
| `projects_update` | Update project details | owner (own project) |
| `projects_submit` | Submit for verification | owner |
| `audits_apply` | Auditor applies to verify a project | auditor |
| `audits_submit` | Submit audit findings | auditor |
| `funding_create` | Record a funding commitment | funder |
| `admin_approveAuditor` | Approve an auditor account | admin |
| `admin_assignAudit` | Assign auditor to project | admin |
| `admin_featureProject` | Toggle project featured status | admin |
| `leads_update` | Update lead status/notes | admin |

---

## 2. Response Format

All responses use a consistent envelope:

```typescript
// Success
{
  success: true,
  data: { ... }
}

// Error
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Human-readable description",
    fields?: { fieldName: "error message" }
  }
}
```

---

## 3. Error Codes

| Code | HTTP Equivalent | Meaning |
|------|----------------|---------|
| VALIDATION_ERROR | 400 | Input failed schema validation |
| UNAUTHENTICATED | 401 | No valid Firebase token |
| PERMISSION_DENIED | 403 | Role doesn't have access |
| NOT_FOUND | 404 | Resource doesn't exist |
| ALREADY_EXISTS | 409 | Duplicate resource |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL | 500 | Unexpected server error |

---

## 4. Pagination

For list endpoints:

```typescript
// Request
{ pageSize: 25, startAfter?: string }

// Response
{
  success: true,
  data: {
    items: [...],
    nextCursor: "last-doc-id" | null,
    totalCount: 142
  }
}
```

- Default page size: 25. Max: 100.
- Cursor-based using Firestore document IDs.

---

## 5. Lead Capture Endpoint (Critical Path)

The lead capture endpoint is the most important API in the system. It must:

1. Accept submissions without authentication (public).
2. Validate email format and required fields.
3. Store UTM parameters for attribution.
4. Trigger notification to admin (email or in-app).
5. Return success within 200ms (async processing for notifications).

```typescript
// POST /api/leads
{
  email: string;          // Required
  name?: string;
  company?: string;
  phone?: string;
  type: LeadType;         // Required
  source: string;         // Page URL
  projectId?: string;
  message?: string;
  industry?: string;
  budget?: number;
  utm: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  }
}
```

---

## 6. Naming Conventions

- JSON fields: **camelCase** (`firstName`, `projectId`, `createdAt`)
- Timestamps: ISO 8601 with timezone (`2026-05-19T14:30:00Z`)
- IDs: String (Firestore auto-IDs or UUIDs). Never expose sequential integers.
- Booleans: Prefix with `is` or `has` (`isApproved`, `isFeatured`)
- Money: Integer cents with separate currency field: `{ amount: 150000, currency: "ZAR" }` = R1,500.00
