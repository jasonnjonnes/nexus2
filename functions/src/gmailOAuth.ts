import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

// Configuration for higher memory allocation
const runtimeOpts: functions.RuntimeOptions = {
  timeoutSeconds: 120,
  memory: '512MB'
};

/**
 * Handle Gmail OAuth callback and exchange code for tokens
 */
export const handleGmailOAuth = functions.runWith(runtimeOpts).https.onRequest(async (req, res): Promise<void> => {
  // Set CORS headers for all allowed origins
  const allowedOrigins = functions.config().app?.allowed_origins || [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5177',
    'http://localhost:5178',
    'http://localhost:5000',
    'http://localhost',
    'https://servicepro-4c705.firebaseapp.com',
    'https://nexus2--servicepro-4c705.us-central1.hosted.app',
    'https://pro.nexusinc.io'
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { code, state, error, popup } = req.query;
    const isPopup = popup === 'true';

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      const appUrl = origin || functions.config().app?.url || 'http://localhost:5173';
      const errorUrl = `${appUrl}/inbound?oauth_error=${error}`;
      
      // Always return HTML that can handle both popup and redirect scenarios
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>OAuth Error</title>
        </head>
        <body>
          <script>
            try {
              if (window.opener && !window.opener.closed) {
                // This is a popup window
                window.opener.postMessage({
                  type: 'OAUTH_ERROR',
                  error: '${error}'
                }, '${appUrl}');
                window.close();
              } else {
                // This is a redirect or popup without opener
                window.location.href = '${errorUrl}';
              }
            } catch (err) {
              console.error('Error handling OAuth error:', err);
              window.location.href = '${errorUrl}';
            }
          </script>
          <p>Authentication failed: ${error}</p>
        </body>
        </html>
      `;
      res.send(html);
      return;
    }

    if (!code || !state) {
      res.status(400).json({ error: 'Missing authorization code or state' });
      return;
    }

    let decodedState;
    try {
      const stateJson = Buffer.from(state as string, 'base64').toString('utf-8');
      decodedState = JSON.parse(stateJson);
    } catch (e) {
      console.error('Invalid state parameter:', e);
      res.status(400).json({ error: 'Invalid state parameter' });
      return;
    }

    const { accountId, tenantId, returnUrl } = decodedState;
    
    // Optional: Verify CSRF token if you implement it on the client side
    // For example, by storing it in the user's session or a secure, httpOnly cookie

    if (!tenantId) {
      console.error('Missing tenantId in state');
      res.status(400).json({ error: 'Invalid state: missing tenant ID' });
      return;
    }

    // Get OAuth configuration
    const clientId = functions.config().oauth?.gmail?.client_id;
    const clientSecret = functions.config().oauth?.gmail?.client_secret;
    const redirectUri = functions.config().oauth?.gmail?.redirect_uri;

    console.log('OAuth Configuration:', { clientId, redirectUri, hasClientSecret: !!clientSecret });

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Missing OAuth configuration');
      res.status(500).json({ error: 'OAuth configuration not found' });
      return;
    }

    // Initialize Google OAuth2 client
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    console.log('Attempting token exchange with redirect URI:', redirectUri);

    // Exchange code for tokens - try manual approach to debug redirect URI issue
    console.log('Exchanging code for tokens with:', { code: code as string, redirectUri });
    console.log('Full request URL:', req.url);
    console.log('Request query params:', req.query);
    
    // Manual token exchange to debug the redirect URI issue
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code as string,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    });

    console.log('Token exchange params:', Object.fromEntries(tokenParams.entries()));

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString()
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response status:', tokenResponse.status);
    console.log('Token response:', tokenData);

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    const tokens = tokenData;

    if (!tokens.access_token) {
      res.status(400).json({ error: 'Failed to obtain access token' });
      return;
    }

    // Set credentials to get user info
    oauth2Client.setCredentials(tokens);
    
    // Get user's email address
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Get the email account document directly using tenantId and accountId
    const db = admin.firestore();
    const accountRef = db.doc(`tenants/${tenantId}/emailAccounts/${accountId}`);
    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      res.status(404).json({ error: 'Email account not found' });
      return;
    }

    // Calculate expiry date from expires_in if expiry_date is not provided
    const expiryDate = tokens.expiry_date || (tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : null);

    // Update account with OAuth tokens and user info
    await accountRef.update({
      isConnected: true,
      email: userInfo.data.email,
      displayName: userInfo.data.name || `Gmail - ${userInfo.data.email}`,
      lastSync: admin.firestore.FieldValue.serverTimestamp(),
      settings: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: expiryDate,
        tokenType: tokens.token_type || 'Bearer',
        scope: tokens.scope,
        clientId,
        clientSecret
      },
      userInfo: {
        id: userInfo.data.id,
        email: userInfo.data.email,
        name: userInfo.data.name,
        picture: userInfo.data.picture
      },
      connectedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Redirect back to the application with success
    const appUrl = returnUrl || functions.config().app?.url || 'http://localhost:5173';
    const successUrl = `${appUrl}/inbound?oauth_success=true&provider=gmail`;
    
    console.log('OAuth success, isPopup:', isPopup);
    
    // Always return HTML that can handle both popup and redirect scenarios
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Success</title>
      </head>
      <body>
        <script>
          try {
            if (window.opener && !window.opener.closed) {
              // This is a popup window
              window.opener.postMessage({
                type: 'OAUTH_SUCCESS',
                provider: 'gmail'
              }, '${appUrl}');
              window.close();
            } else {
              // This is a redirect or popup without opener
              window.location.href = '${successUrl}';
            }
          } catch (error) {
            console.error('Error handling OAuth response:', error);
            window.location.href = '${successUrl}';
          }
        </script>
        <p>Authentication successful! This window should close automatically or redirect you back to the app.</p>
      </body>
      </html>
    `;
    res.send(html);

  } catch (error) {
    console.error('Error handling Gmail OAuth:', error);
    res.status(500).json({ error: 'Failed to process OAuth callback' });
  }
});

