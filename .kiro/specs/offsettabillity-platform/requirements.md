# Requirements Document

## Introduction

Offsettabillity is a verified ESG impact project funding platform with a lead generation focus. The platform enables organizations and individuals to discover, fund, and verify social and environmental impact projects that qualify as Enterprise and Supplier Development (ESP) or social spending under South African B-BBEE frameworks. The platform connects Project Owners seeking funding, Funders seeking verified ESG impact, and independent Auditors who verify project claims — all while aggressively capturing leads through Google Ads traffic, gated content, and conversion-optimized landing pages.

## Glossary

- **Platform**: The Offsettabillity web application (Next.js frontend + Firebase backend)
- **Funder**: An organization or individual who commits funding to verified projects
- **Project_Owner**: An organization or individual who lists impact projects for funding
- **Auditor**: An independent professional who verifies project claims and impact
- **Admin**: A platform administrator with full management capabilities
- **Registration_System**: The Firebase Authentication-based self-registration module
- **Project_Listing_Service**: The module responsible for creating, managing, and displaying projects
- **Verification_Engine**: The system that manages audit workflows and calculates verification scores
- **Lead_Capture_System**: The module responsible for capturing, storing, and managing leads
- **Taxonomy_Manager**: The module that manages project categories and classification
- **Funding_Service**: The module that facilitates funding commitments from Funders to Projects
- **Report_Generator**: The module that produces audit-ready impact reports
- **ESG_Calculator**: The interactive widget that calculates suggested ESG allocation and captures leads
- **Verification_Score**: A 0-100 numeric score calculated from audit results
- **Verification_Badge**: A trust tier label (None, Verified, Verified+, Premium Assured)
- **ESP**: Enterprise and Supplier Development under South African B-BBEE legislation
- **UTM_Parameters**: URL tracking parameters for Google Ads attribution (source, medium, campaign, content, term)

## Requirements

### Requirement 1: User Self-Registration

**User Story:** As a prospective platform user, I want to self-register with my chosen role, so that I can access role-specific capabilities without manual account provisioning.

#### Acceptance Criteria

1. WHEN a visitor submits the registration form with a valid email address, a password of 8 to 64 characters containing at least one uppercase letter, one lowercase letter, and one digit, a full name of 1 to 100 characters, and a country selected from ISO 3166-1 alpha-2 codes, THE Registration_System SHALL create a Firebase Authentication account and a corresponding Firestore user document with the selected role within 5 seconds.
2. WHEN a visitor selects the Funder role during registration, THE Registration_System SHALL collect organization name, organization type, industry, and areas of interest as additional profile fields.
3. WHEN a visitor selects the Project_Owner role during registration, THE Registration_System SHALL collect organization name, organization registration number, and organization type as additional profile fields.
4. WHEN a visitor selects the Auditor role during registration, THE Registration_System SHALL collect professional qualifications, years of experience, specializations, and an optional CV upload limited to PDF or DOCX format and a maximum file size of 5 MB, and set the account status to pending approval.
5. WHILE an Auditor account has not been approved by an Admin, THE Platform SHALL restrict the Auditor from browsing available audits or applying to verify projects.
6. IF a registration attempt uses an email address already associated with an existing account, THEN THE Registration_System SHALL display an inline error indicating the email is already registered and preserve all other entered form data.
7. IF a registration attempt is submitted with any required field missing or failing validation, THEN THE Registration_System SHALL display inline error messages below each invalid field indicating the specific validation failure, and SHALL NOT create an account.
8. WHEN registration completes successfully, THE Registration_System SHALL store utmSource, utmMedium, and utmCampaign parameters from the current session URL with the user document for marketing attribution.
9. IF the Firebase Authentication account is created but the Firestore user document write fails, THEN THE Registration_System SHALL delete the orphaned Authentication account and display an error message indicating registration could not be completed, prompting the visitor to retry.

### Requirement 2: Project Listing and Onboarding

**User Story:** As a Project_Owner, I want to list my impact project on the platform with all required details, so that it can be discovered and funded by Funders after verification.

#### Acceptance Criteria

