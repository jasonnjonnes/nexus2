# Custom Subdomain Setup: api.nexusinc.io

This guide walks you through setting up a custom subdomain `api.nexusinc.io` for your Firebase Functions REST API.

## Prerequisites

- Firebase project with Functions enabled
- Domain `nexusinc.io` that you own
- Access to your domain's DNS settings

## Method 1: Firebase Hosting with Custom Domain (Recommended)

### Step 1: Deploy Firebase Hosting

First, deploy your Firebase Hosting configuration:

```bash
# Build the project
npm run build

# Deploy hosting and functions together
firebase deploy
```

### Step 2: Add Custom Domain in Firebase Console

1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Enter `api.nexusinc.io`
4. Firebase will provide verification steps

### Step 3: DNS Configuration

Add these DNS records to your domain provider (GoDaddy, Cloudflare, etc.):

```
Type: CNAME
Name: api
Value: api.nexusinc.io.web.app
TTL: Auto or 3600
```

**Alternative A Records (if CNAME not available):**
```
Type: A
Name: api
Value: 151.101.1.195
TTL: Auto or 3600

Type: A
Name: api
Value: 151.101.65.195
TTL: Auto or 3600
```

### Step 4: SSL Certificate

Firebase automatically provisions SSL certificates for custom domains. This may take up to 24 hours.

### Step 5: Verify Setup

After DNS propagation (usually 1-24 hours):

```bash
# Test the API
curl https://api.nexusinc.io/health

# Should return: {"status":"OK","timestamp":"..."}
```

## Method 2: Direct Domain Mapping (Alternative)

### Option A: Using Cloudflare Workers

1. **Set up Cloudflare Workers:**

```javascript
// worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Route API requests to Firebase Functions
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
    const firebaseUrl = `https://nam5-servicepro-4c705.cloudfunctions.net${url.pathname}${url.search}`
    
    const modifiedRequest = new Request(firebaseUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    })
    
    const response = await fetch(modifiedRequest)
    
    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }
    
    const newResponse = new Response(response.body, response)
    Object.keys(corsHeaders).forEach(key => {
      newResponse.headers.set(key, corsHeaders[key])
    })
    
    return newResponse
  }
  
  return new Response('Not Found', { status: 404 })
}
```

2. **Deploy and configure DNS:**
```
Type: CNAME
Name: api
Value: your-worker.workers.dev
```

### Option B: Using Vercel/Netlify Proxy

Create a simple proxy service:

```javascript
// api/proxy.js (Vercel) or _redirects (Netlify)
export default async function handler(req, res) {
  const { method, url, headers, body } = req
  
  const firebaseUrl = `https://nam5-servicepro-4c705.cloudfunctions.net${url}`
  
  const response = await fetch(firebaseUrl, {
    method,
    headers: {
      ...headers,
      host: 'nam5-servicepro-4c705.cloudfunctions.net'
    },
    body: method !== 'GET' ? JSON.stringify(body) : undefined
  })
  
  const data = await response.json()
  res.status(response.status).json(data)
}
```

## Testing Your Setup

### 1. Health Check
```bash
curl https://api.nexusinc.io/health
```

### 2. Test Authentication
```bash
# Get Firebase ID token first, then:
curl -H "Authorization: Bearer YOUR_ID_TOKEN" \
     https://api.nexusinc.io/api/customers
```

### 3. Test from Frontend
```javascript
// Should automatically use the custom domain
import { apiService } from './services/ApiService';

const result = await apiService.healthCheck();
console.log('API Status:', result);
```

## Environment Variables

For different environments, update your API service:

```typescript
// src/services/ApiService.ts
const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5001/servicepro-4c705/nam5/api';
  }
  
  if (process.env.NODE_ENV === 'staging') {
    return 'https://api-staging.nexusinc.io';
  }
  
  return 'https://api.nexusinc.io';
};

const API_BASE_URL = getApiBaseUrl();
```

## Security Considerations

### 1. Update CORS Configuration

In your Firebase Functions:

```typescript
// functions/src/index.ts
app.use(cors({ 
  origin: [
    'https://nexusinc.io',
    'https://www.nexusinc.io',
    'https://app.nexusinc.io',
    'http://localhost:5173' // for development
  ]
}));
```

### 2. Rate Limiting

Add rate limiting to your API:

```bash
npm install express-rate-limit
```

```typescript
// functions/src/index.ts
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api', limiter);
```

### 3. API Key Authentication (Optional)

For additional security, add API key validation:

```typescript
const validateApiKey = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-api-key'];
  const validKeys = ['your-api-key-1', 'your-api-key-2'];
  
  if (!validKeys.includes(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// Apply to specific routes
app.use('/api/external', validateApiKey);
```

## Monitoring and Analytics

### 1. Custom Domain Analytics

Monitor your API usage:

```typescript
// Add to Firebase Functions
import { logger } from 'firebase-functions';

app.use((req: any, res: any, next: any) => {
  logger.info('API Request', {
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});
```

### 2. Set up Uptime Monitoring

Use services like UptimeRobot or Pingdom to monitor:
- `https://api.nexusinc.io/health`

## Troubleshooting

### Common Issues

1. **DNS Propagation Delay**
   - Check with: `nslookup api.nexusinc.io`
   - Use different DNS servers to test

2. **SSL Certificate Pending**
   - Wait up to 24 hours for Firebase SSL provisioning
   - Ensure DNS is correctly configured

3. **CORS Errors**
   - Verify origin URLs in CORS configuration
   - Check browser network tab for actual error

4. **404 Errors**
   - Ensure Firebase Hosting rewrites are configured
   - Verify function name matches in firebase.json

### Debug Commands

```bash
# Check DNS resolution
nslookup api.nexusinc.io

# Test SSL certificate
openssl s_client -connect api.nexusinc.io:443

# Test HTTP response
curl -I https://api.nexusinc.io/health

# Check Firebase Hosting status
firebase hosting:channel:list
```

## Production Checklist

- [ ] Custom domain configured in Firebase Console
- [ ] DNS records properly set
- [ ] SSL certificate active (green lock in browser)
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Monitoring and logging set up
- [ ] API documentation updated with new URLs
- [ ] Client applications updated to use new domain
- [ ] Old URLs redirected (if applicable)

## Benefits of Custom Subdomain

1. **Professional Appearance**: `api.nexusinc.io` vs long Firebase URLs
2. **Easier to Remember**: Simple, branded URL
3. **Better Analytics**: Track API usage separately
4. **Flexible Routing**: Can route different paths to different services
5. **SSL Certificate**: Custom SSL with your domain
6. **Future-Proof**: Can migrate backend without changing client URLs

After setup, your API will be available at:
- `https://api.nexusinc.io/health`
- `https://api.nexusinc.io/api/customers`
- `https://api.nexusinc.io/api/jobs`
- etc.

The setup process typically takes 1-24 hours for DNS propagation and SSL certificate provisioning. 