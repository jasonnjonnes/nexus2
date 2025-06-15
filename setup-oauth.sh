#!/bin/bash

# Gmail OAuth Setup Script for Firebase Functions
# Run this script after setting up OAuth credentials in Google Cloud Console

echo "🔧 Gmail OAuth Configuration Setup"
echo "=================================="
echo ""
echo "Before running this script, make sure you have:"
echo "1. Created OAuth 2.0 credentials in Google Cloud Console"
echo "2. Downloaded the credentials JSON file"
echo "3. Have your client ID and client secret ready"
echo ""

read -p "Enter your Gmail OAuth Client ID: " CLIENT_ID
read -p "Enter your Gmail OAuth Client Secret: " CLIENT_SECRET
read -p "Enter your app URL (e.g., http://localhost:3000 or https://yourdomain.com): " APP_URL

echo ""
echo "Setting Firebase Functions configuration..."

# Set OAuth configuration
firebase functions:config:set oauth.gmail.client_id="$CLIENT_ID"
firebase functions:config:set oauth.gmail.client_secret="$CLIENT_SECRET"
firebase functions:config:set oauth.gmail.redirect_uri="https://us-central1-servicepro-4c705.cloudfunctions.net/handleGmailOAuth"

# Set app URL
firebase functions:config:set app.url="$APP_URL"

echo ""
echo "✅ Configuration set successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Verify the configuration: firebase functions:config:get"
echo "2. Add these redirect URIs to your Google Cloud Console:"
echo "   - https://us-central1-servicepro-4c705.cloudfunctions.net/handleGmailOAuth"
echo "   - $APP_URL/oauth/gmail/callback"
echo ""
echo "3. Add these JavaScript origins to your Google Cloud Console:"
echo "   - $APP_URL"
echo "   - http://localhost:5173 (for development)"
echo "   - http://localhost:3000 (for development)"
echo ""
echo "4. Enable these APIs in Google Cloud Console:"
echo "   - Gmail API"
echo "   - Google+ API"
echo "   - People API"
echo ""
echo "5. Test the OAuth flow by clicking 'Add Email Account' → 'Gmail'"
echo ""
echo "🎉 Setup complete! You can now use Gmail OAuth integration." 