# Dialpad Inbox Implementation - OAuth 2.0 Integration

## Overview

This implementation provides comprehensive call and SMS functionality for the inbox tab, following Dialpad's official OAuth 2.0 flow for multi-tenant applications. The system supports tenant-specific authentication, real-time communication tracking, and seamless integration with existing customer management.

## Architecture

### OAuth 2.0 Flow Implementation

Following Dialpad's official documentation, this implementation uses the "three-legged" OAuth authorization code flow (RFC 6749 section 4.1) for secure, tenant-specific authentication.

#### Components

1. **DialpadAPIService.ts** - Core OAuth service with tenant-specific token management
2. **DialpadOAuthManager.tsx** - Authentication UI component
3. **DialpadOAuthCallback.tsx** - OAuth callback handler
4. **InboxCallsInterface.tsx** - Call tracking interface
5. **InboxSMSInterface.tsx** - SMS messaging interface

### Key Features

- **Tenant-Specific Authentication**: Each tenant has their own OAuth tokens
- **Automatic Token Refresh**: Handles token expiration seamlessly
- **Demo Data Fallback**: Works without authentication for development
- **Real-time Updates**: Live call and SMS tracking
- **Comprehensive Filtering**: Advanced search and filter capabilities

## Environment Configuration

### Required Environment Variables

```env
# Dialpad OAuth Configuration
VITE_DIALPAD_CLIENT_ID=your_client_id_here
VITE_DIALPAD_CLIENT_SECRET=your_client_secret_here
VITE_DIALPAD_REDIRECT_URI=https://pro.nexus.io/oauth/dialpad/callback
VITE_DIALPAD_ENVIRONMENT=production  # or 'sandbox' for testing

# Optional: Override default scopes (leave empty for default basic access)
# VITE_DIALPAD_SCOPES=calls:list
```

### OAuth Application Registration

Before using this implementation, you must register your OAuth application with Dialpad:

