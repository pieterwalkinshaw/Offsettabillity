# Requirements Document

## Introduction

The Carbon Credit Marketplace enables organisations to purchase measurable carbon credits generated from verified solar installations on the Offsettable platform. The feature introduces a credit inventory system, flexible and packaged purchasing options, per-purchase PDF certificates for ESG audit evidence, and a cumulative sustainability dashboard with export capabilities. The existing funder role is extended to support carbon credit purchases alongside existing funding activities.

## Glossary

- **Marketplace**: The carbon credit browsing and purchasing interface within the funder dashboard
- **Credit_Inventory**: A Firestore collection tracking available carbon credit stock derived from verified solar project CO₂e metrics
- **Carbon_Credit**: A unit representing one metric ton of CO₂e avoided by a verified solar installation
- **Credit_Package**: A predefined bundle of carbon credits offered at a volume discount (e.g. Bronze, Silver, Gold)
- **Purchase_Transaction**: A Firestore document recording a completed carbon credit purchase by a funder
- **Certificate_Generator**: A Cloud Function that produces a PDF certificate for a confirmed purchase
- **Sustainability_Dashboard**: A section of the funder dashboard displaying cumulative offset history and reporting tools
- **Funder**: An authenticated user with the role "funder" who can browse projects, fund projects, and purchase carbon credits
- **Admin**: An authenticated user with the role "admin" who manages platform operations including credit inventory and packages

## Requirements

### Requirement 1: Credit Inventory Management

**User Story:** As an admin, I want carbon credit inventory derived from verified solar projects so that buyers can only purchase credits backed by real impact data.

#### Acceptance Criteria

1. WHEN a solar project reaches "verified" or "live" verificationStatus, THE Credit_Inventory SHALL create an inventory record containing the projectId, available tonnage derived from impactMetrics.primaryMetric, and a timestamp.
2. THE Credit_Inventory SHALL store available tonnage as a numeric value representing metric tons of CO₂e with precision to two decimal places.
3. WHEN a purchase is confirmed, THE Credit_Inventory SHALL decrement the available tonnage for the associated project by the purchased quantity within an atomic Firestore transaction.
4. IF a purchase request exceeds the available tonnage for a project, THEN THE Marketplace SHALL reject the purchase and return an INSUFFICIENT_INVENTORY error code with the current available quantity.
5. THE Credit_Inventory SHALL expose a total available credits value aggregated across all eligible solar projects for display in the Marketplace.

### Requirement 2: Flexible Quantity Purchasing

**User Story:** As a funder, I want to specify a custom number of tons of CO₂e to offset so that I can match my exact sustainability targets.

#### Acceptance Criteria

1. THE Marketplace SHALL allow the Funder to enter a custom quantity of carbon credits in metric tons with a minimum of 1 ton and a maximum of the total available inventory.
2. WHEN the Funder enters a custom quantity, THE Marketplace SHALL display the calculated price in ZAR integer cents based on the per-ton unit price.
3. THE Marketplace SHALL validate that the requested quantity is a positive number with up to two decimal places.
4. WHEN the Funder confirms a custom quantity purchase, THE Purchase_Transaction SHALL record the quantity, unit price, total amount in ZAR integer cents, currency code, funderId, associated projectId allocations, and a timestamp.

### Requirement 3: Credit Package Purchasing

**User Story:** As a funder, I want to quick-select a preset package with volume discounts so that I can purchase carbon credits without calculating quantities manually.

#### Acceptance Criteria

1. THE Marketplace SHALL display at least three Credit_Package options (Bronze, Silver, Gold) with defined tonnage quantities and discounted per-ton pricing.
2. WHEN the Funder selects a Credit_Package, THE Marketplace SHALL display the package tonnage, discount percentage relative to unit price, and total price in ZAR.
3. THE Admin SHALL be able to create, update, and deactivate Credit_Package definitions including name, tonnage quantity, price in ZAR integer cents, and active status.
4. THE Marketplace SHALL only display Credit_Package options with active status set to true.
5. IF the available inventory is less than a Credit_Package tonnage, THEN THE Marketplace SHALL disable that package option and display an "Insufficient stock" indicator.

### Requirement 4: Purchase Transaction Processing

**User Story:** As a funder, I want my carbon credit purchase to be processed securely so that I receive confirmation and my offset is recorded.

#### Acceptance Criteria

