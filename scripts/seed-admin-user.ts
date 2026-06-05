/**
 * Seed Script: Create Admin User
 *
 * Creates an admin user in both Firebase Auth emulator and Firestore emulator.
 * Use this account to log in as the platform administrator.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx tsx scripts/seed-admin-user.ts
 *
 * Login credentials:
 *   Email:    admin@Offsettable.co.za
 *   Password: Admin123!
 */

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-Offsettable',
});

const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = 'admin@Offsettable.co.za';
const ADMIN_PASSWORD = 'Admin123!';
const ADMIN_NAME = 'Platform Admin';

async function seedAdminUser(): Promise<void> {
  console.log('🔐 Seeding Admin User...\n');

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`  Firestore emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  }
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.log(`  Auth emulator: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  }

  let userId: string;

  // Create or update Auth user
  try {
    const existingUser = await auth.getUserByEmail(ADMIN_EMAIL);
    userId = existingUser.uid;
    console.log(`\n  Auth user already exists: ${userId}`);
  } catch {
    const userRecord = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: ADMIN_NAME,
      emailVerified: true,
    });
    userId = userRecord.uid;
    console.log(`\n  Created Auth user: ${userId}`);
  }

  // Create Firestore user document
  const userDoc = {
    userId,
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    role: 'admin',
    country: 'ZA',
    isApproved: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.collection('users').doc(userId).set(userDoc, { merge: true });
  console.log(`  Created Firestore user document with role: admin`);

  console.log('\n✅ Admin user created successfully!\n');
  console.log('  ┌─────────────────────────────────────────┐');
  console.log('  │  LOGIN CREDENTIALS                      │');
  console.log('  ├─────────────────────────────────────────┤');
  console.log(`  │  Email:    ${ADMIN_EMAIL}  │`);
  console.log(`  │  Password: ${ADMIN_PASSWORD}                     │`);
  console.log('  └─────────────────────────────────────────┘');
  console.log(`\n  Login at: http://localhost:3002/login`);
}

seedAdminUser().catch((error) => {
  console.error('Failed to seed admin user:', error);
  process.exit(1);
});
