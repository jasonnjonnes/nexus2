# Zero-Downtime Deployment Guide

This guide explains how to deploy your application with zero downtime using Firebase Hosting channels and automated health checks.

## 🚀 Quick Start

### Manual Deployment (Recommended for Production)
```bash
# Zero-downtime deployment with staging validation
npm run deploy

# Or use the script directly
./deploy-zero-downtime.sh
```

### Quick Deployments
```bash
# Deploy to staging only
npm run deploy:staging

# Deploy directly to production (use with caution)
npm run deploy:production

# Run health checks
npm run health-check
```

## 🏗️ How Zero-Downtime Works

### 1. **Firebase Hosting Automatic Zero-Downtime**
Firebase Hosting automatically provides zero-downtime deployments by:
- Uploading new files alongside existing ones
- Atomically switching traffic to new version
- Keeping old version available during transition

### 2. **Blue-Green Deployment Strategy**
Our deployment script implements blue-green deployments:
1. **Build** - Create production build
2. **Deploy to Staging** - Test on staging channel first
3. **Validate** - Run health checks on staging
4. **Deploy Functions** - Update backend functions first
5. **Deploy Frontend** - Update hosting with zero downtime
6. **Final Validation** - Confirm production is healthy
7. **Cleanup** - Remove staging channel

### 3. **Health Monitoring**
Continuous health monitoring ensures:
- Production site accessibility
- Firebase Functions availability
- Database connectivity
- API endpoint responsiveness

## 📋 Deployment Process

### Step-by-Step Manual Process

1. **Pre-deployment Health Check**
   ```bash
   ./health-check.sh
   ```

2. **Deploy to Staging**
   ```bash
   firebase hosting:channel:deploy staging --expires 1h
   ```

3. **Test Staging Environment**
   - Visit staging URL (shown in console output)
   - Test critical functionality
   - Verify email OAuth flows work

4. **Deploy Functions First**
   ```bash
   firebase deploy --only functions
   ```

5. **Deploy Frontend**
   ```bash
   firebase deploy --only hosting
   ```

6. **Post-deployment Health Check**
   ```bash
   ./health-check.sh
   ```

### Automated CI/CD Process

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically:

**On Pull Requests:**
- Runs tests and builds
- Deploys to PR-specific staging channel
- Provides preview URL for testing

**On Main Branch Push:**
- Runs full test suite
- Deploys functions first
- Validates function health
- Deploys to staging channel
- Validates staging health
- Deploys to production
- Validates production health
- Cleans up staging channel
- Automatically rolls back on failure

## 🔧 Configuration

### Environment Variables
Set these in your deployment environment:
```bash
FIREBASE_TOKEN=your_firebase_token
FIREBASE_SERVICE_ACCOUNT=base64_encoded_service_account
```

### Firebase Hosting Channels
```bash
# Create persistent staging channel
firebase hosting:channel:create staging --expires 30d

# Create PR-specific channels (auto-created by CI/CD)
firebase hosting:channel:create pr-123 --expires 7d

# List all channels
firebase hosting:channel:list

# Delete channel
firebase hosting:channel:delete staging
```

## 🏥 Health Monitoring

### Health Check Endpoints
- **Functions Health**: `https://us-central1-servicepro-4c705.cloudfunctions.net/api/health`
- **Production Site**: `https://pro.nexusinc.io`
- **Firebase Hosting**: `https://servicepro-4c705.web.app`

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2025-06-15T02:30:47.990Z",
  "version": "1.0.0",
  "services": {
    "firestore": "healthy",
    "auth": "healthy",
    "functions": "healthy"
  }
}
```

### Monitoring Script
The `health-check.sh` script monitors:
- ✅ Production site accessibility
- ✅ Firebase hosting availability
- ✅ Firebase Functions health
- ✅ Database connectivity
- ✅ API endpoint responsiveness

## 🔄 Rollback Procedures

### Automatic Rollback
The CI/CD pipeline automatically rolls back on deployment failure.

### Manual Rollback
```bash
# List recent releases
firebase hosting:releases:list

# Rollback to specific release
firebase hosting:releases:restore RELEASE_ID

# Or rollback to previous release
firebase hosting:releases:list | head -2 | tail -1 | awk '{print $1}' | xargs firebase hosting:releases:restore
```

### Function Rollback
```bash
# Redeploy previous version of functions
git checkout PREVIOUS_COMMIT
firebase deploy --only functions
git checkout main
```

## 🚨 Troubleshooting

### Common Issues

**1. Build Failures**
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

**2. Function Deployment Timeout**
```bash
# Deploy with increased timeout
firebase deploy --only functions --timeout 600s
```

**3. Health Check Failures**
```bash
# Check specific endpoints
curl -v https://pro.nexusinc.io
curl -v https://us-central1-servicepro-4c705.cloudfunctions.net/api/health
```

**4. Staging Channel Issues**
```bash
# Force delete and recreate
firebase hosting:channel:delete staging --force
firebase hosting:channel:create staging --expires 1h
```

### Emergency Procedures

**1. Immediate Rollback**
```bash
# Quick rollback to last known good version
firebase hosting:releases:list | head -2 | tail -1 | awk '{print $1}' | xargs firebase hosting:releases:restore
```

**2. Maintenance Mode**
```bash
# Deploy maintenance page
echo '<h1>Under Maintenance</h1>' > dist/index.html
firebase deploy --only hosting
```

**3. Function Emergency Stop**
```bash
# Disable problematic function
firebase functions:config:set maintenance.mode=true
firebase deploy --only functions
```

## 📊 Monitoring & Alerts

### Firebase Console Monitoring
- **Hosting**: Monitor traffic and errors
- **Functions**: Check invocation counts and errors
- **Firestore**: Monitor read/write operations

### Custom Monitoring
Set up external monitoring services to:
- Ping health endpoints every minute
- Alert on response time degradation
- Monitor error rates and availability

### Recommended Monitoring Tools
- **Uptime Robot** - Free uptime monitoring
- **Pingdom** - Advanced monitoring with alerts
- **DataDog** - Comprehensive application monitoring
- **Firebase Performance Monitoring** - Built-in performance tracking

## 🔐 Security Considerations

### Secrets Management
- Never commit secrets to git
- Use environment variables for sensitive data
- Rotate Firebase tokens regularly
- Use Firebase service accounts for CI/CD

### Access Control
- Limit Firebase project access
- Use least-privilege principles
- Enable audit logging
- Monitor deployment activities

## 📈 Performance Optimization

### Build Optimization
```bash
# Analyze bundle size
npm run build -- --analyze

# Enable compression
firebase hosting:configure
```

### Caching Strategy
- Static assets: 1 year cache
- HTML files: No cache
- API responses: Appropriate cache headers

### CDN Configuration
Firebase Hosting automatically provides:
- Global CDN distribution
- HTTP/2 support
- Automatic compression
- SSL/TLS termination

## 🎯 Best Practices

1. **Always test in staging first**
2. **Run health checks before and after deployment**
3. **Deploy during low-traffic periods**
4. **Keep rollback procedures ready**
5. **Monitor deployment metrics**
6. **Use feature flags for risky changes**
7. **Maintain deployment logs**
8. **Test OAuth flows after deployment**
9. **Verify email functionality works**
10. **Check all critical user paths**

## 📞 Support

For deployment issues:
1. Check health endpoints
2. Review Firebase Console logs
3. Run diagnostic scripts
4. Check GitHub Actions logs
5. Verify environment configuration

Remember: Zero-downtime deployment is about preparation, monitoring, and having reliable rollback procedures! 🚀 