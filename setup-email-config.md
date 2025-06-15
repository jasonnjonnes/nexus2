# Email Configuration Setup for Staff Invitations

## 🚀 **Firebase Functions Deployed Successfully!**

Your invitation email functions are now deployed:
- ✅ `sendInvitationEmail` - Sends beautiful HTML invitation emails
- ✅ `testEmailConfiguration` - Tests your email setup

## 📧 **Email Configuration Options**

### **Option 1: Gmail SMTP (Recommended for Testing)**

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. **Set Firebase Config**:
   ```bash
   firebase functions:config:set email.user="your-email@gmail.com"
   firebase functions:config:set email.password="your-app-password"
   ```

### **Option 2: SendGrid (Recommended for Production)**

1. **Sign up for SendGrid** (free tier: 100 emails/day)
2. **Get API Key** from SendGrid dashboard
3. **Update the function** to use SendGrid transporter
4. **Set Firebase Config**:
   ```bash
   firebase functions:config:set sendgrid.api_key="your-sendgrid-api-key"
   ```

### **Option 3: Environment Variables (Local Development)**

Create `.env` file in functions directory:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

## 🧪 **Testing the Setup**

### **Test Email Configuration**
```javascript
// In your browser console or test script
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const testEmail = httpsCallable(functions, 'testEmailConfiguration');

testEmail().then(result => {
  console.log('Email config test:', result.data);
}).catch(error => {
  console.error('Email config error:', error);
});
```

### **Send Test Invitation**
Use the staff invitation modal in your app:
1. Go to Settings → People → Office (or Technicians)
2. Click "Invite Office Staff" or "Invite Technician"
3. Fill out the form and click "Send Invitation"
4. Check the browser console for success/error messages

## 📋 **Current Configuration Commands**

Run these commands in your terminal from the project root:

```bash
# For Gmail SMTP
firebase functions:config:set email.user="your-email@gmail.com"
firebase functions:config:set email.password="your-gmail-app-password"

# Deploy the config
firebase deploy --only functions

# Test the configuration
firebase functions:shell
# Then run: testEmailConfiguration()
```

## 🎨 **Email Template Features**

The invitation emails include:
- ✅ Beautiful HTML design with company branding
- ✅ Clear call-to-action button
- ✅ Personal welcome message (optional)
- ✅ Expiration warning (7 days)
- ✅ Mobile-responsive design
- ✅ Fallback text version

## 🔧 **Customization Options**

### **Company Branding**
Update the email template in `functions/src/sendInvitationEmail.ts`:
- Change company name
- Add your logo
- Customize colors and styling
- Modify the welcome message

### **Email Provider**
Switch between Gmail and SendGrid by updating the `createTransporter()` function.

## 🚨 **Important Notes**

1. **Gmail Limits**: 500 emails/day for free accounts
2. **Security**: Never commit email passwords to git
3. **Production**: Use SendGrid or similar service for production
4. **Testing**: Always test with your own email first
5. **Fallback**: The system will still work without email - invitation links are always generated

## 🎯 **Next Steps**

1. **Set up email credentials** using one of the options above
2. **Test the configuration** using the test function
3. **Send a test invitation** to yourself
4. **Customize the email template** with your branding
5. **Set up production email service** (SendGrid recommended)

## 📞 **Troubleshooting**

### **Common Issues:**
- **"Invalid login"**: Check Gmail app password setup
- **"Connection timeout"**: Check firewall/network settings
- **"Authentication failed"**: Verify credentials are correct
- **"Function not found"**: Ensure functions are deployed

### **Debug Steps:**
1. Check Firebase Functions logs: `firebase functions:log`
2. Test email config: Use `testEmailConfiguration` function
3. Check browser console for detailed error messages
4. Verify Firebase config: `firebase functions:config:get`

---

**Ready to send beautiful invitation emails! 🎉** 