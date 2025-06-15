# Dialpad Environment Setup Guide

## Overview

This guide walks you through setting up the environment variables and OAuth configuration required for the Dialpad integration.

## Prerequisites

1. **Dialpad Account**: You need a Dialpad account with API access
2. **OAuth Application**: Register your application with Dialpad
3. **SSL Certificate**: Required for production OAuth flows

## Step 1: Register OAuth Application

### Submit Application Form

1. Go to [Dialpad OAuth Application Form](https://dialpad.com/oauth-application-form)
2. Fill out the required information:
   - **Application Name**: Your application name
   - **Description**: Brief description of your integration
   - **Redirect URIs**: Your callback URLs (see below)
   - **Scopes**: Required permissions (see below)

### Redirect URIs

Provide both development and production URLs:

```
Development: http://localhost:3000/oauth/dialpad/callback
Production: https://yourdomain.com/oauth/dialpad/callback
```

**Important Notes:**
- URLs must match exactly (including trailing slashes)
- Production URLs must use HTTPS
- You can register multiple redirect URIs

### Required Scopes

Request the following scopes for full functionality:

- `calls:list` - Access to call logs and history
- `message_content_export` - Export SMS content for authenticated user
- `recordings_export` - Access to call recordings and voicemails
- `offline_access` - Refresh token support for long-term access

### Optional Scopes

Additional scopes you may need:

- `message_content_export:all` - Company-wide SMS content (admin only)
- `screen_pop` - Screen pop API for incoming calls
- `fax_message` - Fax API and events
- `change_log` - Change log event subscriptions

## Step 2: Receive OAuth Credentials

After approval, you'll receive:
- **Client ID**: Public identifier for your application
- **Client Secret**: Private key (keep secure!)

## Step 3: Environment Configuration

### Development Environment

Create a `.env.local` file in your project root:

```env
# Dialpad OAuth Configuration
VITE_DIALPAD_CLIENT_ID=your_client_id_here
VITE_DIALPAD_CLIENT_SECRET=your_client_secret_here
VITE_DIALPAD_REDIRECT_URI=https://pro.nexus.io/oauth/dialpad/callback
VITE_DIALPAD_ENVIRONMENT=beta

# Optional: Custom scopes (leave empty for default basic access)
# VITE_DIALPAD_SCOPES=calls:list


```

### Production Environment

Update your production environment variables:

```env
# Dialpad OAuth Configuration
VITE_DIALPAD_CLIENT_ID=your_production_client_id
VITE_DIALPAD_CLIENT_SECRET=your_production_client_secret
VITE_DIALPAD_REDIRECT_URI=https://pro.nexus.io/oauth/dialpad/callback
VITE_DIALPAD_ENVIRONMENT=production

# Beta/Production scopes (leave empty for default basic access)
# VITE_DIALPAD_SCOPES=calls:list
```

## Step 4: Security Configuration

### Environment Variable Security

**Never commit secrets to version control:**

```gitignore
# Add to .gitignore
.env.local
.env.production
.env.*.local
```

**Use secure environment variable management:**
- Development: `.env.local` files
- Production: Platform-specific environment variables (Vercel, Netlify, etc.)
- CI/CD: Encrypted secrets

### HTTPS Requirements

**Production Requirements:**
- All redirect URIs must use HTTPS
- SSL certificate must be valid
- No self-signed certificates

**Development:**
- HTTP is allowed for localhost
- Use `http://localhost:3000` not `http://127.0.0.1:3000`

## Step 5: Testing Configuration

### Verify Environment Variables

Add this debug component to test your configuration:

```tsx
// components/DialpadConfigTest.tsx
import React from 'react';

const DialpadConfigTest: React.FC = () => {
  const config = {
    clientId: import.meta.env.VITE_DIALPAD_CLIENT_ID,
    redirectUri: import.meta.env.VITE_DIALPAD_REDIRECT_URI,
    environment: import.meta.env.VITE_DIALPAD_ENVIRONMENT,
    scopes: import.meta.env.VITE_DIALPAD_SCOPES,
  };

  return (
    <div className="p-4 bg-gray-100 rounded">
      <h3>Dialpad Configuration</h3>
      <pre>{JSON.stringify(config, null, 2)}</pre>
    </div>
  );
};

export default DialpadConfigTest;
```

### Test OAuth Flow

1. **Start Development Server**:
   ```bash
   npm run dev
   ```

2. **Navigate to Inbox**: Go to `/inbound`

3. **Click "Connect to Dialpad"**: Should redirect to Dialpad OAuth

4. **Complete Authorization**: Login and grant permissions

5. **Verify Callback**: Should redirect back to your app

## Step 6: Environment-Specific Configuration

### Sandbox vs Production

**Sandbox Environment:**
- Use for development and testing
- Separate from production data
- May have limited features
- Use `VITE_DIALPAD_ENVIRONMENT=sandbox`

**Production Environment:**
- Live Dialpad data
- Full feature access
- Rate limiting applies
- Use `VITE_DIALPAD_ENVIRONMENT=production`

### Multi-Tenant Configuration

For multi-tenant applications:

```env
# Base configuration
VITE_DIALPAD_CLIENT_ID=your_client_id
VITE_DIALPAD_CLIENT_SECRET=your_client_secret

# Tenant-specific redirect URIs (if needed)
VITE_DIALPAD_REDIRECT_URI_TEMPLATE=https://{tenant}.yourdomain.com/oauth/dialpad/callback
```

## Step 7: Monitoring and Logging

### Enable Debug Logging

```env

```

This enables:
- OAuth flow logging
- API request/response logging
- Token refresh logging
- Error details

### Production Monitoring

Monitor these metrics:
- OAuth success/failure rates
- Token refresh frequency
- API response times
- Error rates by endpoint

## Troubleshooting

### Common Configuration Issues

1. **"Invalid redirect URI"**
   ```
   Solution: Ensure redirect URI matches registered value exactly
   Check: Protocol (http/https), domain, path, trailing slashes
   ```

2. **"Invalid client credentials"**
   ```
   Solution: Verify client ID and secret are correct
   Check: Environment variable names, no extra spaces
   ```

3. **"Unauthorized"**
   ```
   Solution: Check requested scopes are approved
   Check: Scope names are correct and comma-separated
   ```

4. **CORS Errors**
   ```
   Solution: Ensure proper redirect URI configuration
   Check: Domain matches, HTTPS in production
   ```

### Debug Checklist

- [ ] Client ID is set and correct
- [ ] Client Secret is set and secure
- [ ] Redirect URI matches registered value
- [ ] Environment is set (sandbox/production)
- [ ] Scopes are properly formatted
- [ ] HTTPS is used in production
- [ ] No trailing spaces in environment variables

## Security Best Practices

### Client Secret Protection

**Never expose client secrets:**
- Don't commit to version control
- Don't log in production
- Use secure environment variable storage
- Rotate secrets regularly

### Token Security

**Secure token storage:**
- Use secure storage mechanisms
- Implement proper token refresh
- Handle token expiration gracefully
- Clear tokens on logout

### Network Security

**HTTPS Requirements:**
- All production traffic over HTTPS
- Valid SSL certificates
- Secure redirect URIs
- No mixed content warnings

## Support Resources

### Documentation
- [Dialpad API Docs](https://developers.dialpad.com/)
- [OAuth 2.0 Specification](https://tools.ietf.org/html/rfc6749)
- [Dialpad OAuth Guide](https://developers.dialpad.com/docs/oauth)

### Support Channels
- [Dialpad Developer Support](mailto:api@dialpad.com)
- [API Status Page](https://status.dialpad.com/)
- [Developer Community](https://community.dialpad.com/)

### Testing Tools
- [OAuth Debugger](https://oauthdebugger.com/)
- [JWT Decoder](https://jwt.io/)
- [Postman Collections](https://www.postman.com/dialpad-api)

## Deployment Checklist

### Pre-Deployment
- [ ] OAuth application approved
- [ ] Production credentials configured
- [ ] HTTPS certificate installed
- [ ] Environment variables set
- [ ] OAuth flow tested

### Post-Deployment
- [ ] OAuth flow works in production
- [ ] API calls successful
- [ ] Token refresh working
- [ ] Error handling tested
- [ ] Monitoring configured

This setup guide ensures proper configuration of the Dialpad OAuth integration for both development and production environments. 