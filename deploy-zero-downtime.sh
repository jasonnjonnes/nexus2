#!/bin/bash

# Zero-downtime deployment script for Firebase
# This script uses Firebase hosting channels for blue-green deployments

set -e

echo "🚀 Starting zero-downtime deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STAGING_CHANNEL="staging"
PRODUCTION_CHANNEL="live"
PROJECT_ID=$(firebase use --current 2>/dev/null | grep "Now using project" | awk '{print $4}' || echo "servicepro-4c705")

echo -e "${BLUE}Project ID: ${PROJECT_ID}${NC}"

# Step 1: Build the application
echo -e "${YELLOW}📦 Building application...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed! Aborting deployment.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Step 2: Deploy to staging channel first
echo -e "${YELLOW}🔄 Deploying to staging channel...${NC}"
firebase hosting:channel:deploy $STAGING_CHANNEL --expires 1h

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Staging deployment failed! Aborting.${NC}"
    exit 1
fi

STAGING_URL="https://${PROJECT_ID}--${STAGING_CHANNEL}-$(date +%s | tail -c 8).web.app"
echo -e "${GREEN}✅ Staging deployment successful${NC}"
echo -e "${BLUE}🔗 Staging URL: Check Firebase console for exact URL${NC}"

# Step 3: Ask for confirmation
echo -e "${YELLOW}🤔 Please test the staging deployment.${NC}"
read -p "Deploy to production? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⏸️  Deployment cancelled. Staging environment remains active for testing.${NC}"
    exit 0
fi

# Step 4: Deploy functions first (they have their own zero-downtime)
echo -e "${YELLOW}⚡ Deploying Firebase Functions...${NC}"
firebase deploy --only functions

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Functions deployment failed! Check logs.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Functions deployed successfully${NC}"

# Step 5: Deploy to production (Firebase Hosting handles zero-downtime automatically)
echo -e "${YELLOW}🚀 Deploying to production...${NC}"
firebase deploy --only hosting

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Production deployment failed!${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Production deployment successful!${NC}"

# Step 6: Cleanup staging channel (optional)
read -p "Clean up staging channel? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🧹 Cleaning up staging channel...${NC}"
    firebase hosting:channel:delete $STAGING_CHANNEL --force
    echo -e "${GREEN}✅ Staging channel cleaned up${NC}"
fi

echo -e "${GREEN}🎊 Zero-downtime deployment completed successfully!${NC}"
echo -e "${BLUE}🌐 Your app is live at: https://${PROJECT_ID}.web.app${NC}"
echo -e "${BLUE}🌐 Custom domain: https://pro.nexusinc.io${NC}" 