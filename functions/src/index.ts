import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';

// Import email service functions
import { getEmails, sendEmail, markEmailAsRead, moveEmailToFolder, receiveEmail, addEmailAccount, getEmailAccounts } from './emailService';
import { handleGmailOAuth, refreshGmailToken, syncGmailEmails, setupGmailWatch, handleGmailWebhook, scheduledEmailSync } from './gmailOAuth';
import { sendInvitationEmail, testEmailConfiguration } from './sendInvitationEmail';

admin.initializeApp();

// Create Express app for REST API
const app = express();
app.use(cors({ 
  origin: [
    'https://pro.nexus.io',
    'https://nexus.io',
    'https://www.nexus.io',
    'http://localhost:5173', // for development
    'http://localhost:3000'  // for development
  ]
}));
app.use(express.json());

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      firestore: 'healthy',
      auth: 'healthy',
      functions: 'healthy'
    }
  });
});

/**
 * Middleware to verify Firebase ID token
 */
async function verifyToken(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Helper function to get the next available tenant ID
 */
async function getNextTenantId(): Promise<string> {
  const db = admin.firestore();
  const counterRef = db.doc('system/tenantCounter');
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let nextId = 100000; // Starting number
      if (counterDoc.exists) {
        nextId = counterDoc.data()?.lastTenantId + 1 || 100000;
      }
      
      // Update the counter
      transaction.set(counterRef, { lastTenantId: nextId }, { merge: true });
      
      return nextId.toString();
    });
    
    return result;
  } catch (error) {
    console.error('Error getting next tenant ID:', error);
    // Fallback to timestamp-based ID if counter fails
    return (100000 + Math.floor(Date.now() / 1000)).toString();
  }
}

/**
 * Cloud Function: runs on every new user signup
 */