1. Submit the [Dialpad OAuth Application Form](https://dialpad.com/oauth-application-form)
2. Provide your redirect URI(s)
3. Request necessary scopes:
   - `calls:list` - Access call logs
   - `message_content_export` - Export SMS content for authenticated user
   - `recordings_export` - Access call recordings
   - `offline_access` - Refresh token support

## OAuth Flow Implementation

### Step 1: Authorization Request

```typescript
// Generate authorization URL
const authUrl = dialpadService.generateAuthUrl(tenantId, state);
window.location.href = authUrl;
```

The service constructs the authorization URL with:
- `response_type=code`
- `client_id` from environment
- `redirect_uri` configured in environment
- `state` parameter for CSRF protection
- `scope` for requested permissions

### Step 2: Authorization Response

Dialpad redirects to your callback URL with:
- `code` - Temporary authorization code (valid 1 minute)
- `state` - CSRF token for validation

### Step 3: Token Exchange

```typescript
// Exchange code for tokens
const result = await dialpadService.handleOAuthCallback(tenantId, code, state);
```

The service exchanges the authorization code for:
- `access_token` - API access token
- `refresh_token` - Token refresh capability
- `expires_in` - Token expiration time

## API Integration

### Call Logs

```typescript
// Get call logs with filtering
const calls = await dialpadService.getCallLogs(tenantId, {
  userId: currentUserId,
  direction: 'inbound',
  status: 'missed',
  startDate: '2024-01-01',
  limit: 50
});
```

### SMS Messages

```typescript
// Get SMS threads
const threads = await dialpadService.getSMSThreads(tenantId, currentUserId);

// Send SMS
const result = await dialpadService.sendSMS(
  tenantId,
  '+1234567890',
  'Hello from our service team!'
);
```

### Authentication Management

```typescript
// Check authentication status
const isAuthenticated = dialpadService.isAuthenticated(tenantId);

// Refresh tokens
const refreshed = await dialpadService.refreshAccessToken(tenantId);

// Revoke tokens (logout)
await dialpadService.revokeTokens(tenantId);
```

## UI Components

### DialpadOAuthManager

Provides authentication interface with:
- Login/logout buttons
- Connection status display
- User information
- Settings panel

```tsx
<DialpadOAuthManager
  onAuthenticationChange={(authenticated, user) => {
    console.log('Auth status:', authenticated, user);
  }}
  className="mb-4"
/>
```

### InboxCallsInterface

Call management with:
- Real-time call logs
- Advanced filtering (direction, status, department, date)
- Voicemail playback
- Call recording access
- Customer lookup integration

### InboxSMSInterface

SMS management with:
- Message threading by phone number
- Real-time messaging
- Message status tracking
- Send functionality
- Customer integration

## Security Features

### CSRF Protection

- State parameter validation
- Tenant-specific state generation
- Automatic state verification

### Token Security

- Secure token storage per tenant
- Automatic token refresh
- Proper token revocation
- Environment-based configuration

### Error Handling

- Graceful authentication failures
- Automatic fallback to demo data
- Comprehensive error logging
- User-friendly error messages

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env.local` with your Dialpad OAuth credentials:

```env
VITE_DIALPAD_CLIENT_ID=your_client_id
VITE_DIALPAD_CLIENT_SECRET=your_client_secret
VITE_DIALPAD_REDIRECT_URI=https://pro.nexus.io/oauth/dialpad/callback
VITE_DIALPAD_ENVIRONMENT=production
```

### 3. Add OAuth Route

Add the callback route to your router:

```tsx
import DialpadOAuthCallback from './components/DialpadOAuthCallback';

// In your router configuration
<Route path="/oauth/dialpad/callback" element={<DialpadOAuthCallback />} />
```

### 4. Integrate Components

```tsx
import DialpadOAuthManager from './components/DialpadOAuthManager';
import InboxCallsInterface from './components/InboxCallsInterface';
import InboxSMSInterface from './components/InboxSMSInterface';

// In your inbox component
<DialpadOAuthManager onAuthenticationChange={handleAuthChange} />
<InboxCallsInterface viewMode="my-inbox" currentUserId={userId} />
<InboxSMSInterface viewMode="my-inbox" currentUserId={userId} />
```

## Production Deployment

### 1. Environment Configuration

Update production environment variables:

```env
VITE_DIALPAD_ENVIRONMENT=production
VITE_DIALPAD_REDIRECT_URI=https://pro.nexus.io/oauth/dialpad/callback
```

### 2. SSL/HTTPS Requirements

- Dialpad requires HTTPS for production OAuth flows
- Ensure your redirect URI uses HTTPS
- Configure proper SSL certificates

### 3. Domain Verification

- Register your production domain with Dialpad
- Update OAuth application settings
- Test the complete flow in production

## Monitoring and Analytics

### Authentication Metrics

- Track successful/failed authentications
- Monitor token refresh rates
- Log OAuth errors

### API Usage

- Monitor API call volumes
- Track rate limiting
- Measure response times

### User Experience

- Track authentication completion rates
- Monitor error frequencies
- Measure feature adoption

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI"**
   - Verify redirect URI matches registered value exactly
   - Check for trailing slashes or protocol mismatches

2. **"Invalid client credentials"**
   - Verify client ID and secret are correct
   - Check environment variable names

3. **"Token expired"**
   - Automatic refresh should handle this
   - Check refresh token availability

4. **"Insufficient scope"**
   - Verify requested scopes are approved
   - Check scope configuration

### Debug Mode

Enable debug information in development:

```tsx
{import.meta.env.DEV && (
  <div className="debug-info">
    <p>Tenant: {tenantId}</p>
    <p>Authenticated: {isAuthenticated.toString()}</p>
    <p>Environment: {import.meta.env.VITE_DIALPAD_ENVIRONMENT}</p>
  </div>
)}
```

### Logging

The implementation includes comprehensive logging:

```typescript
// Enable debug logging
console.log('OAuth callback result:', result);
console.log('API request:', { tenantId, endpoint, params });
console.log('Token refresh:', { success, tenantId });
```

## API Reference

### DialpadAPIService Methods

#### Authentication
- `generateAuthUrl(tenantId, state?)` - Generate OAuth URL
- `handleOAuthCallback(tenantId, code, state)` - Handle callback
- `isAuthenticated(tenantId)` - Check auth status
- `refreshAccessToken(tenantId)` - Refresh tokens
- `revokeTokens(tenantId)` - Logout/revoke

#### Calls
- `getCallLogs(tenantId, options)` - Get call history
- `getCurrentUser(tenantId)` - Get user info

#### SMS
- `getSMSMessages(tenantId, options)` - Get messages
- `getSMSThreads(tenantId, userId?)` - Get threaded messages
- `sendSMS(tenantId, to, message, from?)` - Send SMS

#### Demo Data
- `getDemoCallLogs(viewMode, userId?)` - Demo call data
- `getDemoSMSThreads(viewMode, userId?)` - Demo SMS data

## Best Practices

### Security
- Never expose client secrets in frontend code
- Use environment variables for all configuration
- Implement proper CSRF protection
- Validate all OAuth responses

### Performance
- Cache user data appropriately
- Implement pagination for large datasets
- Use demo data for development
- Optimize API call frequency

### User Experience
- Provide clear authentication status
- Handle errors gracefully
- Show loading states
- Implement offline fallbacks

### Maintenance
- Monitor token expiration patterns
- Update scopes as needed
- Keep OAuth application details current
- Regular security audits

## Support and Resources

- [Dialpad API Documentation](https://developers.dialpad.com/)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [Dialpad OAuth Guide](https://developers.dialpad.com/docs/oauth)
- [API Support](mailto:api@dialpad.com)

## License

This implementation follows your project's existing license terms. 