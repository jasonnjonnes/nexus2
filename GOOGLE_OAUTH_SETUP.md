# Google OAuth Setup for Gmail Integration

## Prerequisites

Before implementing Gmail OAuth integration, you need to set up Google Cloud Console and Firebase configuration.

## Step 1: Enable APIs in Google Cloud Console

1. **Open the Google Cloud Console**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Select your Firebase project (`servicepro-4c705`)

2. **Enable Required APIs**
   - Go to **APIs & Services** → **Library**
   - Search for and enable the following APIs:
     - **Gmail API** (for reading/sending emails)
     - **Google+ API** (for user profile information)
     - **People API** (for user information)

## Step 2: Create OAuth 2.0 Credentials

1. **Go to Credentials Page**
   - Navigate to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**

2. **Configure OAuth Consent Screen** (if not already done)
   - Click **Configure Consent Screen**
   - Choose **External** user type
   - Fill in the required information:
     - App name: `ServicePro Email Integration`
     - User support email: Your email
     - Developer contact email: Your email
   - Add scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.modify`

3. **Create OAuth Client ID**
   - Application type: **Web application**
   - Name: `ServicePro Gmail Integration`
   - Authorized JavaScript origins:
     - `http://localhost:5173` (for development)
     - `http://localhost:3000` (for development)
     - `https://your-domain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:5173/oauth/gmail/callback`
     - `http://localhost:3000/oauth/gmail/callback`
     - `https://your-domain.com/oauth/gmail/callback`
     - `https://us-central1-servicepro-4c705.cloudfunctions.net/handleGmailOAuth`

4. **Download Credentials**
   - Download the JSON file containing your client ID and secret
   - Save it securely (don't commit to version control)

## Step 3: Configure Firebase Functions

Set the OAuth credentials in Firebase Functions config:

```bash
# Set Gmail OAuth credentials
firebase functions:config:set oauth.gmail.client_id="your-client-id"
firebase functions:config:set oauth.gmail.client_secret="your-client-secret"
firebase functions:config:set oauth.gmail.redirect_uri="https://us-central1-servicepro-4c705.cloudfunctions.net/handleGmailOAuth"

# Set your app URL
firebase functions:config:set app.url="http://localhost:3000"  # or your production URL
```

## Step 4: Required Scopes

For Gmail integration, you'll need these scopes:
- `https://www.googleapis.com/auth/gmail.readonly` - Read emails
- `https://www.googleapis.com/auth/gmail.send` - Send emails
- `https://www.googleapis.com/auth/gmail.modify` - Modify emails (mark as read, etc.)
- `https://www.googleapis.com/auth/userinfo.email` - Get user email
- `https://www.googleapis.com/auth/userinfo.profile` - Get user profile

## Step 5: OAuth Flow Implementation

The OAuth flow will work as follows:

1. **User clicks "Add Gmail Account"**
2. **Redirect to Google OAuth** with proper scopes
3. **User grants permission** on Google's consent screen
4. **Google redirects back** to your callback URL with authorization code
5. **Exchange code for tokens** (access token + refresh token)
6. **Store tokens securely** in Firestore
7. **Use tokens** to make Gmail API calls

## Step 6: Security Considerations

- Always use HTTPS in production
- Store tokens securely in Firestore with proper security rules
- Implement token refresh logic
- Use state parameter to prevent CSRF attacks
- Validate redirect URIs

## Step 7: Testing

1. Test OAuth flow in development environment
2. Verify token storage and retrieval
3. Test Gmail API calls with stored tokens
4. Test token refresh functionality

## Known Issues and Warnings

### Google OAuth Accessibility Warnings

**⚠️ You may see accessibility warnings in the browser console during OAuth flow:**

```
Blocked aria-hidden on an element because its descendant retained focus...
```

**This is NOT an issue with your application!** These warnings come from Google's OAuth consent screen interface and are Google's responsibility to fix. These warnings:

- ✅ **Do not affect functionality** - OAuth works perfectly
- ✅ **Are purely cosmetic** - accessibility warnings only
- ✅ **Cannot be fixed by us** - they're in Google's UI code
- ✅ **Are common** - appear in most applications using Google OAuth

**What we've done:**
- Added informational console messages to clarify the source
- Implemented robust error handling for our OAuth flow
- Used best practices for accessibility in our own code

**Recommendation:** You can safely ignore these warnings as they don't impact your application's functionality or user experience.

## Next Steps

After completing the Google Cloud Console setup:
1. Update Firebase Functions with OAuth handling
2. Implement OAuth callback handlers
3. Update frontend to handle OAuth flow
4. Test end-to-end integration

## Troubleshooting

Common issues and solutions:
- **redirect_uri_mismatch**: Ensure redirect URIs match exactly in Google Cloud Console
- **invalid_client**: Check client ID and secret configuration
- **access_denied**: User denied permission - handle gracefully
- **invalid_grant**: Token expired - implement refresh logic
- **Accessibility warnings**: These are from Google's OAuth screen, not your app - safe to ignore 