1. WHEN a Project_Owner submits a new project, THE Project_Listing_Service SHALL require title (max 120 characters), description (max 5000 characters), category from the active taxonomy, location (address and country), funding goal in ZAR cents (minimum 1000 cents, maximum 999999999 cents), and impact metrics with a primary metric label and reporting period selected from "Monthly", "Quarterly", "Annually", or "Project Duration".
2. WHEN a project is created, THE Project_Listing_Service SHALL set the verification status to "draft" and the verification badge to "None".
3. WHEN a Project_Owner submits a project for verification, THE Project_Listing_Service SHALL transition the verification status from "draft" to "submitted" and notify the Admin queue.
4. WHILE a project has verification status "draft", THE Project_Listing_Service SHALL allow the Project_Owner to edit all project fields.
5. WHILE a project has verification status "submitted", "prescreened", "pending_audit", "verified", "live", or "funded", THE Project_Listing_Service SHALL prevent the Project_Owner from editing the project title, category, and funding goal.
6. WHEN a Project_Owner uploads supporting documents, THE Project_Listing_Service SHALL accept files of type PDF, PNG, or JPEG only, enforce a maximum file size of 5 MB per document, enforce a maximum of 10 documents per project, and store files in Cloud Storage under the path `projects/{projectId}/documents/`.
7. THE Project_Listing_Service SHALL require at least one supporting document before allowing a project to be submitted for verification.
8. IF a Project_Owner submits a project with missing required fields or values outside allowed bounds, THEN THE Project_Listing_Service SHALL reject the submission and return a validation error indicating each field that failed validation.
9. IF a document upload fails due to an unsupported file type, file size exceeding 5 MB, or a storage error, THEN THE Project_Listing_Service SHALL reject the upload, retain any previously uploaded documents unchanged, and return an error message indicating the reason for failure.

### Requirement 3: Project Taxonomy and Classification

**User Story:** As an Admin, I want to manage project categories with defined impact metrics, so that projects are consistently classified and measurable.

#### Acceptance Criteria

1. THE Taxonomy_Manager SHALL maintain a list of active project categories, each with a unique identifier (lowercase alphanumeric with hyphens, maximum 50 characters), display name (maximum 80 characters), description (maximum 500 characters), primary metric label, icon reference, related SDG numbers (values 1–17), active status, and sort order (integer 0–999).
2. WHEN an Admin creates a new category, THE Taxonomy_Manager SHALL validate that the category identifier is unique among all categories (active and inactive), the display name is provided and does not exceed 80 characters, and the primary metric label is provided.
3. IF category creation validation fails, THEN THE Taxonomy_Manager SHALL reject the request and return an error message indicating which fields failed validation, without creating the category.
4. WHEN an Admin deactivates a category, THE Taxonomy_Manager SHALL set the category's active status to false, prevent new projects from selecting that category, and continue displaying the category name and metric label on existing projects that retain their assigned category.
5. WHEN an Admin updates an existing category's display name, description, icon reference, SDG numbers, or sort order, THE Taxonomy_Manager SHALL persist the changes and reflect them on all projects currently assigned to that category.
6. THE Taxonomy_Manager SHALL support the following initial categories: energy-saving, renewable-energy, carbon-removal, education, health, food-security, clean-water, waste-management, biodiversity, housing, digital-inclusion, and gender-equality.
7. WHEN a Project_Owner selects a category during project creation, THE Project_Listing_Service SHALL display the category's primary metric label as the label for a required numeric impact measurement field that the Project_Owner must complete before submission.

### Requirement 4: Project Verification System

**User Story:** As a Funder, I want projects to be independently verified with transparent audit trails, so that I can trust the impact claims before committing funds.

#### Acceptance Criteria

