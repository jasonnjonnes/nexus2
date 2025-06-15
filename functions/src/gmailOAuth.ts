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
    const { code, state, error } = req.query;

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

    // Verify state parameter (account ID from our database)
    const accountId = state as string;
    
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

    // Find the email account document in Firestore
    const db = admin.firestore();
    const accountsQuery = await db.collectionGroup('emailAccounts')
      .where('id', '==', accountId)
      .limit(1)
      .get();

    if (accountsQuery.empty) {
      res.status(404).json({ error: 'Email account not found' });
      return;
    }

    const accountDoc = accountsQuery.docs[0];
    const accountRef = accountDoc.ref;

    // Update account with OAuth tokens and user info
    await accountRef.update({
      isConnected: true,
      email: userInfo.data.email,
      displayName: userInfo.data.name || `Gmail - ${userInfo.data.email}`,
      lastSync: admin.firestore.FieldValue.serverTimestamp(),
      settings: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        tokenType: tokens.token_type,
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
    const appUrl = origin || functions.config().app?.url || 'http://localhost:5173';
    const successUrl = `${appUrl}/inbound?oauth_success=true&provider=gmail`;
    
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
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
                 const to = headers.find(h => h.name === 'To')?.value || accountData?.email || 'unknown@example.com';
        const date = headers.find(h => h.name === 'Date')?.value;

        // Extract email body
        let body = '';
        const payload = messageDetail.data.payload;
        if (payload?.parts) {
          const textPart = payload.parts.find(part => part.mimeType === 'text/plain');
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