export const setRoleOnSignup = functions.auth.user().onCreate(async (user) => {
  console.log(`New user created: ${user.uid} (${user.email})`);
  
  try {
    // Get next available tenant ID
    const tenantId = await getNextTenantId();
    console.log(`Assigning tenant ID ${tenantId} to user ${user.uid}`);
    
    // Create the tenant document with minimal info (onboarding incomplete)
    const db = admin.firestore();
    await db.doc(`tenants/${tenantId}`).set({
      ownerId: user.uid,
      ownerEmail: user.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'onboarding_pending', // Indicates onboarding not complete
      onboardingComplete: false
    });
    
    // Create member record for the user (they will become admin after onboarding)
    await db.doc(`tenants/${tenantId}/members/${user.uid}`).set({
      uid: user.uid,
      email: user.email,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      role: 'admin',
      status: 'pending_onboarding'
    });

    // Store the tenant ID in a temporary user document for onboarding lookup
    await db.doc(`users/${user.uid}`).set({
      tenantId: tenantId,
      email: user.email,
      onboardingComplete: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // DO NOT set custom claims yet - wait until onboarding is complete
    console.log(`Created tenant ${tenantId} for user ${user.uid}, awaiting onboarding completion`);
  } catch (error) {
    console.error(`Error setting up tenant for user ${user.uid}:`, error);
    // Don't throw - we don't want to prevent user creation
  }
});

/**
 * Cloud Function: complete onboarding and set custom claims
 * Updated: Force deployment
 */
export const completeOnboarding = functions.https.onCall(async (data, context) => {
  // Verify the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { companyData } = data;
  const userId = context.auth.uid;

  if (!companyData) {
    throw new functions.https.HttpsError('invalid-argument', 'Company data is required');
  }

  try {
    const db = admin.firestore();
    
    // Get the user's tenant ID from the temporary user document
    const userDoc = await db.doc(`users/${userId}`).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User setup not found');
    }
    
    const userData = userDoc.data();
    const tenantId = userData?.tenantId;
    
    if (!tenantId) {
      throw new functions.https.HttpsError('not-found', 'Tenant ID not found');
    }

    // Update tenant document with company information
    await db.doc(`tenants/${tenantId}`).update({
      ...companyData,
      status: 'active',
      onboardingComplete: true,
      onboardingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update member status
    await db.doc(`tenants/${tenantId}/members/${userId}`).update({
      status: 'active',
      onboardingCompletedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create company profile in settings
    await db.doc(`tenants/${tenantId}/settings/companyProfile`).set({
      companyName: companyData.companyName,
      phoneNumber: companyData.phoneNumber,
      email: companyData.email,
      website: companyData.website || '',
      businessAddress: companyData.businessAddress,
      city: companyData.city,
      state: companyData.state,
      zipCode: companyData.zipCode,
      industry: companyData.industry,
      employeeCount: companyData.employeeCount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create default business units based on industry
    const authorizationText = `I hereby authorize {businessunit_companyname} to proceed with the work described in the attached proposal/estimate dated [Date], including all materials, labor, and services specified therein, for the total amount of \${invoicetotal}. I understand and agree to the terms and conditions outlined in this agreement, including the project timeline, payment schedule, and scope of work. By signing below, I confirm that I have the authority to approve this work and commit to payment upon satisfactory completion.`;
    
    const industryName = companyData.industry.replace(' & ', ' ');
    const defaultBusinessUnits = [
      {
        name: companyData.companyName,
        officialName: `${industryName} - Service`,
        email: companyData.email,
        bccEmail: '',
        phoneNumber: companyData.phoneNumber,
        trade: companyData.industry,
        division: 'Service',
        tags: [],
        defaultWarehouse: '',
        currency: 'USD',
        invoiceHeader: authorizationText,
        invoiceMessage: 'Thanks for doing business with us!',
        logo: '',
        isActive: true,
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: companyData.companyName,
        officialName: `${industryName} - Repair`,
        email: companyData.email,
        bccEmail: '',
        phoneNumber: companyData.phoneNumber,
        trade: companyData.industry,
        division: 'Repair',
        tags: [],
        defaultWarehouse: '',
        currency: 'USD',
        invoiceHeader: authorizationText,
        invoiceMessage: 'Thanks for doing business with us!',
        logo: '',
        isActive: true,
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: companyData.companyName,
        officialName: `${industryName} - Maintenance`,
        email: companyData.email,
        bccEmail: '',
        phoneNumber: companyData.phoneNumber,
        trade: companyData.industry,
        division: 'Maintenance',
        tags: [],
        defaultWarehouse: '',
        currency: 'USD',
        invoiceHeader: authorizationText,
        invoiceMessage: 'Thanks for doing business with us!',
        logo: '',
        isActive: true,
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: companyData.companyName,
        officialName: `${industryName} - Installation`,
        email: companyData.email,
        bccEmail: '',
        phoneNumber: companyData.phoneNumber,
        trade: companyData.industry,
        division: 'Installation',
        tags: [],
        defaultWarehouse: '',
        currency: 'USD',
        invoiceHeader: authorizationText,
        invoiceMessage: 'Thanks for doing business with us!',
        logo: '',
        isActive: true,
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    // Create business units
    for (const businessUnit of defaultBusinessUnits) {
      await db.collection(`tenants/${tenantId}/businessUnits`).add(businessUnit);
    }

    // Create default job types
    const defaultJobTypes = [
      {
        name: 'Service Call',
        description: 'General service call for maintenance, repairs, or troubleshooting',
        category: 'Service Call',
        isActive: true,
        status: 'active',
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'Estimate',
        description: 'On-site estimate for potential work or installation',
        category: 'Estimate',
        isActive: true,
        status: 'active',
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'Diagnosis',
        description: 'Diagnostic service to identify issues and recommend solutions',
        category: 'Diagnosis',
        isActive: true,
        status: 'active',
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    // Create job types
    for (const jobType of defaultJobTypes) {
      await db.collection(`tenants/${tenantId}/jobTypes`).add(jobType);
    }

    console.log(`Created ${defaultBusinessUnits.length} default business units and ${defaultJobTypes.length} default job types for tenant ${tenantId}`);

    // NOW set custom claims - this enables access to the app
    await admin.auth().setCustomUserClaims(userId, { tenantId, role: 'admin' });

    // Update user document to mark onboarding complete
    await db.doc(`users/${userId}`).update({
      onboardingComplete: true,
      onboardingCompletedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Onboarding completed for user ${userId}, tenant ${tenantId}`);
    
    return { success: true, tenantId, role: 'admin' };
  } catch (error) {
    console.error('Error completing onboarding:', error);
    throw new functions.https.HttpsError('internal', 'Failed to complete onboarding');
  }
});

/**
 * Cloud Function: manually assign tenant and role to user after onboarding
 * This is now mainly for invited users or role changes
 */
export const assignTenantToUser = functions.https.onCall(async (data, context) => {
  // Verify the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { tenantId, role = 'admin' } = data;
  const userId = context.auth.uid;

  if (!tenantId) {
    throw new functions.https.HttpsError('invalid-argument', 'tenantId is required');
  }

  try {
    // Set custom claims for the user
    await admin.auth().setCustomUserClaims(userId, { tenantId, role });

    console.log(`Assigned tenant ${tenantId} and role ${role} to user ${userId}`);
    
    return { success: true, tenantId, role };
  } catch (error) {
    console.error('Error assigning tenant to user:', error);
    throw new functions.https.HttpsError('internal', 'Failed to assign tenant');
  }
});

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

// Export email service functions
export { getEmails, sendEmail, markEmailAsRead, moveEmailToFolder, receiveEmail, addEmailAccount, getEmailAccounts, handleGmailOAuth, refreshGmailToken, syncGmailEmails, setupGmailWatch, handleGmailWebhook, scheduledEmailSync, sendInvitationEmail, testEmailConfiguration }; 