1. WHEN an Admin pre-screens a submitted project and confirms it meets pre-screening criteria, THE Verification_Engine SHALL transition the project status to "prescreened" and make it available for auditor assignment.
2. WHEN an Admin assigns an approved Auditor to a prescreened project, THE Verification_Engine SHALL create an Audit record with status "pending" and notify the assigned Auditor.
3. WHEN an Auditor submits findings with a score contribution (0-100), methodology description, and recommendation (approve, conditional, or reject), THE Verification_Engine SHALL transition the audit status to "completed" and recalculate the project's verification score.
4. WHEN a project receives its first completed audit with an "approve" recommendation, THE Verification_Engine SHALL upgrade the verification badge from "None" to "Verified" and transition the project status to "verified".
5. WHILE a project has 2 or more completed audits and a verification score above 85, THE Verification_Engine SHALL assign the "Verified+" badge.
6. WHILE a project has 3 or more completed audits and a verification score above 95, THE Verification_Engine SHALL assign the "Premium Assured" badge.
7. IF an Auditor has a conflict of interest with a project (owns the project, has funded it, or audited it in the previous cycle), THEN THE Verification_Engine SHALL prevent that Auditor from being assigned to the project.
8. THE Verification_Engine SHALL calculate the verification score using weighted components: documentation completeness (20%), auditor assessment (40%), impact measurement methodology (20%), and ongoing reporting compliance (20%).

### Requirement 5: Project Funding

**User Story:** As a Funder, I want to commit funding to verified projects, so that I can build an ESG portfolio with audit-ready documentation.

#### Acceptance Criteria

1. WHILE a project has verification status "verified" or "live", THE Funding_Service SHALL allow authenticated Funders to commit funding in amounts between 1000 cents (R10.00) and 100000000 cents (R1,000,000.00) inclusive per transaction.
2. IF a Funder attempts to commit funding to a project that does not have verification status "verified" or "live", THEN THE Funding_Service SHALL reject the request and return an error indicating the project is not eligible for funding.
3. WHEN a Funder commits funding, THE Funding_Service SHALL create a FundingTransaction record with the amount in integer cents, currency (default ZAR), status "pending", and a reference to the external payment gateway.
4. WHEN a payment is confirmed by the external gateway, THE Funding_Service SHALL update the transaction status to "confirmed" and increment the project's fundingRaised field by the confirmed amount.
5. IF the external payment gateway reports a payment failure, THEN THE Funding_Service SHALL update the transaction status to "failed" and not modify the project's fundingRaised field.
6. WHEN a project's fundingRaised equals or exceeds its fundingGoal, THE Funding_Service SHALL transition the project status to "funded".
7. THE Funding_Service SHALL display the total funding raised and funding goal publicly on project pages, while keeping individual funder amounts visible only to the Project_Owner and Admin.
8. IF the cumulative confirmed funding from a single funder exceeds 50% of a project's funding goal, THEN THE Funding_Service SHALL trigger an admin notification for manual review.
9. IF a confirmed payment causes a project's fundingRaised to exceed its fundingGoal, THEN THE Funding_Service SHALL still confirm the transaction and transition the project status to "funded".

### Requirement 6: Lead Capture and Management

**User Story:** As a platform operator, I want to capture leads from every high-intent interaction, so that the sales team can follow up and convert visitors into active platform users.

#### Acceptance Criteria

1. WHEN a visitor submits any lead capture form, THE Lead_Capture_System SHALL store the lead with email (required, max 254 characters), optional name (max 100 characters), optional company (max 200 characters), optional phone (max 20 characters), lead type (required), source page URL, and UTM parameters (utmSource, utmMedium, utmCampaign, utmContent, utmTerm).
2. THE Lead_Capture_System SHALL accept lead submissions without requiring authentication.
3. WHEN a lead is captured, THE Lead_Capture_System SHALL set the initial status to "new" and trigger an asynchronous notification (email or in-app) to the Admin.
4. WHEN an Admin updates a lead's status or adds notes (max 2000 characters), THE Lead_Capture_System SHALL record the change with a timestamp and restrict status transitions to the values: new, contacted, qualified, converted, or lost.
5. THE Lead_Capture_System SHALL support the following lead types: calculator, report_request, consultation, newsletter, and auditor_inquiry.
6. WHEN a lead form is submitted, THE Lead_Capture_System SHALL return a success response within 200 milliseconds, deferring notification delivery to asynchronous processing.
7. IF a lead submission contains an invalid email format (non-RFC 5322 compliant) or is missing any required field (email, lead type), THEN THE Lead_Capture_System SHALL reject the submission with a validation error indicating which fields failed and why.
8. THE Lead_Capture_System SHALL include a consent checkbox for marketing communications on all lead forms that is unchecked by default, and SHALL store the consent decision and timestamp with the lead record.
9. IF a visitor submits a lead form without checking the marketing consent checkbox, THEN THE Lead_Capture_System SHALL still accept and store the lead but SHALL NOT send marketing communications to that lead.
10. WHEN the same email address submits a lead form with the same lead type, THE Lead_Capture_System SHALL create a new lead record rather than rejecting the submission, preserving the history of all interactions.
11. IF more than 5 lead submissions are received from the same IP address within a 60-second window, THEN THE Lead_Capture_System SHALL reject subsequent submissions with a rate-limit error until the window expires.

