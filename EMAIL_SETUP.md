# Firebase Email Service Setup

This guide explains how to set up email functionality using Firebase Functions and your existing Firebase infrastructure.

## Prerequisites

- Firebase project already set up ✅
- Firebase CLI installed and authenticated ✅
- Gmail account or SMTP server for sending emails

## Setup Steps

### 1. Configure Email Credentials

Choose one of these options:

#### Option A: Gmail (Recommended)
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password: https://support.google.com/accounts/answer/185833
3. Set Firebase config:
```bash
firebase functions:config:set email.gmail.user="your-email@gmail.com"
firebase functions:config:set email.gmail.password="your-app-password"
```

#### Option B: Custom SMTP Server
```bash
firebase functions:config:set email.smtp.host="your-smtp-server.com"
firebase functions:config:set email.smtp.user="your-email@domain.com"
firebase functions:config:set email.smtp.password="your-password"
```

### 2. Install Dependencies

```bash
cd functions
npm install
```

### 3. Deploy Firebase Functions

```bash
npm run deploy
```

This will deploy these email functions:
- `getEmails` - Retrieve emails from Firestore
- `sendEmail` - Send emails via configured provider
- `markEmailAsRead` - Mark emails as read/unread
- `moveEmailToFolder` - Move emails between folders
- `receiveEmail` - Webhook for incoming emails

### 4. Configure Firestore Indexes

The email system requires these indexes:

```json
{
  "indexes": [
    {
      "collectionGroup": "emails",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "folder", "order": "ASCENDING" },
        { "fieldPath": "receivedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

Add this to your `firestore.indexes.json` and deploy:
```bash
firebase deploy --only firestore:indexes
```

### 5. Set Up Incoming Email (Optional)

For receiving emails, you'll need to configure a webhook with your email provider:

#### Webhook URL:
```
https://your-region-your-project.cloudfunctions.net/receiveEmail
```

#### Popular Email Services:
- **SendGrid**: Configure Inbound Parse webhook
- **Mailgun**: Set up Routes with webhook
- **Postmark**: Configure Inbound webhook
- **Custom IMAP**: Use a service like Zapier to forward emails

### 6. Environment Variables (Alternative to Firebase Config)

You can also use environment variables in Cloud Functions:
```bash
# Set in Firebase Console > Functions > Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
```

## Features

### ✅ Available Now
- Send emails from your Firebase-hosted app
- Store sent emails in Firestore
- Mark emails as read/unread
- Organize emails in folders (inbox, sent, trash)
- Compose new emails with CC/BCC support
- Responsive email interface
- Multi-tenant support

### 🔄 Incoming Emails
- Currently shows demo data
- Configure webhook (step 5) for real incoming emails
- Automatic email parsing and storage

### 🎯 Planned Features
- Email attachments
- Rich text editor
- Email templates
- Auto-reply rules
- Email signatures
- Search functionality

## Firestore Data Structure

```
tenants/{tenantId}/emails/{emailId}
├── from: string
├── to: string
├── cc?: string
├── bcc?: string
├── subject: string
├── body: string (HTML)
├── folder: string (inbox|sent|trash|archive)
├── isRead: boolean
├── receivedAt?: timestamp
├── sentAt?: timestamp
├── status: string
├── attachments?: array
└── tenantId: string
```

## Security

- All functions verify Firebase Authentication tokens
- Users can only access emails for their tenant
- Email credentials stored securely in Firebase Functions config
- CORS configured for your domain only

## Troubleshooting

### "Demo data" showing instead of real emails
- Deploy Firebase Functions: `npm run deploy`
- Check function logs: `firebase functions:log`
- Verify email configuration: `firebase functions:config:get`

### Emails not sending
- Check Gmail App Password is correct
- Verify SMTP settings
- Review function logs for errors

### Functions not deploying  
- Run `npm install` in functions directory
- Check for TypeScript errors: `npm run build`
- Ensure Firebase CLI is up to date

## Cost Considerations

- **Firebase Functions**: Pay per invocation (~$0.40/million)
- **Firestore**: Pay per read/write (~$1.35/million)
- **Gmail API**: Free up to 1 billion quota units/day
- **SMTP Services**: Varies by provider

For most small to medium businesses, costs will be under $10/month.

## Support

- Firebase Functions Documentation: https://firebase.google.com/docs/functions
- Nodemailer Documentation: https://nodemailer.com/
- Firebase Firestore Documentation: https://firebase.google.com/docs/firestore 