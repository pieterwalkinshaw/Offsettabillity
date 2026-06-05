# Starting the Offsettabillity Platform Locally

## Prerequisites

- **Node.js 20+** installed
- **Firebase CLI** installed (`npm install -g firebase-tools`)
- **Java 11+** installed (required for Firebase Emulators)

## Quick Start (3 terminals)

### Terminal 1: Start Firebase Emulators

```bash
cd Offsettabillity
firebase emulators:start --project demo-offsettabillity
```

Wait until you see the emulator table showing all services running (Auth on 9099, Firestore on 8080, etc.)

### Terminal 2: Seed Sample Data

```bash
cd Offsettabillity
set FIRESTORE_EMULATOR_HOST=localhost:8080
npx tsx scripts/seed-taxonomy.ts
npx tsx scripts/seed-career-guidance-project.ts
npx tsx scripts/seed-solar-projects.ts
```

You should see "✅ seeded successfully" messages for each script.

### Terminal 3: Start Next.js Dev Server

```bash
cd Offsettabillity
npx next dev -p 3002
```

The app will start on **http://localhost:3002**

> **Note:** Port 3002 is used because ports 3000 and 3001 are typically occupied by other applications (Open WebUI, etc.) on your machine.

## Verify It Works

Open your browser to:

| URL | What you should see |
|-----|-------------------|
| http://localhost:3002 | Homepage with hero, calculator, featured projects |
| http://localhost:3002/projects | Project listing (3 verified projects) |
| http://localhost:3002/projects/pathways-to-purpose-career-guidance | Career Guidance project detail |
| http://localhost:3002/projects/sunrise-credits-solar-families | Solar Credits project detail |
| http://localhost:3002/projects/solar-schools-community-education | Solar Schools project detail |
| http://localhost:3002/contact | Contact/consultation form |
| http://localhost:3002/register | Registration page |
| http://localhost:3002/login | Login page |
| http://localhost:3002/categories/education | Education category landing page |

## Important Notes

- The **Firebase Emulators must be running** before the app can load data. If you see "Could not reach Cloud Firestore backend" errors, make sure Terminal 1 is running.
- The **seed scripts must run after emulators start**. Emulator data is lost every time emulators restart.
- The `.env.local` file sets `NEXT_PUBLIC_USE_EMULATORS=true` which tells the app to connect to local emulators instead of production Firebase.

## Stopping

- Press `Ctrl+C` in each terminal to stop the processes.
- The emulator data will be lost (you'll need to re-seed next time).

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Could not reach Cloud Firestore backend" | Firebase emulators are not running. Start Terminal 1 first. |
| "Port 3002 is in use" | Change to another port: `npx next dev -p 3003` |
| Projects show "Failed to load" | Re-run the seed scripts in Terminal 2 |
| "No projects found" on listing page | Seed data hasn't been loaded. Run seed scripts. |
| Emulators won't start (port taken) | Kill Java processes: `taskkill /F /IM java.exe` then retry |

## Project Structure (Key Files)

```
Offsettabillity/
├── .env.local              ← Environment variables (USE_EMULATORS=true)
├── firebase.json           ← Firebase/emulator configuration
├── firestore.rules         ← Firestore security rules
├── scripts/
│   ├── seed-taxonomy.ts              ← Seeds 12 project categories
│   ├── seed-career-guidance-project.ts  ← Career Guidance project
│   └── seed-solar-projects.ts        ← Solar Credits + Solar Schools
├── src/app/                ← Next.js pages
├── functions/              ← Cloud Functions (backend)
└── shared/                 ← Shared types and schemas
```
