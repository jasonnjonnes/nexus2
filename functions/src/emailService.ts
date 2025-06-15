import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

// Configuration for higher memory allocation
const runtimeOpts: functions.RuntimeOptions = {
  timeoutSeconds: 120,
  memory: '512MB'
};

// Email configuration - you can customize these based on your email provider
const createTransporter = () => {
  // Option 1: Gmail (recommended for most users)
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: functions.config().email?.gmail?.user || process.env.GMAIL_USER,
      pass: functions.config().email?.gmail?.password || process.env.GMAIL_APP_PASSWORD
    }
  });

  // Option 2: SMTP (for custom email servers)
  // return nodemailer.createTransport({
  //   host: functions.config().email?.smtp?.host,
  //   port: 587,
  //   secure: false,
  //   auth: {
  //     user: functions.config().email?.smtp?.user,
  //     pass: functions.config().email?.smtp?.password
  //   }
  // });
};

/**
 * Get emails for a tenant - retrieves from Firestore email collection
 */
export const getEmails = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { tenantId, folder = 'inbox', limit = 50 } = data;
  const userId = context.auth.uid;

  try {
    const db = admin.firestore();
    
    // Verify user has access to this tenant
    const memberDoc = await db.doc(`tenants/${tenantId}/members/${userId}`).get();
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }

    // Get emails from the specified folder
    // First check if the emails collection exists
    const emailsCollection = db.collection(`tenants/${tenantId}/emails`);
    
    try {
      const emailsQuery = emailsCollection
        .where('folder', '==', folder)
        .orderBy('receivedAt', 'desc')
        .limit(limit);

      const snapshot = await emailsQuery.get();
      const emails = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return { emails };
    } catch (indexError) {
      // If index doesn't exist, return empty array
      console.log('Index not ready yet, returning empty emails array');
      return { emails: [] };
    }
  } catch (error) {
    console.error('Error getting emails:', error);
    throw new functions.https.HttpsError('internal', 'Failed to retrieve emails');
  }
});

/**
 * Send email function
 */
export const sendEmail = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { tenantId, to, cc, bcc, subject, body, attachments = [] } = data;
  const userId = context.auth.uid;

  try {
    const db = admin.firestore();
    
    // Verify user has access to this tenant
    const memberDoc = await db.doc(`tenants/${tenantId}/members/${userId}`).get();
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }

    // Get user info for the "from" address
    const userDoc = await db.doc(`tenants/${tenantId}/members/${userId}`).get();
    const userData = userDoc.data();
    const fromEmail = userData?.email || context.auth.token.email;

    // Create transporter
    const transporter = createTransporter();

    // Prepare email options
    const mailOptions: any = {
      from: fromEmail,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html: body,
      attachments: attachments.map((attachment: any) => ({
        filename: attachment.filename,
        content: attachment.content,
        encoding: 'base64'
      }))
    };

    if (cc && cc.length > 0) {
      mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc;
    }
    if (bcc && bcc.length > 0) {
      mailOptions.bcc = Array.isArray(bcc) ? bcc.join(', ') : bcc;
    }

    // Send email
    const info = await transporter.sendMail(mailOptions);

    // Store sent email in Firestore
    const emailDoc = {
      tenantId,
      userId,
      messageId: info.messageId,
      from: fromEmail,
      to: mailOptions.to,
      cc: mailOptions.cc || '',
      bcc: mailOptions.bcc || '',
      subject,
      body,
      folder: 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'sent',
      attachments: attachments.map((att: any) => ({
        filename: att.filename,
        size: att.size || 0
      }))
    };

    await db.collection(`tenants/${tenantId}/emails`).add(emailDoc);

    return { 
      success: true, 
      messageId: info.messageId,
      message: 'Email sent successfully' 
    };

  } catch (error) {
    console.error('Error sending email:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send email');
  }
});

/**
 * Mark email as read/unread
 */
export const markEmailAsRead = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { tenantId, emailId, isRead = true } = data;
  const userId = context.auth.uid;

  try {
    const db = admin.firestore();
    
    // Verify user has access to this tenant
    const memberDoc = await db.doc(`tenants/${tenantId}/members/${userId}`).get();
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }

    // Update email read status
    await db.doc(`tenants/${tenantId}/emails/${emailId}`).update({
      isRead,
      readAt: isRead ? admin.firestore.FieldValue.serverTimestamp() : null,
      readBy: isRead ? userId : null
    });

    return { success: true };
  } catch (error) {
    console.error('Error marking email as read:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update email');
  }
});

/**
 * Move email to folder (inbox, sent, trash, etc.)
 */
export const moveEmailToFolder = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { tenantId, emailId, folder } = data;
  const userId = context.auth.uid;

  try {
    const db = admin.firestore();
    
    // Verify user has access to this tenant
    const memberDoc = await db.doc(`tenants/${tenantId}/members/${userId}`).get();
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }

    // Update email folder
    await db.doc(`tenants/${tenantId}/emails/${emailId}`).update({
      folder,
      movedAt: admin.firestore.FieldValue.serverTimestamp(),
      movedBy: userId
    });

    return { success: true };
  } catch (error) {
    console.error('Error moving email:', error);
    throw new functions.https.HttpsError('internal', 'Failed to move email');
  }
});

