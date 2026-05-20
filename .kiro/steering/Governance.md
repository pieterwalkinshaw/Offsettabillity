# Steering Document: Platform Governance

**Scope:** Verification methodology, auditor governance, and compliance for Offsettabillity.
**Principle:** Verifiability is the platform's core value proposition — every claim must be auditable.

---

## 1. Verification Framework

### Verification Tiers

| Tier | Badge | Requirements | Trust Level |
|------|-------|-------------|-------------|
| 1 | None | Project submitted, basic info complete | Unverified |
| 2 | Verified | Pre-screening passed, 1 independent audit completed | Standard |
| 3 | Verified+ | 2+ audits completed, score > 85, ongoing monitoring | Enhanced |
| 4 | Premium Assured | 3+ audits, score > 95, continuous reporting, site visit | Highest |

### Verification Score Calculation

- Base score: 0-100
- Components:
  - Documentation completeness (20%)
  - Auditor assessment (40%)
  - Impact measurement methodology (20%)
  - Ongoing reporting compliance (20%)
- Score updated after each audit cycle.

### Pre-Screening Criteria

Before a project is assigned to an auditor, platform admins verify:

1. Project owner identity confirmed (email verified, organization details provided)
2. Project description is substantive (not placeholder content)
3. Location data is plausible
4. Funding goal is reasonable for the project type
5. Impact metrics use the correct category measurement
6. Required supporting documents are uploaded

---

## 2. Auditor Governance

### Auditor Registration & Approval

1. Self-registration with professional profile
2. Must declare: qualifications, certifications, years of experience, specializations
3. Admin reviews and approves/rejects
4. Approved auditors can browse and apply to verify projects
5. Auditors cannot verify projects they have a financial interest in

### Auditor Specializations

Auditors declare expertise in one or more project categories:
- Energy & Carbon (energy-saving, renewable-energy, carbon-removal)
- Social Impact (education, health, food-security, gender-equality)
- Environmental (clean-water, waste-management, biodiversity)
- Infrastructure (housing, digital-inclusion)

### Conflict of Interest Rules

- An auditor cannot verify a project owned by their own organization.
- An auditor cannot verify a project they have funded.
- An auditor cannot verify the same project in consecutive audit cycles.
- Platform admin assigns audits to avoid conflicts.

---

## 3. ESP & Social Spending Qualification

### South African Context

Projects on the platform should qualify under one or more of:

| Framework | Section | Requirement |
|-----------|---------|-------------|
| B-BBEE | Enterprise Development | Contributions to develop small enterprises |
| B-BBEE | Supplier Development | Developing suppliers in the value chain |
| B-BBEE | Socio-Economic Development | Contributions to communities |
| Income Tax Act | Section 18A | Donations to approved public benefit organizations |
| Carbon Tax Act | Offset allowance | Verified carbon offset projects |

### Qualification Evidence

Each project must provide:
1. Registration documents (NPO/PBO/Section 21 company)
2. Tax clearance or Section 18A approval (where applicable)
3. B-BBEE certificate or letter of intent
4. Impact measurement plan aligned with category metrics

---

## 4. Data Privacy

### Rules

1. **Minimal collection:** Only collect data needed for platform function and lead follow-up.
2. **Consent:** Lead forms must include consent checkbox for marketing communications.
3. **POPIA compliance:** South African users are protected under POPIA.
4. **Right to deletion:** Users can request account and data deletion.
5. **No PII in logs:** Firebase Functions logs must never output email, phone, or names.
6. **Cookie consent:** Display consent banner for analytics/marketing cookies.

---

## 5. Financial Governance

### Funding Transparency

- All funding amounts are publicly visible on project pages (total raised vs. goal).
- Individual funder amounts are private (only visible to project owner and admin).
- Platform does not hold funds — funding is facilitated via external payment gateway.
- Payment gateway integration must be PCI-compliant (use hosted payment pages).

### Anti-Fraud Measures

- Projects with suspicious patterns flagged for manual review.
- Funding from single source > 50% of goal triggers admin notification.
- Duplicate project detection (similar title + location + category).

---

## 6. Content Moderation

- Project descriptions reviewed during pre-screening.
- User-reported content triggers admin review.
- Spam/bot submissions filtered by rate limiting and honeypot fields.
- Auditor findings are reviewed by admin before publication.
