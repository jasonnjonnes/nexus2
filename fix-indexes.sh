#!/bin/bash

echo "🔧 Fixing Firebase Firestore Index Errors..."
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed!"
    echo "Please install it with: npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in
echo "📋 Checking Firebase authentication..."
if ! firebase list &> /dev/null; then
    echo "🔐 Please log in to Firebase first:"
    firebase login
fi

echo ""
echo "🚀 Deploying Firestore indexes..."
echo "This will create the missing composite indexes for:"
echo "  - expenses (userId + createdAt)"
echo "  - invoices (userId + createdAt)" 
echo "  - payments (userId + createdAt)"
echo "  - estimates (userId + createdAt)"
echo ""

# Deploy the indexes
firebase deploy --only firestore:indexes

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Index deployment initiated successfully!"
    echo ""
    echo "📝 NOTE:"
    echo "• Index creation can take 5-15 minutes"
    echo "• The console errors will disappear once indexes are built"
    echo "• You can monitor progress in Firebase Console"
    echo ""
    echo "🌐 Check index status at:"
    echo "https://console.firebase.google.com/project/servicepro-4c705/firestore/indexes"
    echo ""
else
    echo ""
    echo "❌ Index deployment failed!"
    echo "Please check your Firebase project configuration"
    echo ""
fi 