/**
 * Initialize email sync for a tenant (webhook endpoint for incoming emails)
 * This would be called by your email provider's webhook
 */
export const receiveEmail = functions.runWith(runtimeOpts).https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    // This is a webhook endpoint - you'll need to configure your email provider
    // to send incoming emails here. The exact format depends on your provider.
    
    const { tenantId, from, to, subject, body, messageId, receivedAt } = req.body;
    
    const db = admin.firestore();
    
    // Store incoming email
    const emailDoc = {
      tenantId,
      messageId,
      from,
      to,
      subject,
      body,
      folder: 'inbox',
      isRead: false,
      receivedAt: new Date(receivedAt),
      status: 'received',
      source: 'webhook'
    };

    await db.collection(`tenants/${tenantId}/emails`).add(emailDoc);

    res.status(200).json({ success: true, message: 'Email received' });
  } catch (error) {
    console.error('Error receiving email:', error);
    res.status(500).json({ error: 'Failed to process email' });
  }
});

/**
 * Add email account for OAuth integration
 */
export const addEmailAccount = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { tenantId, provider, email } = data;

  if (!tenantId || !provider) {
    throw new functions.https.HttpsError('invalid-argument', 'Tenant ID and provider are required');
  }

  try {
    // Store email account configuration
    const accountRef = admin.firestore()
      .collection('tenants')
      .doc(tenantId)
      .collection('emailAccounts')
      .doc();

    const accountData = {
      id: accountRef.id,
      provider,
      email: email || `${provider}@example.com`,
      displayName: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Account`,
      isConnected: false, // Will be true after OAuth flow
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSync: null,
      settings: {
        // OAuth settings will be stored here after authentication
        clientId: '',
        refreshToken: '',
        accessToken: ''
      }
    };

    await accountRef.set(accountData);

    // Generate OAuth URL based on provider
    let oauthUrl = '';
    switch (provider) {
      case 'gmail':
        oauthUrl = generateGmailOAuthUrl(accountRef.id);
        console.log('Generated Gmail OAuth URL:', oauthUrl);
        break;
      case 'outlook':
        oauthUrl = generateOutlookOAuthUrl(accountRef.id);
        break;
      case 'icloud':
        oauthUrl = generateICloudOAuthUrl(accountRef.id);
        break;
      case 'yahoo':
        oauthUrl = generateYahooOAuthUrl(accountRef.id);
        break;
      default:
        oauthUrl = `${functions.config().app?.url || 'http://localhost:3000'}/email-setup?provider=${provider}`;
    }

    return {
      success: true,
      accountId: accountRef.id,
      oauthUrl,
      message: `${provider} account setup initiated. Complete OAuth flow to connect.`
    };
  } catch (error) {
    console.error('Error adding email account:', error);
    throw new functions.https.HttpsError('internal', 'Failed to add email account');
  }
});

/**
 * Get email accounts for a tenant
 */
export const getEmailAccounts = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { tenantId } = data;

  if (!tenantId) {
    throw new functions.https.HttpsError('invalid-argument', 'Tenant ID is required');
  }

  try {
    const accountsSnapshot = await admin.firestore()
      .collection('tenants')
      .doc(tenantId)
      .collection('emailAccounts')
      .orderBy('createdAt', 'desc')
      .get();

    const accounts = accountsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        provider: data.provider,
        email: data.email,
        displayName: data.displayName,
        isConnected: data.isConnected,
        lastSync: data.lastSync
      };
    });

    return { success: true, accounts };
  } catch (error) {
    console.error('Error getting email accounts:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get email accounts');
  }
});

// Helper functions for OAuth URL generation
function generateGmailOAuthUrl(accountId: string): string {
  const clientId = functions.config().oauth?.gmail?.client_id || process.env.GMAIL_CLIENT_ID;
  const redirectUri = functions.config().oauth?.gmail?.redirect_uri || 'https://us-central1-servicepro-4c705.cloudfunctions.net/handleGmailOAuth';
  
  return `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile&` +
    `state=${accountId}&` +
    `access_type=offline&` +
    `prompt=consent`;
}

function generateOutlookOAuthUrl(accountId: string): string {
  const clientId = functions.config().oauth?.outlook?.client_id || process.env.OUTLOOK_CLIENT_ID;
  const redirectUri = `${functions.config().app?.url || 'http://localhost:3000'}/oauth/outlook/callback`;
  
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=https://graph.microsoft.com/mail.read https://graph.microsoft.com/mail.send&` +
    `state=${accountId}`;
}

function generateICloudOAuthUrl(accountId: string): string {
  // iCloud uses app-specific passwords, not OAuth
  return `${functions.config().app?.url || 'http://localhost:3000'}/email-setup?provider=icloud&account=${accountId}`;
}

function generateYahooOAuthUrl(accountId: string): string {
  const clientId = functions.config().oauth?.yahoo?.client_id || process.env.YAHOO_CLIENT_ID;
  const redirectUri = `${functions.config().app?.url || 'http://localhost:3000'}/oauth/yahoo/callback`;
  
  return `https://api.login.yahoo.com/oauth2/request_auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=mail-r mail-w&` +
    `state=${accountId}`;
} 