1. WHEN the Funder submits a purchase, THE Marketplace SHALL validate the request using a Zod schema checking projectId allocations, quantity, and payment details.
2. THE Purchase_Transaction SHALL use the same status lifecycle as FundingTransaction: pending, confirmed, failed, refunded.
3. WHEN a Purchase_Transaction status changes to "confirmed", THE Credit_Inventory SHALL decrement available tonnage atomically.
4. IF a Purchase_Transaction fails, THEN THE Credit_Inventory SHALL retain the original available tonnage without decrement.
5. THE Purchase_Transaction SHALL store amount values as ZAR integer cents consistent with the existing FundingTransaction pattern.
6. WHEN a purchase is confirmed, THE Marketplace SHALL display a full-page confirmation with purchase summary, tonnage offset, and a link to download the certificate.

### Requirement 5: PDF Certificate Generation

**User Story:** As a funder, I want a PDF certificate for each purchase so that I can use it as ESG audit evidence.

#### Acceptance Criteria

1. WHEN a Purchase_Transaction status changes to "confirmed", THE Certificate_Generator SHALL produce a PDF certificate within 30 seconds.
2. THE Certificate_Generator SHALL include on the certificate: a unique certificate ID, purchase date, funder organisation name, tonnage offset, project title, project location, and a verification reference linking to the source solar project.
3. THE Certificate_Generator SHALL store the PDF in Cloud Storage at the path `certificates/{funderId}/{transactionId}.pdf`.
4. THE Certificate_Generator SHALL create a Firestore document referencing the certificate storage path, transactionId, funderId, and generation timestamp.
5. THE Sustainability_Dashboard SHALL provide a download link for each certificate accessible only to the owning Funder and Admin roles.
6. THE Certificate_Generator SHALL assign each certificate a unique alphanumeric ID of at least 12 characters for third-party audit verification.

### Requirement 6: Sustainability Dashboard

**User Story:** As a funder, I want a cumulative sustainability dashboard so that I can track my total offset history over time for ESG reporting.

#### Acceptance Criteria

1. THE Sustainability_Dashboard SHALL display the Funder's total CO₂e offset in metric tons aggregated across all confirmed purchases.
2. THE Sustainability_Dashboard SHALL display a timeline chart showing monthly offset quantities over the trailing 12 months.
3. THE Sustainability_Dashboard SHALL display a breakdown of offsets by source solar project including project title, location, and tonnage attributed.
4. THE Sustainability_Dashboard SHALL render loading, empty, loaded, and error states following the five UI states pattern.
5. WHEN the Funder has zero confirmed purchases, THE Sustainability_Dashboard SHALL display an empty state with a call-to-action directing the Funder to the Marketplace.

### Requirement 7: Sustainability Report Export

**User Story:** As a funder, I want to export my offset history as CSV and PDF so that I can include it in annual ESG reports.

#### Acceptance Criteria

1. THE Sustainability_Dashboard SHALL provide an export control allowing the Funder to select a date range for the report.
2. WHEN the Funder requests a CSV export, THE Sustainability_Dashboard SHALL generate a file containing columns: date, project title, tonnage, amount paid (ZAR), certificate ID.
3. WHEN the Funder requests a PDF export, THE Sustainability_Dashboard SHALL generate a formatted report containing: organisation name, reporting period, total tonnage offset, per-project breakdown, and a list of certificate IDs.
4. THE Sustainability_Dashboard SHALL restrict export generation to Funder and Admin roles.

### Requirement 8: Funder Dashboard Integration

**User Story:** As a funder, I want to access carbon credits from my existing dashboard so that I do not need a separate login or navigation flow.

#### Acceptance Criteria

1. THE Funder dashboard SHALL include a "Carbon Credits" navigation item in the sidebar alongside existing funding views.
2. WHEN the Funder navigates to the Carbon Credits section, THE Marketplace SHALL display available credits, package options, and a custom quantity input.
3. THE Funder dashboard overview page SHALL display a summary card showing total CO₂e offset alongside existing funding metrics.
4. THE Marketplace navigation SHALL use query parameters for state management consistent with the existing static export architecture.

### Requirement 9: Access Control

**User Story:** As a platform operator, I want carbon credit purchasing restricted to authorised funders so that only verified users can transact.

#### Acceptance Criteria

1. THE Marketplace purchase endpoints SHALL require Firebase Auth authentication with a valid funder role.
2. IF an unauthenticated user attempts to access purchase functions, THEN THE Marketplace SHALL return an UNAUTHENTICATED error code.
3. IF a user with a role other than funder attempts to purchase credits, THEN THE Marketplace SHALL return a PERMISSION_DENIED error code.
4. THE Admin SHALL have read access to all Purchase_Transaction records and certificate documents for platform oversight.
5. THE Funder SHALL have read access only to Purchase_Transaction records and certificates associated with their own funderId.
