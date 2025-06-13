import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';

afterInit();

// Initialize Express app for REST API
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

/**
 * Initialise the Admin SDK exactly once.
 */
function afterInit() {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
}

/**
 * Helper—create tenant shell if it doesn't exist.
 */
async function ensureTenant(tenantId: string) {
  const db = admin.firestore();
  const ref = db.doc(`tenants/${tenantId}`);
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
async function determineRole(tenantId: string): Promise<'admin' | 'csr'> {
  const db = admin.firestore();
  const adminsSnap = await db
    .collection(`tenants/${tenantId}/members`)
    .where('role', '==', 'admin')
    .limit(1)
    .get();
  return adminsSnap.empty ? 'admin' : 'csr';
}

/**
 * Middleware to verify Firebase Auth token
 */
const verifyToken = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// =========================
// CUSTOMERS API ENDPOINTS
// =========================

// GET /api/customers - Get all customers for a tenant
app.get('/api/customers', verifyToken, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const db = admin.firestore();
    
    const customersSnap = await db
      .collection(`tenants/${tenantId}/customers`)
      .get();
    
    const customers = customersSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ customers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET /api/customers/:id - Get specific customer
app.get('/api/customers/:id', verifyToken, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const db = admin.firestore();
    
    const customerDoc = await db
      .doc(`tenants/${tenantId}/customers/${id}`)
      .get();
    
    if (!customerDoc.exists) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json({ customer: { id: customerDoc.id, ...customerDoc.data() } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// POST /api/customers - Create new customer
app.post('/api/customers', verifyToken, async (req: any, res: any) => {
  try {
    const { tenantId, uid } = req.user;
    const customerData = req.body;
    const db = admin.firestore();
    
    const newCustomer = {
      ...customerData,
      userId: uid,
      tenantId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db
      .collection(`tenants/${tenantId}/customers`)
      .add(newCustomer);
    
    res.status(201).json({ 
      customer: { id: docRef.id, ...newCustomer }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT /api/customers/:id - Update customer
app.put('/api/customers/:id', verifyToken, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const updateData = req.body;
    const db = admin.firestore();
    
    await db
      .doc(`tenants/${tenantId}/customers/${id}`)
      .update({
        ...updateData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    
    res.json({ message: 'Customer updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE /api/customers/:id - Delete customer
app.delete('/api/customers/:id', verifyToken, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const db = admin.firestore();
    
    await db
      .doc(`tenants/${tenantId}/customers/${id}`)
      .delete();
    
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// =========================
// JOBS API ENDPOINTS
// =========================

// GET /api/jobs - Get all jobs
app.get('/api/jobs', verifyToken, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const db = admin.firestore();
    
    const jobsSnap = await db
      .collection(`tenants/${tenantId}/jobs`)
      .orderBy('createdAt', 'desc')
      .get();
    
    const jobs = jobsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// POST /api/jobs - Create new job
app.post('/api/jobs', verifyToken, async (req: any, res: any) => {
  try {
    const { tenantId, uid } = req.user;
    const jobData = req.body;
    const db = admin.firestore();
    
    const newJob = {
      ...jobData,
      userId: uid,
      tenantId,
      status: jobData.status || 'scheduled',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db
      .collection(`tenants/${tenantId}/jobs`)
      .add(newJob);
    
    res.status(201).json({ 
      job: { id: docRef.id, ...newJob }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// =========================
// PRICEBOOK API ENDPOINTS
// =========================

// GET /api/pricebook/services - Get all services
app.get('/api/pricebook/services', verifyToken, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const db = admin.firestore();
    
    const servicesSnap = await db
      .collection(`tenants/${tenantId}/services`)
      .where('active', '==', true)
      .get();
    
    const services = servicesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ services });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// GET /api/pricebook/materials - Get all materials
app.get('/api/pricebook/materials', verifyToken, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const db = admin.firestore();
    
    const materialsSnap = await db
      .collection(`tenants/${tenantId}/materials`)
      .where('active', '==', true)
      .get();
    
    const materials = materialsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ materials });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// =========================
// INVOICES API ENDPOINTS
// =========================

// GET /api/invoices - Get all invoices
app.get('/api/invoices', verifyToken, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const db = admin.firestore();
    
    const invoicesSnap = await db
      .collection(`tenants/${tenantId}/invoices`)
      .orderBy('createdAt', 'desc')
      .get();
    
    const invoices = invoicesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ invoices });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// POST /api/invoices - Create new invoice
app.post('/api/invoices', verifyToken, async (req: any, res: any) => {
  try {
    const { tenantId, uid } = req.user;
    const invoiceData = req.body;
    const db = admin.firestore();
    
    const newInvoice = {
      ...invoiceData,
      userId: uid,
      tenantId,
      status: invoiceData.status || 'draft',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db
      .collection(`tenants/${tenantId}/invoices`)
      .add(newInvoice);
    
    res.status(201).json({ 
      invoice: { id: docRef.id, ...newInvoice }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Export the API as a Firebase Function
export const api = functions.https.onRequest(app);

/**
 * Cloud Function: runs on every new user signup
 */
export const setRoleOnSignup = functions.auth.user().onCreate(async (user) => {
  // 1. Figure out tenant ID. For PoC we use domain slug. Adjust to your flow.
  const emailDomain = user.email?.split('@')[1] ?? 'defaulttenant.com';
  const tenantId = emailDomain.split('.')[0]; // acme.com -> acme

  // 2. Ensure the tenant doc exists
  await ensureTenant(tenantId);

  // 3. Decide if this user should be admin or csr
  const role: 'admin' | 'csr' = await determineRole(tenantId);

  // 4. Write the member record (so we can query later)
  await admin
    .firestore()
    .doc(`tenants/${tenantId}/members/${user.uid}`)
    .set({
      uid: user.uid,
      email: user.email,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      role
    });

  // 5. Set custom claims – these drive rules & app UI
  await admin.auth().setCustomUserClaims(user.uid, { tenantId, role });

  console.log(`Assigned role ${role} to new user ${user.uid} for tenant ${tenantId}`);
}); 