### Requirement 7: ESG Calculator Widget

**User Story:** As a visitor, I want to use an interactive ESG calculator to understand my recommended impact allocation, so that I am motivated to engage further with the platform.

#### Acceptance Criteria

1. THE ESG_Calculator SHALL accept an industry selection from a predefined list and an annual ESG budget input as a numeric value in ZAR (minimum R1, maximum R999,999,999), and display a recommended percentage allocation across the platform's active project categories without requiring authentication.
2. WHEN a visitor completes the calculator inputs and submits the form, THE ESG_Calculator SHALL display a summary allocation result within 1 second, showing the total recommended annual ESG spend and a percentage breakdown across at least 3 project categories, without requiring any personal information.
3. WHEN a visitor requests the detailed personalized report from the calculator, THE ESG_Calculator SHALL display an email input field with format validation, and upon valid email submission, capture a lead of type "calculator" and present a confirmation message indicating the report delivery timeframe.
4. THE ESG_Calculator SHALL be rendered with its input fields visible within the initial viewport on the homepage and be fully functional on mobile devices, using a single-column layout below 640px with all inputs selectable and the form submittable.
5. WHEN the calculator captures a lead, THE ESG_Calculator SHALL store the visitor's selected industry and entered budget value alongside the lead record.
6. IF a visitor submits the calculator form with an empty industry selection or a budget value outside the accepted range, THEN THE ESG_Calculator SHALL display inline validation errors below the respective fields and not produce an allocation result.
7. IF a visitor submits an invalid email format when requesting the detailed report, THEN THE ESG_Calculator SHALL display an inline validation error below the email field and not submit the lead record.

### Requirement 8: Public Project Discovery

**User Story:** As a visitor or Funder, I want to browse and filter verified projects by category, so that I can find impact opportunities aligned with my ESG goals.

#### Acceptance Criteria

1. THE Platform SHALL display a public project listing page showing all projects with verification status "verified", "live", or "funded", sorted by most recently verified first, paginated at 25 projects per page with a maximum of 100 per page.
2. WHEN a visitor filters projects by category, THE Platform SHALL display only projects matching the selected taxonomy category, preserving the default sort order and pagination.
3. IF a category filter yields zero matching projects, THEN THE Platform SHALL display an empty state with an illustration and a prompt directing the visitor to browse other categories.
4. THE Platform SHALL display each project card with title (truncated to one line if exceeding display width), category name, verification badge, funding progress showing amount raised versus funding goal, primary impact metric label and value, and location country.
5. WHEN a visitor views a project detail page, THE Platform SHALL display the full project description, all impact metrics with reporting period, audit history showing each completed audit with findings and recommendation, funding progress (raised vs. goal with percentage), and ESP qualification status indicating whether the project qualifies and under which framework.
6. IF a project has no completed audits, THEN THE Platform SHALL display a notice on the project detail page indicating that verification is in progress in place of the audit history section.
7. THE Platform SHALL generate static pages for each active taxonomy category to serve as Google Ads landing pages, each containing a category-relevant headline, value proposition, trust signals, a primary lead-capture CTA above the fold, featured projects from that category, and a secondary consultation CTA.
8. THE Platform SHALL load public project listing pages within 2.5 seconds Largest Contentful Paint measured on a mobile device over a simulated 4G connection (1.6 Mbps throughput, 150ms RTT).

### Requirement 9: Audit-Ready Impact Reporting

