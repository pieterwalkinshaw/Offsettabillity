# Steering Document: User Roles & Permissions

**Scope:** Role definitions, access control, and user journeys for Offsettabillity.
**Principle:** Every user has a clear role with defined capabilities. Self-registration is open; trust is earned through verification.

---

## 1. Role Taxonomy

| Role | Description | Registration | Approval Required |
|------|-------------|--------------|-------------------|
| **Funder** | Corporates, NGOs, individuals who fund projects | Self-register | No |
| **Owner** | Project owners who list projects for funding | Self-register | No |
| **Auditor** | Independent professionals who verify projects | Self-register | Yes (admin approval) |
| **Admin** | Platform administrators | Invited only | N/A |

---

## 2. Role Capabilities

### Funder

| Capability | Description |
|------------|-------------|
| Browse projects | View all verified/live projects |
| Fund a project | Commit funding to a project |
| View impact reports | Access reports for funded projects |
| Download certificates | Get funding certificates for ESG reporting |
| Track portfolio | Dashboard showing all funded projects and impact |

### Owner (Project Owner)

| Capability | Description |
|------------|-------------|
| Create project | Submit a new project for verification |
| Edit project | Update project details (before verification) |
| Upload documents | Add evidence, reports, registration docs |
| View audit status | Track verification progress |
| View funding | See funding progress and funder count |
| Submit impact updates | Periodic reporting on project outcomes |

### Auditor

| Capability | Description |
|------------|-------------|
| Browse available audits | See projects needing verification in their specialty |
| Apply to audit | Request assignment to verify a project |
| Submit findings | Complete audit with score, findings, recommendation |
| Upload evidence | Attach verification evidence documents |
| View audit history | See their completed audits |

### Admin

| Capability | Description |
|------------|-------------|
| Approve auditors | Review and approve auditor registrations |
| Assign audits | Match auditors to projects |
| Pre-screen projects | Initial review before audit assignment |
| Manage taxonomy | Add/edit project categories |
| Manage leads | View, assign, update lead status |
| Feature projects | Curate homepage featured projects |
| View analytics | Platform-wide metrics and reporting |
| Manage users | Suspend/ban accounts |

---

## 3. User Journeys

### Funder Journey

```
1. Lands on site (via Google Ads or organic)
2. Uses ESG Calculator → gets suggested allocation
3. Browses verified projects by category
4. Views project detail (impact metrics, audit history)
5. Clicks "Get Full Report" → lead captured (email gate)
6. Registers account (or contacted by sales)
7. Funds a project
8. Receives impact certificate and ongoing reports
```

### Owner Journey

```
1. Registers as project owner
2. Creates project (title, description, category, location, funding goal)
3. Uploads supporting documents
4. Submits for verification
5. Admin pre-screens → assigns auditor
6. Auditor completes verification
7. Project goes live (if approved)
8. Receives funding from platform users
9. Submits periodic impact updates
```

### Auditor Journey

```
1. Registers with professional profile
2. Declares specializations and credentials
3. Admin reviews and approves account
4. Browses available projects in their specialty
5. Applies to audit a project
6. Admin assigns the audit
7. Conducts verification (document review, methodology check)
8. Submits findings with score and recommendation
9. Audit published on project page
```

---

## 4. Access Control Matrix

| Resource | Funder | Owner | Auditor | Admin | Public |
|----------|--------|-------|---------|-------|--------|
| Public project list | ✅ | ✅ | ✅ | ✅ | ✅ |
| Project detail (verified) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Project detail (draft) | ❌ | Own only | ❌ | ✅ | ❌ |
| Create project | ❌ | ✅ | ❌ | ✅ | ❌ |
| Fund project | ✅ | ❌ | ❌ | ❌ | ❌ |
| Submit audit | ❌ | ❌ | Assigned only | ✅ | ❌ |
| View leads | ❌ | ❌ | ❌ | ✅ | ❌ |
| Manage users | ❌ | ❌ | ❌ | ✅ | ❌ |
| ESG Calculator | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lead forms | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 5. Registration Fields by Role

### All Roles (Common)

- Email (required)
- Password (required)
- Full name (required)
- Phone (optional)
- Country (required)

### Funder (Additional)

- Organization name
- Organization type (corporate / NGO / government / individual)
- Industry
- Annual ESG budget (optional)
- Areas of interest (project categories)

### Owner (Additional)

- Organization name
- Organization registration number
- Organization type
- Website (optional)

### Auditor (Additional)

- Professional qualifications / certifications
- Years of experience
- Specializations (select from project categories)
- LinkedIn profile (optional)
- CV/resume upload
