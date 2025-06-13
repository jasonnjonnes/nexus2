#!/bin/bash

# Deploy API to Custom Subdomain: api.nexusinc.io
echo "🚀 Deploying Nexus API to api.nexusinc.io..."

# Build the frontend
echo "📦 Building frontend..."
npm run build

# Build and deploy functions
echo "🔧 Building functions..."
cd functions
npm run build
cd ..

# Deploy hosting and functions
echo "🌐 Deploying to Firebase..."
firebase deploy --only hosting,functions

echo "✅ Deployment complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Go to Firebase Console → Hosting"
echo "2. Click 'Add custom domain'"
echo "3. Enter: api.nexusinc.io"
echo "4. Add DNS records as shown in Firebase Console"
echo "5. Wait for SSL certificate provisioning (up to 24 hours)"
echo ""
echo "🔗 Your API will be available at:"
echo "   https://api.nexusinc.io/health"
echo "   https://api.nexusinc.io/api/customers"
echo "   https://api.nexusinc.io/api/jobs"
echo ""
echo "📚 See CUSTOM_DOMAIN_SETUP.md for detailed instructions" 