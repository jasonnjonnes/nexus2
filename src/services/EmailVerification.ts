// This is a custom email verification service that can be used as an alternative
// to Firebase's built-in email verification.

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// You can replace this with any email service API (SendGrid, Mailgun, AWS SES, etc.)
// For this example, we'll use a placeholder for the API endpoint
const EMAIL_API_URL = process.env.VITE_EMAIL_API_URL || 'https://api.youremailservice.com/v1/send';
const EMAIL_API_KEY = process.env.VITE_EMAIL_API_KEY || 'your-api-key';

export class EmailVerificationService {
  private static instance: EmailVerificationService;
  private verificationTokens: Map<string, { token: string; expires: Date }> = new Map();

  private constructor() {}

  public static getInstance(): EmailVerificationService {
    if (!EmailVerificationService.instance) {
      EmailVerificationService.instance = new EmailVerificationService();
    }
    return EmailVerificationService.instance;
  }

  public async sendVerificationEmail(email: string, name: string): Promise<boolean> {
    try {
      // Generate a verification token
      const token = this.generateToken();
      
      // Store the token with an expiration time (24 hours)
      const expires = new Date();
      expires.setHours(expires.getHours() + 24);
      this.verificationTokens.set(email, { token, expires });

      // Create verification link
      const verificationLink = `${window.location.origin}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

      // Email content
      const emailOptions: SendEmailOptions = {
        to: email,
        subject: 'Verify Your Email Address',
        text: `Hello ${name},\n\nPlease verify your email address by clicking the link below:\n\n${verificationLink}\n\nThis link will expire in 24 hours.\n\nThank you,\nYour App Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Email Verification</h2>
            <p>Hello ${name},</p>
            <p>Please verify your email address by clicking the button below:</p>
            <p style="text-align: center;">
              <a href="${verificationLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Verify Email
              </a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p>${verificationLink}</p>
            <p>This link will expire in 24 hours.</p>
            <p>Thank you,<br>Your App Team</p>
          </div>
        `
      };

      // Send the email using the API
      await this.sendEmail(emailOptions);
      return true;
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return false;
    }
  }

  public verifyToken(email: string, token: string): boolean {
    const storedData = this.verificationTokens.get(email);
    
    if (!storedData) {
      return false;
    }

    const { token: storedToken, expires } = storedData;
    
    // Check if token matches and hasn't expired
    if (token === storedToken && new Date() < expires) {
      // Remove the token after successful verification
      this.verificationTokens.delete(email);
      return true;
    }
    
    return false;
  }

  private generateToken(): string {
    // Generate a random string for verification
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private async sendEmail(options: SendEmailOptions): Promise<void> {
    try {
      // In a real implementation, you would call your email service API
      // For example, using SendGrid, Mailgun, or AWS SES
      await fetch(EMAIL_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${EMAIL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      });
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
} 