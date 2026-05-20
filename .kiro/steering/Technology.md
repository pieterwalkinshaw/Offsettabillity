# Steering Document: GCP Free-Tier Architecture

**Target:** Offsettabillity — Verified ESG impact project funding platform with lead generation focus
**Mission:** Deliver a $0-startup-cost platform using Google Cloud Free Tier, prioritizing a Next.js frontend with Firebase backend for rapid iteration and lead capture.

---

## 1. Core Infrastructure

All services must remain within GCP's Always Free tier limits. If a service risks exceeding free-tier quotas, raise a warning before proceeding.

| Layer          | Service          | Constraint                                  |
| -------------- | ---------------- | ------------------------------------------- |
| Frontend       | Firebase Hosting | 10 GB transfer / 1 GB storage               |
| Database       | Firestore        | 1 GiB storage, 50K reads/20K writes per day |
| Auth           | Firebase Auth    | Free tier (email/password, Google sign-in)  |
| Functions      | Cloud Functions  | 2M invocations/month (Gen 2 on Cloud Run)  |
| Storage        | Cloud Storage    | 5 GB Standard storage                       |
| Analytics      | BigQuery Sandbox | 10 GB storage / 1 TB query per month        |
| Search/Ads     | Google Ads API   | Free API access (ad spend separate)         |

### Firebase Hosting Constraints

- Deploy Next.js as static export where possible (SSG/ISR pages).
- Dynamic routes (dashboard, auth callbacks) served via Cloud Functions for Firebase.
- Use Firebase Hosting rewrites to route API calls to Cloud Functions.
- Free tier: 10 GB transfer/month, 1 GB storage.

### Cloud Functions Constraints

- All functions must be lightweight and fast-starting (< 500ms cold start target).
- Use Node.js 20 runtime for consistency with Next.js tooling.
- Free tier: 2M invocations, 400K GB-seconds, 200K GHz-seconds per month.

---

## 2. The Development Stack

### Frontend: Next.js + Tailwind CSS

| Concern            | Choice                        | Rationale                                                  |
| ------------------ | ----------------------------- | ---------------------------------------------------------- |
| Framework          | **Next.js 16**                | App Router, RSC, file-based routing                        |
| Styling            | **Tailwind CSS 4**            | Utility-first, fast iteration                              |
| Icons              | **Lucide React**              | Lightweight, tree-shakeable                                |
| Charts             | **Recharts**                  | Already in project, good for impact dashboards             |
| State Management   | React Context + SWR           | Lightweight, cache-first data fetching                     |
| Forms              | React Hook Form + Zod         | Type-safe validation                                       |
| Auth               | Firebase Auth (client SDK)    | Direct integration, free tier                              |

#### Frontend Guidelines

- The frontend communicates with Firestore directly via Firebase client SDK for reads.
- Writes that require validation go through Cloud Functions (API layer).
- Use Next.js App Router with `'use client'` only where interactivity is needed.
- Optimize for Core Web Vitals — this is a lead-gen site, SEO matters.
- All public-facing pages must be statically generated or ISR for fast load times.
- Landing pages must be optimized for Google Ads Quality Score (fast LCP, relevant content).
- **Lead capture forms must be above the fold on every key landing page.**

### Backend: Cloud Functions (TypeScript)

| Concern        | Choice                      | Rationale                                              |
| -------------- | --------------------------- | ------------------------------------------------------ |
| Runtime        | **Node.js 20 + TypeScript** | Same language as frontend, shared types                |
| Framework      | **Firebase Functions v2**   | Gen 2 (Cloud Run backed), better cold starts           |
| Validation     | **Zod**                     | Runtime type validation, shared with frontend          |
| Auth           | **Firebase Admin SDK**      | Verify tokens, manage users server-side                |
| Email          | **Resend** or **SendGrid**  | Transactional emails (free tier available)             |

#### Backend Guidelines

- Every Cloud Function must validate input using Zod schemas.
- Use Firebase Admin SDK for server-side auth verification.
- All Firestore writes from functions must be wrapped in transactions where atomicity matters.
- Keep functions stateless — Cloud Functions can cold-start at any time.
- Financial calculations (funding amounts) must use integer cents, never floating point.
- Shared TypeScript types between frontend and functions live in a `shared/` directory.

### DevOps

| Concern       | Choice              | Rationale                                          |
| ------------- | ------------------- | -------------------------------------------------- |
| Hosting       | **Firebase Hosting** | Free tier, global CDN, easy deploys               |
| CI/CD         | **GitHub Actions**   | Free for public repos, generous free minutes      |
| IaC           | **Firebase CLI**     | `firebase.json` + `firestore.rules`               |

---

## 3. Data Strategy

### Firestore (Primary Database)

- **Use for:** All application data — projects, users, audits, leads, taxonomy.
- Free tier: 1 GiB storage, 50K reads / 20K writes / 20K deletes per day.
- Design documents to be **read-heavy** — denormalize where it avoids extra reads.
- Use Firestore Security Rules to enforce access control.
- Collections: `users`, `projects`, `audits`, `leads`, `taxonomy`, `reports`, `funding`.

### Cloud Storage

- **Use for:** Uploaded documents (audit reports, project evidence, verification docs).
- 5 GB free storage.
- Organize by: `projects/{projectId}/documents/`, `audits/{auditId}/evidence/`.

### BigQuery (Analytics — Future)

- **Use for:** Aggregate reporting, impact analytics, lead funnel analysis.
- Sandbox mode: no billing required.
- Load data via scheduled Cloud Functions that export from Firestore.

---

## 4. Authentication & Authorization