**User Story:** As a Funder, I want to download audit-ready impact reports for my funded projects, so that I can satisfy my organization's ESG compliance requirements.

#### Acceptance Criteria

1. WHEN a Funder requests an impact report for a funded project, THE Report_Generator SHALL produce a PDF report within 30 seconds containing: project title, category, location, funding goal, funding raised, verification history, auditor findings, impact metrics (primaryMetric label and value, reportingPeriod), and the Funder's funding contribution summary.
2. THE Report_Generator SHALL support three access levels for reports: public (accessible to all users without authentication), gated (requires the visitor to provide a valid email address before access is granted), and private (accessible only to the funding Funder and Admin roles).
3. WHEN a visitor requests a gated report, THE Report_Generator SHALL validate the visitor's email format and capture a lead of type "report_request" with the visitor's email and the associated projectId before granting access to the report.
4. THE Report_Generator SHALL include in every generated report: the project's verification badge, verification score (0–100), and the full audit trail consisting of each Audit record's auditorId, findings, scoreContribution, recommendation, methodology, and completedAt date.
5. THE Report_Generator SHALL include ESP qualification details (qualifies status, qualifying category, and evidence reference) and SDG alignment (list of aligned UN SDG numbers from 1–17) to support B-BBEE compliance documentation.
6. IF report generation fails due to missing project data or a system error, THEN THE Report_Generator SHALL display an error message indicating the failure reason and shall not produce a partial or empty report.
7. IF a Funder requests a report for a project that has no completed audits, THEN THE Report_Generator SHALL produce the report with available project data and display a notice indicating that verification is pending and no audit trail is available.

### Requirement 10: Google Ads Landing Page Optimization

**User Story:** As a platform operator, I want category-specific landing pages optimized for Google Ads traffic, so that paid traffic converts at the highest possible rate.

#### Acceptance Criteria

1. THE Platform SHALL generate a dedicated landing page for each active taxonomy category at the URL path `/categories/{category-id}`.
2. WHEN a visitor arrives on a category landing page, THE Platform SHALL display a headline matching the category name, trust signals (verification badges, platform statistics), a primary CTA (lead form or calculator), between 3 and 6 featured projects in that category, and a secondary CTA (consultation request).
3. THE Platform SHALL render all category landing pages as statically generated pages to achieve a Largest Contentful Paint below 2.5 seconds.
4. WHEN a visitor arrives with UTM parameters (utm_source, utm_medium, utm_campaign, utm_content, utm_term) in the URL, THE Platform SHALL persist those parameters for the duration of the browser session and attach them to any subsequent lead capture or registration event within that session.
5. THE Platform SHALL display a sticky header with a primary CTA button visible without scrolling on all public pages.
6. THE Platform SHALL render all public pages in a mobile-first responsive layout with a single-column design below 640px viewport width.
7. IF a visitor arrives on a category landing page that has fewer than 3 featured projects, THEN THE Platform SHALL display all available projects for that category and supplement the page with a primary CTA prompting the visitor to request consultation.
8. IF a visitor navigates to a `/categories/{category-id}` URL for a category that is inactive or does not exist, THEN THE Platform SHALL return a 404 page with a link to the active categories listing.

### Requirement 11: Role-Based Dashboard

**User Story:** As an authenticated user, I want a dashboard tailored to my role, so that I can efficiently manage my activities on the platform.

#### Acceptance Criteria

