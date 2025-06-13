import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

afterInit();

/**
 * Initialise the Admin SDK exactly once.
 */
function afterInit() {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
}

/**
 * Helper—create company shell if it doesn't exist.
 */
async function ensureCompany(companyId: string) {
  const db = admin.firestore();
  const ref = db.doc(`companies/${companyId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

/**
 * Determines role for new signup.
 * If no admin exists, return 'admin', otherwise 'csr'.
 */
async function determineRole(companyId: string): Promise<'admin' | 'csr'> {
  const db = admin.firestore();
  const adminsSnap = await db
    .collection(`companies/${companyId}/members`)
    .where('role', '==', 'admin')
    .limit(1)
    .get();
  return adminsSnap.empty ? 'admin' : 'csr';
}

/**
 * Cloud Function: runs on every new user signup
 */
export const setRoleOnSignup = functions.auth.user().onCreate(async (user) => {
  // 1. Figure out company ID. For PoC we use domain slug. Adjust to your flow.
  const emailDomain = user.email?.split('@')[1] ?? 'defaultco.com';
  const companyId = emailDomain.split('.')[0]; // acme.com -> acme

  // 2. Ensure the company doc exists
  await ensureCompany(companyId);

  // 3. Decide if this user should be admin or csr
  const role: 'admin' | 'csr' = await determineRole(companyId);

  // 4. Write the member record (so we can query later)
  await admin
    .firestore()
    .doc(`companies/${companyId}/members/${user.uid}`)
    .set({
      uid: user.uid,
      email: user.email,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      role
    });

  // 5. Set custom claims – these drive rules & app UI
  await admin.auth().setCustomUserClaims(user.uid, { companyId, role });

  console.log(`Assigned role ${role} to new user ${user.uid} for company ${companyId}`);
}); 