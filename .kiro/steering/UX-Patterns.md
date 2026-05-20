# Steering Document: UX Patterns

**Scope:** Frontend interaction patterns, lead generation UX, and UI conventions for Offsettabillity.
**Principle:** Every page exists to either capture a lead or move a user toward conversion.

---

## 1. Lead Generation UX Principles

### The Conversion Hierarchy

Every page must serve one of these purposes (in priority order):

1. **Capture a lead** — Form submission, email capture, consultation request
2. **Build trust** — Verification badges, auditor credentials, impact metrics
3. **Educate** — How it works, project categories, ESG compliance info
4. **Engage** — Calculator tools, project browsing, impact visualization

### Above-the-Fold Rules

- Every landing page must have a clear CTA visible without scrolling.
- CTAs use action verbs: "Get Your ESG Report", "Calculate Your Impact", "Speak to an Advisor".
- Never use generic CTAs like "Submit" or "Learn More" as primary actions.
- Primary CTA: high-contrast button (green on dark, or dark on light).
- Secondary CTA: ghost/outline button for lower-commitment actions.

### Lead Capture Forms

- Minimize fields. Start with email only, progressive profiling for the rest.
- Calculator widget: collect industry + budget, gate the detailed report behind email.
- Every form must show a clear value proposition: "Get your personalized ESG allocation report".
- Success state: confirm submission + set expectation ("We'll be in touch within 24 hours").
- Error state: inline validation, never lose user input.

---

## 2. The Five UI States

Every data-driven component must handle all five states:

| State | What to show | Implementation |
|-------|-------------|----------------|
| **Loading** | Skeleton placeholders | CSS shimmer matching layout shape |
| **Empty** | Illustration + action prompt | "No projects yet. Submit your first." |
| **Partial** | Data + contextual guidance | Show data with helpful hints |
| **Loaded** | Full data display | Normal render |
| **Error** | Inline error + retry action | Never a blank screen |

---

## 3. Trust Signals

Trust is the #1 conversion factor for an ESG funding platform. Display these prominently:

| Signal | Where | Implementation |
|--------|-------|----------------|
| Verification badges | Project cards, detail pages | Color-coded badge (green = Premium Assured) |
| Auditor credentials | Audit reports, auditor profiles | Professional certifications, experience |
| Impact metrics | Project cards, homepage stats | Real numbers, not vague claims |
| Social proof | Homepage, category pages | "250+ Projects Verified", logos |
| Methodology transparency | About page, project detail | Link to verification methodology |

---

## 4. Google Ads Landing Page Optimization

### Quality Score Factors

- **Relevance:** Landing page content must match ad copy and keywords exactly.
- **Load speed:** Target < 2.5s LCP. Use static generation, optimized images.
- **Mobile-first:** All landing pages must be fully functional on mobile.
- **Above-the-fold CTA:** Visible without scrolling on all devices.

### Landing Page Structure (for paid traffic)

```
1. Headline matching search intent
2. Sub-headline with value proposition
3. Trust signals (badges, stats, logos)
4. Primary CTA (lead form or calculator)
5. Social proof (testimonials, case studies)
6. How it works (3-4 steps)
7. Featured projects (relevant to category)
8. Secondary CTA (consultation)
9. FAQ (addresses objections)
```

### Category-Specific Landing Pages

Create dedicated landing pages for each major ad group:
- `/categories/energy-saving` — "Verified Energy Saving Projects for Your ESG Portfolio"
- `/categories/education` — "Fund Verified Education Projects | Audit-Ready Reporting"
- `/categories/carbon-removal` — "Invest in Verified Carbon Removal Projects"
- etc.

Each must have unique content, relevant projects, and category-specific CTAs.

---

## 5. Navigation & Layout

### Public Site (Lead Gen Focus)

- Sticky header with primary CTA button ("Get Started" or "Speak to Advisor").
- No sidebar — full-width content for maximum impact.
- Footer with newsletter signup, quick links, trust badges.
- Mobile: hamburger menu, sticky bottom CTA bar.

### Dashboard (Authenticated Users)

- Persistent sidebar for navigation.
- Role-based menu items (funder sees different items than auditor).
- Breadcrumbs for nested routes.
- Active route highlighted in sidebar.

---

## 6. Forms

- Use controlled components with form state management.
- Validate on blur for individual fields, validate all on submit.
- Show validation errors inline below the field, in red.
- Disable submit button while request is in flight, show loading spinner.
- Financial inputs: display formatted (e.g., "R 1,500.00") but store as integer cents.
- Multi-step forms (project submission): wizard layout with progress indicator.

---

## 7. Responsive Breakpoints

| Breakpoint | Target | Layout |
|------------|--------|--------|
| < 640px | Mobile | Single column, bottom CTA bar |
| 640–1024px | Tablet | Two columns where appropriate |
| > 1024px | Desktop | Full layout |

- Design mobile-first — Google Ads traffic is 60%+ mobile.
- Project cards stack vertically on mobile.
- Calculator widget is full-width on mobile.

---

## 8. Accessibility Baseline

- All interactive elements must be keyboard-navigable.
- All images must have alt text.
- Color contrast must meet WCAG 2.1 AA (4.5:1 for text).
- Form fields must have associated labels (not just placeholders).
- Error messages announced to screen readers (`aria-live="polite"`).
- Focus management on route changes.

---

## 9. Feedback Patterns

| Action type | Feedback | Duration |
|-------------|----------|----------|
| Lead form success | Success message + next steps | Persistent |
| Project submission | Toast + redirect to dashboard | 4 seconds |
| Validation error | Inline below field | Until fixed |
| Server error | Toast (error variant) | 6 seconds |
| Funding confirmation | Full-page success with receipt | Persistent |