/**
 * Refresh Gmail OAuth token
 */
export const refreshGmailToken = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { tenantId, accountId } = data;

  if (!tenantId || !accountId) {
    throw new functions.https.HttpsError('invalid-argument', 'Tenant ID and account ID are required');
  }

  try {
    const db = admin.firestore();
    
    // Verify user has access to this tenant
    const memberDoc = await db.doc(`tenants/${tenantId}/members/${context.auth.uid}`).get();
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }

    // Get email account
    const accountDoc = await db.doc(`tenants/${tenantId}/emailAccounts/${accountId}`).get();
    if (!accountDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Email account not found');
    }

    const accountData = accountDoc.data();
    const settings = accountData?.settings;

    if (!settings?.refreshToken) {
      throw new functions.https.HttpsError('failed-precondition', 'No refresh token available');
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      settings.clientId,
      settings.clientSecret,
      functions.config().oauth?.gmail?.redirect_uri
    );

    oauth2Client.setCredentials({
      refresh_token: settings.refreshToken
    });

    // Refresh the token
    const { credentials } = await oauth2Client.refreshAccessToken();

    // Update stored tokens
    await accountDoc.ref.update({
      'settings.accessToken': credentials.access_token,
      'settings.expiryDate': credentials.expiry_date,
      lastSync: admin.firestore.FieldValue.serverTimestamp()
    });

    return { 
      success: true, 
      message: 'Token refreshed successfully',
      accessToken: credentials.access_token
    };

  } catch (error) {
    console.error('Error refreshing Gmail token:', error);
    throw new functions.https.HttpsError('internal', 'Failed to refresh token');
  }
});

/**
 * Sync emails from Gmail
 */
