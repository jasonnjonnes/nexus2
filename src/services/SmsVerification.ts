// This is a custom SMS verification service that can be used as an alternative
// to Firebase's built-in phone authentication.

// You can replace this with any SMS service API (Twilio, Nexmo, MessageBird, etc.)
// For this example, we'll use a placeholder for the API endpoint
const SMS_API_URL = process.env.VITE_SMS_API_URL || 'https://api.yoursmsservice.com/v1/messages';
const SMS_API_KEY = process.env.VITE_SMS_API_KEY || 'your-api-key';

export class SmsVerificationService {
  private static instance: SmsVerificationService;
  private verificationCodes: Map<string, { code: string; expires: Date }> = new Map();

  private constructor() {}

  public static getInstance(): SmsVerificationService {
    if (!SmsVerificationService.instance) {
      SmsVerificationService.instance = new SmsVerificationService();
    }
    return SmsVerificationService.instance;
  }

  public async sendVerificationSms(phoneNumber: string): Promise<boolean> {
    try {
      // Generate a verification code (6 digits)
      const code = this.generateVerificationCode();
      
      // Store the code with an expiration time (10 minutes)
      const expires = new Date();
      expires.setMinutes(expires.getMinutes() + 10);
      this.verificationCodes.set(phoneNumber, { code, expires });

      // SMS content
      const message = `Your verification code is: ${code}. This code will expire in 10 minutes.`;

      // Send the SMS using the API
      await this.sendSms(phoneNumber, message);
      return true;
    } catch (error) {
      console.error('Failed to send verification SMS:', error);
      return false;
    }
  }

  public verifyCode(phoneNumber: string, code: string): boolean {
    const storedData = this.verificationCodes.get(phoneNumber);
    
    if (!storedData) {
      return false;
    }

    const { code: storedCode, expires } = storedData;
    
    // Check if code matches and hasn't expired
    if (code === storedCode && new Date() < expires) {
      // Remove the code after successful verification
      this.verificationCodes.delete(phoneNumber);
      return true;
    }
    
    return false;
  }

  private generateVerificationCode(): string {
    // Generate a 6-digit code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendSms(phoneNumber: string, message: string): Promise<void> {
    try {
      // In a real implementation, you would call your SMS service API
      // For example, using Twilio, Nexmo, or MessageBird
      await fetch(SMS_API_URL, {
        method: 'POST',
        body: JSON.stringify({
          to: phoneNumber,
          message: message
        }),
        headers: {
          'Authorization': `Bearer ${SMS_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }
} 