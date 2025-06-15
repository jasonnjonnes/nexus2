# Production Deployment Guide

## Environment Variables Setup

### Current Configuration (Beta Environment)
The application is currently configured to use Dialpad's **Beta environment** for testing and development.

### CLI Environment Variables (Already Set)
The following environment variables have been added to your `~/.zshrc` profile:

```bash
# Dialpad OAuth Environment Variables
export VITE_DIALPAD_CLIENT_ID="WnvSVq59wzv3eybNzWdFLKDY2"
export VITE_DIALPAD_CLIENT_SECRET="wttBnWmqYHrEvDKDEtPzDV93tAzmfTqsM4tnA65wmVAbtX7Qw5"
export VITE_DIALPAD_ENVIRONMENT="beta"
export VITE_DIALPAD_REDIRECT_URI="https://pro.nexus.io/oauth/dialpad/callback"
```

### Production Deployment Steps

#### 1. For Production Dialpad Environment
When you get production credentials from Dialpad, update the environment variables:

```bash
# Update these in ~/.zshrc for production
export VITE_DIALPAD_CLIENT_ID="your_production_client_id"
export VITE_DIALPAD_CLIENT_SECRET="your_production_client_secret"
export VITE_DIALPAD_ENVIRONMENT="production"
export VITE_DIALPAD_REDIRECT_URI="https://pro.nexus.io/oauth/dialpad/callback"
```

#### 2. Firebase Hosting Deployment
For Firebase hosting, set the environment variables in your build process:

```bash
# Build with environment variables
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

#### 3. Vercel/Netlify Deployment
Add these environment variables in your deployment platform's dashboard:

- `VITE_DIALPAD_CLIENT_ID`
- `VITE_DIALPAD_CLIENT_SECRET`
- `VITE_DIALPAD_ENVIRONMENT`
- `VITE_DIALPAD_REDIRECT_URI`

#### 4. Docker Deployment
If using Docker, add to your `.env` file or docker-compose:

```yaml
environment:
  - VITE_DIALPAD_CLIENT_ID=your_client_id
  - VITE_DIALPAD_CLIENT_SECRET=your_client_secret
  - VITE_DIALPAD_ENVIRONMENT=production
  - VITE_DIALPAD_REDIRECT_URI=https://pro.nexus.io/oauth/dialpad/callback
```

### Security Notes

1. **Never commit credentials to Git** - The `.env` file is gitignored
2. **Use environment-specific credentials** - Beta for testing, Production for live
3. **Secure your redirect URI** - Ensure HTTPS in production
4. **Rotate credentials regularly** - Follow Dialpad's security best practices

### Dialpad OAuth Application Setup

#### For Production Environment:
1. Submit a new OAuth application request to Dialpad for production
2. Specify the redirect URI: `https://pro.nexus.io/oauth/dialpad/callback`
3. Request the following scopes (if needed):
   - Basic access (no scopes required initially)
   - Additional scopes can be requested later as needed

#### Current Beta Setup:
- ✅ Client ID: `WnvSVq59wzv3eybNzWdFLKDY2`
- ✅ Environment: `beta` (dialpadbeta.com)
- ✅ Redirect URI: `https://pro.nexus.io/oauth/dialpad/callback`
- ✅ Scopes: None (basic access)

### Testing the Deployment

1. **Local Testing**: Use the current beta credentials
2. **Staging**: Use beta environment with staging domain
3. **Production**: Use production credentials with production domain

### Troubleshooting

#### Common Issues:
- **CORS Errors**: Ensure environment matches credentials (beta/production)
- **Invalid Redirect URI**: Verify the exact URL in Dialpad application settings
- **Invalid Scopes**: Start with no scopes, add as approved by Dialpad
- **Token Refresh Issues**: Ensure `offline_access` scope if using refresh tokens

#### Debug Mode:
Add this to your environment for debugging:
```bash
export VITE_DIALPAD_DEBUG="true"
```

### Current Status
- ✅ Code pushed to GitHub
- ✅ Environment variables set in CLI
- ✅ Beta environment working
- 🔄 Ready for production credentials when available 