export const syncGmailEmails = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { tenantId, accountId, maxResults = 50 } = data;

  if (!tenantId || !accountId) {
    throw new functions.https.HttpsError('invalid-argument', 'Tenant ID and account ID are required');
  }

  try {
    const db = admin.firestore();
    
    // Verify user has access to this tenant
    const memberDoc = await db.doc(`tenants/${tenantId}/members/${context.auth.uid}`).get();
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }

    // Get email account
    const accountDoc = await db.doc(`tenants/${tenantId}/emailAccounts/${accountId}`).get();
    if (!accountDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Email account not found');
    }

    const accountData = accountDoc.data();
    const settings = accountData?.settings;

    if (!settings?.accessToken) {
      throw new functions.https.HttpsError('failed-precondition', 'No access token available');
    }

    // Initialize OAuth2 client and Gmail API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: settings.accessToken,
      refresh_token: settings.refreshToken
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get list of messages
    const messagesList = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: 'in:inbox' // Focus on inbox for now
    });

    const messages = messagesList.data.messages || [];
    const syncedEmails = [];

    // Fetch details for each message
    for (const message of messages.slice(0, Math.min(maxResults, 20))) { // Limit to prevent timeout
      try {
        const messageDetail = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full'
        });

        const headers = messageDetail.data.payload?.headers || [];
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
        const to = headers.find((h: any) => h.name === 'To')?.value || accountData?.email || 'unknown@example.com';
        const date = headers.find((h: any) => h.name === 'Date')?.value;

        // Extract email body
        let body = '';
        const payload = messageDetail.data.payload;
        if (payload?.parts) {
          const textPart = payload.parts.find((part: any) => part.mimeType === 'text/plain');
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        } else if (payload?.body?.data) {
          body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }

        // Check if email already exists
        const existingEmail = await db.collection(`tenants/${tenantId}/emails`)
          .where('messageId', '==', message.id)
          .limit(1)
          .get();

        if (!existingEmail.empty) {
          continue; // Skip if already synced
        }

        // Store email in Firestore
        const emailDoc = {
          messageId: message.id,
          from,
          to,
          subject,
          body,
          folder: 'inbox',
          isRead: messageDetail.data.labelIds?.includes('UNREAD') ? false : true,
          receivedAt: date ? new Date(date) : admin.firestore.FieldValue.serverTimestamp(),
          status: 'received',
          source: 'gmail',
          accountId,
          syncedAt: admin.firestore.FieldValue.serverTimestamp(),
          tenantId
        };

        await db.collection(`tenants/${tenantId}/emails`).add(emailDoc);
        syncedEmails.push(emailDoc);

      } catch (emailError) {
        console.error(`Error processing message ${message.id}:`, emailError);
      }
    }

    // Update last sync time
    await accountDoc.ref.update({
      lastSync: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      syncedCount: syncedEmails.length,
      totalMessages: messages.length,
      message: `Synced ${syncedEmails.length} new emails`
    };

  } catch (error) {
    console.error('Error syncing Gmail emails:', error);
    throw new functions.https.HttpsError('internal', 'Failed to sync emails');
  }
});

/**
 * Set up Gmail push notifications for real-time email sync
 */
export const setupGmailWatch = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { tenantId, accountId } = data;

  if (!tenantId || !accountId) {
    throw new functions.https.HttpsError('invalid-argument', 'Tenant ID and account ID are required');
  }

  try {
    const db = admin.firestore();
    
    // Verify user has access to this tenant
    const memberDoc = await db.doc(`tenants/${tenantId}/members/${context.auth.uid}`).get();
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }

    // Get email account
    const accountDoc = await db.doc(`tenants/${tenantId}/emailAccounts/${accountId}`).get();
    if (!accountDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Email account not found');
    }

    const accountData = accountDoc.data();
    const settings = accountData?.settings;

    if (!settings?.accessToken) {
      throw new functions.https.HttpsError('failed-precondition', 'No access token available');
    }

    // Initialize OAuth2 client and Gmail API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: settings.accessToken,
      refresh_token: settings.refreshToken
    });

    // For now, skip the Gmail watch setup since Pub/Sub topic isn't configured
    // Just mark the account as having watch setup attempted
    console.log(`Skipping Gmail watch setup for account ${accountId} - Pub/Sub topic not configured`);
    
    // Store watch setup attempt in the account
    await accountDoc.ref.update({
      watchSetupAttempted: admin.firestore.FieldValue.serverTimestamp(),
      watchSetupStatus: 'skipped_no_pubsub'
    });

    return {
      success: true,
      message: 'Gmail watch setup skipped - using scheduled sync instead',
      note: 'Real-time sync requires Pub/Sub topic configuration'
    };

    // TODO: Uncomment this when Pub/Sub topic is set up
    /*
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Set up Gmail watch for push notifications
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: `projects/${functions.config().project?.id || 'servicepro-4c705'}/topics/gmail-notifications`,
        labelIds: ['INBOX'], // Watch inbox only
        labelFilterAction: 'include'
      }
    });

    // Store watch details in the account
    await accountDoc.ref.update({
      'settings.watchHistoryId': watchResponse.data.historyId,
      'settings.watchExpiration': watchResponse.data.expiration,
      watchSetupAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      historyId: watchResponse.data.historyId,
      expiration: watchResponse.data.expiration,
      message: 'Gmail watch setup successfully'
    };
    */

  } catch (error: any) {
    console.error('Error setting up Gmail watch:', error);
    throw new functions.https.HttpsError('internal', `Failed to setup Gmail watch: ${error.message || error}`);
  }
});

