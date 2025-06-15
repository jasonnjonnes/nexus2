import * as functions from 'firebase-functions';
import * as nodemailer from 'nodemailer';

interface InvitationEmailData {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  businessUnit: string;
  invitationLink: string;
  message?: string;
  companyName?: string;
  invitedByEmail?: string;
}

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  const config = functions.config();
  
  // You can configure this to use different email providers
  // For now, using Gmail SMTP as an example
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.email?.user || process.env.EMAIL_USER,
      pass: config.email?.password || process.env.EMAIL_PASSWORD
    }
  });
};

const generateEmailTemplate = (data: InvitationEmailData): string => {
  const { firstName, role, businessUnit, invitationLink, message, companyName = 'Your Company' } = data;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Team Invitation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3B82F6, #1E40AF); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
        .button { display: inline-block; background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .button:hover { background: #2563EB; }
        .highlight { background: #f0f9ff; padding: 15px; border-left: 4px solid #3B82F6; margin: 20px 0; }
        .warning { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; color: #92400e; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to the Team!</h1>
          <p>You've been invited to join ${companyName}</p>
        </div>
        
        <div class="content">
          <h2>Hi ${firstName}! 👋</h2>
          
          <p>Great news! You've been invited to join our team as a <strong>${role}</strong> in the <strong>${businessUnit}</strong> department.</p>
          
          <div class="highlight">
            <h3>🚀 What's Next?</h3>
            <p>Click the button below to create your account and get started:</p>
            <div style="text-align: center;">
              <a href="${invitationLink}" class="button">Accept Invitation & Create Account</a>
            </div>
          </div>
          
          ${message ? `
            <div class="highlight">
              <h3>💬 Personal Message</h3>
              <p><em>"${message}"</em></p>
            </div>
          ` : ''}
          
          <div class="warning">
            <strong>⏰ Important:</strong> This invitation will expire in 7 days. Please complete your registration soon!
          </div>
          
          <h3>🔧 What You'll Have Access To:</h3>
          <ul>
            <li>Job management and scheduling</li>
            <li>Customer communication tools</li>
            <li>Team collaboration features</li>
            <li>Mobile app for field work</li>
            <li>Reporting and analytics</li>
          </ul>
          
          <p>If you have any questions or need help getting started, don't hesitate to reach out to your manager or our support team.</p>
          
          <p>Welcome aboard! 🎊</p>
        </div>
        
        <div class="footer">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            This invitation was sent by ${companyName}.<br>
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const sendInvitationEmail = functions.https.onCall(async (data: InvitationEmailData, context) => {
  try {
    // Verify the user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send invitations.');
    }

    // Validate required fields
    const { email, firstName, lastName, role, businessUnit, invitationLink } = data;
    
    if (!email || !firstName || !lastName || !role || !businessUnit || !invitationLink) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields for invitation email.');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid email address format.');
    }

    // Create transporter (you can switch between Gmail and SendGrid)
    const transporter = createTransporter();
    
    // Generate email content
    const htmlContent = generateEmailTemplate(data);
    
    // Email options
    const mailOptions = {
      from: {
        name: data.companyName || 'Your Company',
        address: functions.config().email?.user || process.env.EMAIL_USER || 'noreply@yourcompany.com'
      },
      to: email,
      subject: `🎉 You're invited to join our team as a ${role}`,
      html: htmlContent,
      text: `
        Hi ${firstName},
        
        You've been invited to join our team as a ${role} in the ${businessUnit} department.
        
        Click the link below to create your account:
        ${invitationLink}
        
        This invitation will expire in 7 days.
        
        ${data.message ? `Message from your manager: ${data.message}` : ''}
        
        Welcome to the team!
      `
    };

    // Send email
    const result = await transporter.sendMail(mailOptions);
    
    console.log('Invitation email sent successfully:', {
      messageId: result.messageId,
      to: email,
      role: role,
      businessUnit: businessUnit
    });

    return {
      success: true,
      messageId: result.messageId,
      message: 'Invitation email sent successfully'
    };

  } catch (error) {
    console.error('Error sending invitation email:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to send invitation email. Please try again.');
  }
});

// Alternative function for testing email configuration
export const testEmailConfiguration = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const transporter = createTransporter();
    
    // Verify SMTP connection
    await transporter.verify();
    
    return {
      success: true,
      message: 'Email configuration is valid and ready to send emails.'
    };
    
  } catch (error) {
    console.error('Email configuration test failed:', error);
    throw new functions.https.HttpsError('internal', 'Email configuration test failed. Please check your email settings.');
  }
}); 