- Use **Firebase Authentication** for all user identity (email/password, Google sign-in).
- Roles stored in Firestore user documents: `funder`, `owner`, `auditor`, `admin`.
- Firestore Security Rules enforce role-based access at the database level.
- Cloud Functions verify Firebase ID tokens for any server-side operations.
- Self-registration is open for all roles (funders, project owners, auditors).
- Auditor accounts require admin approval before they can verify projects.

---

## 5. Lead Generation Architecture

This platform is **lead-generation-first**. Every design decision must support capturing and converting leads.

### Lead Capture Points

| Touchpoint | Mechanism | Data Captured |
|------------|-----------|---------------|
| ESG Calculator | Gated results (email for full report) | Email, company, industry, budget |
| Project detail pages | "Get Impact Report" CTA | Email, company, project interest |
| Contact/consultation form | Direct inquiry | Full contact details, message |
| Newsletter signup | Footer + exit intent | Email only |
| Auditor registration | Self-service signup | Full professional profile |

### Google Ads Integration

- Landing pages must match ad group intent (one page per keyword cluster).
- UTM parameters tracked and stored with lead records.
- Conversion tracking via Google Tag Manager + Firebase Analytics.
- Key conversion events: `lead_form_submit`, `calculator_complete`, `consultation_request`.

### SEO Strategy

- Static pages for each project category (energy, education, health, food security, etc.).
- Blog/content section for organic traffic (ESG guides, compliance updates).
- Schema.org structured data on project pages (Organization, Event, Article).
- Meta descriptions optimized for click-through from search results.

---

## 6. Cost Safeguards

These are **non-negotiable** constraints:

1. **No paid services without explicit approval.** Everything must work on free tier.
2. **Firestore read optimization:** Use pagination, limit queries, cache aggressively client-side.
3. **Image optimization:** Use Next.js Image component with WebP, lazy loading.
4. **Function efficiency:** Keep cold starts minimal, bundle size small.
5. **Storage discipline:** Compress uploads, enforce file size limits (5 MB max per document).
6. **No external paid APIs** without explicit approval and a free-tier fallback.

---

## 7. Testing Strategy

| Layer        | Tool                          | Minimum Coverage |
| ------------ | ----------------------------- | ---------------- |
| Unit (FE)    | Jest + React Testing Library  | Key components   |
| Integration  | Playwright                    | Critical paths   |
| Type Safety  | TypeScript strict mode        | 100%             |
| Linting      | ESLint + Prettier             | All files        |

---

## 8. Project Structure (Authoritative)

```
offsettabillity/
├── .kiro/
│   ├── steering/                 # Steering documents
│   └── specs/                    # Feature specs
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── (public)/             # Public-facing pages (SEO optimized)
│   │   │   ├── page.tsx          # Homepage / hero + calculator
│   │   │   ├── projects/         # Project browsing & detail
│   │   │   ├── categories/       # Category landing pages (for ads)
│   │   │   ├── about/            # About, team, methodology
│   │   │   ├── contact/          # Lead capture form
│   │   │   └── blog/             # Content marketing
│   │   ├── (auth)/               # Auth pages
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── forgot-password/
│   │   ├── (dashboard)/          # Authenticated dashboard
│   │   │   ├── overview/         # Role-based dashboard
│   │   │   ├── projects/         # Project management (owner)
│   │   │   ├── funding/          # Funding history (funder)
│   │   │   ├── audits/           # Audit assignments (auditor)
│   │   │   ├── leads/            # Lead management (admin)
│   │   │   └── admin/            # Platform admin
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── favicon.ico
│   ├── components/
│   │   ├── ui/                   # Reusable UI primitives
│   │   ├── layout/               # Header, Footer, Sidebar
│   │   ├── projects/             # Project cards, lists, detail
│   │   ├── forms/                # Lead forms, project forms
│   │   ├── dashboard/            # Dashboard widgets
│   │   └── marketing/            # CTAs, calculators, testimonials
│   ├── lib/
│   │   ├── firebase/             # Firebase client config & helpers
│   │   ├── auth/                 # Auth context & hooks
│   │   ├── hooks/                # Custom React hooks
│   │   └── utils/                # Shared utilities
│   └── types/                    # Shared TypeScript types
├── functions/                    # Cloud Functions (TypeScript)
│   ├── src/
│   │   ├── leads/                # Lead capture & notification
│   │   ├── projects/             # Project validation & status
│   │   ├── audits/               # Audit workflow
│   │   ├── funding/              # Funding transactions
│   │   └── admin/                # Admin operations
│   ├── package.json
│   └── tsconfig.json
├── shared/                       # Shared types & schemas (FE + Functions)
│   ├── types.ts
│   └── schemas.ts
├── public/                       # Static assets
├── firestore.rules               # Firestore security rules
├── firestore.indexes.json        # Firestore composite indexes
├── firebase.json                 # Firebase project config
├── .firebaserc                   # Firebase project aliases
├── .env.example                  # Environment variable template
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
└── README.md
```

---

## 9. Coding Standards

### TypeScript

- Strict mode enabled (`"strict": true` in tsconfig).
- No `any` types — use `unknown` and narrow.
- Shared types between frontend and functions in `shared/`.
- Zod schemas as single source of truth for validation.

### Next.js

- ESLint with Next.js recommended config.
- Prettier for formatting.
- Use Server Components by default, `'use client'` only when needed.
- Optimize images with `next/image`.
- Use `generateStaticParams` for static generation of dynamic routes.

### General

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
- **PR Reviews:** Every PR must pass CI.
- **No secrets in code.** Use `.env.local` (gitignored) for local dev.