/**
 * Handle Gmail push notifications webhook
 */
export const handleGmailWebhook = functions.runWith(runtimeOpts).https.onRequest(async (req, res) => {
  // Verify the request is from Google
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Missing or invalid authorization header');
    res.status(401).send('Unauthorized');
    return;
  }

  try {
    // Parse the Pub/Sub message
    const message = req.body.message;
    if (!message || !message.data) {
      console.log('Invalid webhook payload');
      res.status(400).send('Invalid payload');
      return;
    }

    // Decode the message data
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
    console.log('Gmail webhook received:', data);

    const { emailAddress, historyId } = data;

    if (!emailAddress || !historyId) {
      console.log('Missing required fields in webhook data');
      res.status(400).send('Missing required fields');
      return;
    }

    // Find the email account by email address
    const db = admin.firestore();
    const accountsQuery = await db.collectionGroup('emailAccounts')
      .where('email', '==', emailAddress)
      .where('provider', '==', 'gmail')
      .where('isConnected', '==', true)
      .limit(1)
      .get();

    if (accountsQuery.empty) {
      console.log(`No connected Gmail account found for ${emailAddress}`);
      res.status(404).send('Account not found');
      return;
    }

    const accountDoc = accountsQuery.docs[0];
    const accountData = accountDoc.data();
    const tenantId = accountDoc.ref.parent.parent?.id;
    const accountId = accountDoc.id;

    if (!tenantId) {
      console.log('Could not determine tenant ID');
      res.status(500).send('Internal error');
      return;
    }

    // Sync new emails for this account
    await syncNewGmailEmails(tenantId, accountId, accountData, historyId);

    res.status(200).send('OK');

  } catch (error) {
    console.error('Error handling Gmail webhook:', error);
    res.status(500).send('Internal error');
  }
});

/**
 * Sync new Gmail emails based on history ID
 */
