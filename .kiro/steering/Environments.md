# Steering Document: Environments & Pipeline

**Scope:** Environment strategy, local development setup, and deployment pipeline for Offsettabillity.
**Principle:** Dev is fast and offline-capable. Prod is Firebase Hosting with zero cost at low traffic.

---

## 1. Pipeline: Dev → Prod

| Environment | Purpose                          | Firebase Services      | Data              |
| ----------- | -------------------------------- | ---------------------- | ----------------- |
| **Dev**     | Local development & testing      | **Emulators**          | Seed/mock data    |
| **Prod**    | Production users                 | **Live Firebase**      | Real user data    |

### Promotion Flow

```
feature branch → Dev (local emulators) → PR → CI (build + lint) → main → Prod (Firebase Hosting)
```

- Code only reaches Prod after passing CI checks on the PR.
- No staging environment needed at this scale (free tier constraint).
- Use Firebase preview channels for PR previews if needed.

---

## 2. Local Development Setup

### Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Java 11+ (required for Firebase Emulators)

### Local Stack (Firebase Emulators)

| Service         | Emulator Port | Purpose |
| --------------- | ------------- | ------- |
| Auth            | 9099          | User authentication |
| Firestore       | 8080          | Database |
| Functions       | 5001          | Cloud Functions |
| Hosting         | 5000          | Static hosting |
| Storage         | 9199          | File uploads |

### Running Locally

```bash
# Start Firebase emulators
firebase emulators:start

# In another terminal, start Next.js dev server
npm run dev
```

### Environment Variables

```
# .env.local (gitignored)
NEXT_PUBLIC_FIREBASE_API_KEY=demo-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-offsettabillity
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-offsettabillity.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:demo
NEXT_PUBLIC_USE_EMULATORS=true
```

- A `.env.example` file (committed) documents all required variables without values.

---

## 3. Seed Data

- A `scripts/seed.ts` script populates the Firestore emulator with realistic test data.
- Seed data includes: sample users (all roles), projects (all categories and statuses), sample audits, and leads.
- Seed data must be idempotent — running it twice produces the same state.
- Run with: `npx ts-node scripts/seed.ts`

---

## 4. Production Environment

- Deployed from `main` branch via GitHub Actions.
- Firebase Hosting serves the Next.js static export.
- Cloud Functions deployed alongside.
- Firestore Security Rules deployed from `firestore.rules`.
- All secrets stored in Firebase environment configuration.
- Domain: custom domain pointed at Firebase Hosting.

---

## 5. CI/CD (GitHub Actions)

### On Pull Request

1. Install dependencies
2. TypeScript type check (`tsc --noEmit`)
3. ESLint
4. Build (`next build`)
5. (Optional) Deploy to Firebase preview channel

### On Merge to Main

1. All PR checks pass
2. Build Next.js for production
3. Deploy to Firebase Hosting
4. Deploy Cloud Functions
5. Deploy Firestore rules and indexes

---

## 6. Branching Strategy

- `main` — production-ready, auto-deploys to Firebase.
- Feature branches: `feature/<short-description>`.
- Bugfix branches: `fix/<short-description>`.
- No `develop` branch needed at this scale.