1. WHEN a Funder logs in, THE Platform SHALL display a dashboard showing: a list of their funded projects (up to 25 most recent, paginated), their total impact contribution expressed as the sum of funding amounts in ZAR cents across all confirmed funding transactions, and a list of up to 10 verified projects matching their ESG profile interests that they have not yet funded.
2. WHEN a Project_Owner logs in, THE Platform SHALL display a dashboard showing: their projects with current verification status and verification badge, funding progress as a percentage of funding goal, and pending actions defined as projects in "draft" status requiring submission, projects in "submitted" status awaiting pre-screening, and projects with unresolved audit findings requiring response.
3. WHEN an Auditor logs in, THE Platform SHALL display a dashboard showing: audits assigned to them with status "pending" or "in_progress", available projects requiring verification that match at least one of their declared specializations and have no conflict of interest, and a list of their completed audits (up to 25 most recent, paginated).
4. WHEN an Admin logs in, THE Platform SHALL display a dashboard showing: auditor accounts where isApproved is false (pending approvals), projects with verificationStatus "submitted" awaiting pre-screening, a lead pipeline summary grouped by lead status (new, contacted, qualified, converted, lost) with counts per group, and platform-wide metrics including total registered users by role, total projects by verificationStatus, total funding raised across all projects, and total leads captured in the current calendar month.
5. THE Platform SHALL restrict dashboard navigation items to capabilities permitted by the authenticated user's role as defined in the access control matrix.
6. WHILE dashboard data is loading, THE Platform SHALL display skeleton placeholder elements matching the layout shape of the expected content for each dashboard section.
7. IF a dashboard section contains no data, THEN THE Platform SHALL display an illustration with a contextual action prompt directing the user to the relevant next step (e.g., "No projects yet. Submit your first." for Project_Owners with zero projects).
8. IF the Platform fails to retrieve dashboard data for any section, THEN THE Platform SHALL display an inline error message with a retry action within that section, without affecting the rendering of other dashboard sections.

### Requirement 12: Data Privacy and Compliance

**User Story:** As a platform user, I want my personal data handled in compliance with POPIA, so that my privacy rights are protected.

#### Acceptance Criteria

1. WHEN a user visits the Platform for the first time, THE Platform SHALL display a cookie consent banner requiring explicit consent before activating analytics or marketing cookies, while allowing essential cookies required for Platform functionality to remain active without consent.
2. WHEN a user requests account deletion via their account settings page, THE Platform SHALL remove all personally identifiable information (email, name, phone) from the user's Firestore document within 30 days by replacing PII field values with anonymized placeholders and retaining non-PII data for platform integrity.
3. THE Platform SHALL exclude all fields marked as PII (email, name, phone) from Cloud Functions log output.
4. THE Platform SHALL include a consent checkbox with an adjacent link to the privacy policy on all lead capture forms, and THE Platform SHALL only send marketing communications to leads whose consent checkbox was selected at the time of submission.
5. IF a lead form is submitted without the consent checkbox selected, THEN THE Lead_Capture_System SHALL store the lead for transactional purposes only and mark it as not consented for marketing.
6. WHEN a user withdraws marketing consent via their account settings, THE Platform SHALL update the user's consent status within 24 hours and cease all marketing communications to that user from that point forward.
7. WHEN the cookie consent banner is displayed, THE Platform SHALL provide options to accept all, reject non-essential, or customize cookie preferences, and THE Platform SHALL persist the user's cookie preference for a minimum of 6 months before re-prompting.

### Requirement 13: Platform Security and Access Control

**User Story:** As a platform operator, I want role-based access control enforced at the database level, so that users can only access resources appropriate to their role.

#### Acceptance Criteria

1. THE Platform SHALL enforce access control via Firestore Security Rules that validate the authenticated user's role (funder, owner, auditor, or admin) before permitting read or write operations on protected collections (users, projects, audits, leads, reports, funding, taxonomy).
2. WHEN an unauthenticated request attempts to access a protected resource, THE Platform SHALL reject the request with an UNAUTHENTICATED error and shall not return any resource data.
3. WHEN an authenticated user attempts to access a resource outside their role's permissions as defined in the Access Control Matrix, THE Platform SHALL reject the request with a PERMISSION_DENIED error and shall not return any resource data.
4. THE Platform SHALL verify Firebase ID tokens on all Cloud Function callable endpoints before processing the request.
5. IF a Firebase ID token is expired or malformed, THEN THE Platform SHALL reject the request with an UNAUTHENTICATED error.
6. THE Platform SHALL enforce rate limiting on the public lead capture endpoint, permitting no more than 5 requests per IP address within a 60-second sliding window.
7. IF a request to the public lead capture endpoint exceeds the rate limit, THEN THE Platform SHALL reject the request with a RATE_LIMITED error and shall not store the submission.
8. THE Platform SHALL include at least one hidden honeypot field on all public lead capture forms, and shall silently discard any submission where the honeypot field contains a value.