async function syncNewGmailEmails(tenantId: string, accountId: string, accountData: any, newHistoryId: string) {
  try {
    const settings = accountData?.settings;
    if (!settings?.accessToken) {
      console.log('No access token available for sync');
      return;
    }

    // Initialize OAuth2 client and Gmail API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: settings.accessToken,
      refresh_token: settings.refreshToken
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const db = admin.firestore();

    // Get history since last known history ID
    const lastHistoryId = settings.watchHistoryId || '1';
    
    try {
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: lastHistoryId,
        historyTypes: ['messageAdded'], // Only new messages
        maxResults: 50
      });

      const history = historyResponse.data.history || [];
      let syncedCount = 0;

      for (const historyItem of history) {
        const messagesAdded = historyItem.messagesAdded || [];
        
        for (const messageAdded of messagesAdded) {
          const message = messageAdded.message;
          if (!message?.id) continue;

          // Check if this is an inbox message
          const labelIds = message.labelIds || [];
          if (!labelIds.includes('INBOX')) continue;

          try {
            // Get full message details
            const messageDetail = await gmail.users.messages.get({
              userId: 'me',
              id: message.id,
              format: 'full'
            });

            const headers = messageDetail.data.payload?.headers || [];
            const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
            const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
            const to = headers.find((h: any) => h.name === 'To')?.value || accountData?.email || 'unknown@example.com';
            const date = headers.find((h: any) => h.name === 'Date')?.value;

            // Extract email body
            let body = '';
            const payload = messageDetail.data.payload;
            if (payload?.parts) {
              const textPart = payload.parts.find((part: any) => part.mimeType === 'text/plain');
              const htmlPart = payload.parts.find((part: any) => part.mimeType === 'text/html');
              
              if (htmlPart?.body?.data) {
                body = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
              } else if (textPart?.body?.data) {
                body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
              }
            } else if (payload?.body?.data) {
              body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
            }

            // Check if email already exists
            const existingEmail = await db.collection(`tenants/${tenantId}/emails`)
              .where('messageId', '==', message.id)
              .limit(1)
              .get();

            if (!existingEmail.empty) {
              continue; // Skip if already synced
            }

            // Store email in Firestore
            const emailDoc = {
              messageId: message.id,
              from,
              to,
              subject,
              body,
              folder: 'inbox',
              isRead: !labelIds.includes('UNREAD'),
              receivedAt: date ? new Date(date) : admin.firestore.FieldValue.serverTimestamp(),
              status: 'received',
              source: 'gmail',
              accountId,
              syncedAt: admin.firestore.FieldValue.serverTimestamp(),
              tenantId
            };

            await db.collection(`tenants/${tenantId}/emails`).add(emailDoc);
            syncedCount++;

            console.log(`Synced new email: ${subject} from ${from}`);

          } catch (emailError) {
            console.error(`Error processing message ${message.id}:`, emailError);
          }
        }
      }

      // Update the account's history ID
      await db.doc(`tenants/${tenantId}/emailAccounts/${accountId}`).update({
        'settings.watchHistoryId': newHistoryId,
        lastSync: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Synced ${syncedCount} new emails for account ${accountId}`);

    } catch (historyError) {
      console.error('Error getting Gmail history:', historyError);
      
      // If history is too old, do a full sync of recent messages
      console.log('Falling back to recent messages sync');
      await fallbackSyncRecentMessages(tenantId, accountId, gmail, db);
    }

  } catch (error) {
    console.error('Error in syncNewGmailEmails:', error);
  }
}

/**
 * Fallback sync for recent messages when history is unavailable
 */
async function fallbackSyncRecentMessages(tenantId: string, accountId: string, gmail: any, db: any) {
  try {
    // Get recent messages from inbox
    const messagesList = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10, // Just recent messages
      q: 'in:inbox'
    });

    const messages = messagesList.data.messages || [];
    let syncedCount = 0;

    for (const message of messages) {
      try {
        // Check if email already exists first
        const existingEmail = await db.collection(`tenants/${tenantId}/emails`)
          .where('messageId', '==', message.id)
          .limit(1)
          .get();

        if (!existingEmail.empty) {
          continue; // Skip if already synced
        }

        const messageDetail = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full'
        });

        const headers = messageDetail.data.payload?.headers || [];
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
        const to = headers.find((h: any) => h.name === 'To')?.value || 'unknown@example.com';
        const date = headers.find((h: any) => h.name === 'Date')?.value;

        // Extract email body
        let body = '';
        const payload = messageDetail.data.payload;
        if (payload?.parts) {
          const textPart = payload.parts.find((part: any) => part.mimeType === 'text/plain');
          const htmlPart = payload.parts.find((part: any) => part.mimeType === 'text/html');
          
          if (htmlPart?.body?.data) {
            body = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
          } else if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        } else if (payload?.body?.data) {
          body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }

        // Store email in Firestore
        const emailDoc = {
          messageId: message.id,
          from,
          to,
          subject,
          body,
          folder: 'inbox',
          isRead: !messageDetail.data.labelIds?.includes('UNREAD'),
          receivedAt: date ? new Date(date) : admin.firestore.FieldValue.serverTimestamp(),
          status: 'received',
          source: 'gmail',
          accountId,
          syncedAt: admin.firestore.FieldValue.serverTimestamp(),
          tenantId
        };

        await db.collection(`tenants/${tenantId}/emails`).add(emailDoc);
        syncedCount++;

      } catch (emailError) {
        console.error(`Error processing message ${message.id}:`, emailError);
      }
    }

    console.log(`Fallback sync completed: ${syncedCount} emails`);

  } catch (error) {
    console.error('Error in fallback sync:', error);
  }
}

/**
 * Scheduled function to sync emails every hour as backup
 */
export const scheduledEmailSync = functions.runWith(runtimeOpts).pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    console.log('Starting scheduled email sync...');
    
    try {
      const db = admin.firestore();
      
      // Get all connected Gmail accounts
      const accountsQuery = await db.collectionGroup('emailAccounts')
        .where('provider', '==', 'gmail')
        .where('isConnected', '==', true)
        .get();

      if (accountsQuery.empty) {
        console.log('No connected Gmail accounts found for scheduled sync');
        return;
      }

      let totalSynced = 0;
      
      for (const accountDoc of accountsQuery.docs) {
        try {
          const accountData = accountDoc.data();
          const tenantId = accountDoc.ref.parent.parent?.id;
          const accountId = accountDoc.id;
          
          if (!tenantId) continue;

          const settings = accountData?.settings;
          if (!settings?.accessToken) continue;

          // Initialize OAuth2 client and Gmail API
          const oauth2Client = new google.auth.OAuth2();
          oauth2Client.setCredentials({
            access_token: settings.accessToken,
            refresh_token: settings.refreshToken
          });

          const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

          // Sync recent messages (last 24 hours)
          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1);
          
          const messagesList = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 20,
            q: `in:inbox after:${oneDayAgo.getFullYear()}/${oneDayAgo.getMonth() + 1}/${oneDayAgo.getDate()}`
          });

          const messages = messagesList.data.messages || [];
          let accountSyncedCount = 0;

          for (const message of messages) {
            try {
              // Check if email already exists
              const existingEmail = await db.collection(`tenants/${tenantId}/emails`)
                .where('messageId', '==', message.id)
                .limit(1)
                .get();

              if (!existingEmail.empty) {
                continue; // Skip if already synced
              }

              const messageDetail = await gmail.users.messages.get({
                userId: 'me',
                id: message.id!,
                format: 'full'
              });

              const headers = messageDetail.data.payload?.headers || [];
              const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
              const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
              const to = headers.find((h: any) => h.name === 'To')?.value || accountData?.email || 'unknown@example.com';
              const date = headers.find((h: any) => h.name === 'Date')?.value;

              // Extract email body
              let body = '';
              const payload = messageDetail.data.payload;
              if (payload?.parts) {
                const textPart = payload.parts.find((part: any) => part.mimeType === 'text/plain');
                const htmlPart = payload.parts.find((part: any) => part.mimeType === 'text/html');
                
                if (htmlPart?.body?.data) {
                  body = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
                } else if (textPart?.body?.data) {
                  body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                }
              } else if (payload?.body?.data) {
                body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
              }

              // Store email in Firestore
              const emailDoc = {
                messageId: message.id,
                from,
                to,
                subject,
                body,
                folder: 'inbox',
                isRead: !messageDetail.data.labelIds?.includes('UNREAD'),
                receivedAt: date ? new Date(date) : admin.firestore.FieldValue.serverTimestamp(),
                status: 'received',
                source: 'gmail',
                accountId,
                syncedAt: admin.firestore.FieldValue.serverTimestamp(),
                tenantId,
                syncType: 'scheduled' // Mark as scheduled sync
              };

              await db.collection(`tenants/${tenantId}/emails`).add(emailDoc);
              accountSyncedCount++;
              totalSynced++;

            } catch (emailError) {
              console.error(`Error processing message ${message.id}:`, emailError);
            }
          }

          // Update last sync time
          await accountDoc.ref.update({
            lastScheduledSync: admin.firestore.FieldValue.serverTimestamp()
          });

          if (accountSyncedCount > 0) {
            console.log(`Scheduled sync: ${accountSyncedCount} emails for account ${accountId}`);
          }

        } catch (accountError) {
          console.error(`Error syncing account ${accountDoc.id}:`, accountError);
        }
      }

      console.log(`Scheduled email sync completed: ${totalSynced} total emails synced`);

    } catch (error) {
      console.error('Error in scheduled email sync:', error);
    }
  }); 