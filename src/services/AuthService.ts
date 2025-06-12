import { EmailVerificationService } from './EmailVerification';
import { SmsVerificationService } from './SmsVerification';

// User interface
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// This is a custom authentication service that can be used as an alternative
// to Firebase Authentication.
export class AuthService {
  private static instance: AuthService;
  private users: Map<string, User> = new Map();
  private currentUser: User | null = null;
  private emailVerificationService: EmailVerificationService;
  private smsVerificationService: SmsVerificationService;

  private constructor() {
    this.emailVerificationService = EmailVerificationService.getInstance();
    this.smsVerificationService = SmsVerificationService.getInstance();
    
    // Load user from localStorage if available
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        this.currentUser = {
          ...userData,
          createdAt: new Date(userData.createdAt),
          updatedAt: new Date(userData.updatedAt)
        };
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('currentUser');
      }
    }
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async signUp(email: string, password: string, name: string, phone?: string): Promise<User> {
    // Check if user already exists
    if (this.getUserByEmail(email)) {
      throw new Error('User with this email already exists');
    }

    // Create a new user
    const user: User = {
      id: this.generateUserId(),
      email,
      name,
      phone,
      emailVerified: false,
      phoneVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store user
    this.users.set(user.id, user);
    
    // Store user credentials (in a real app, you'd hash the password)
    localStorage.setItem(`user_${email}`, JSON.stringify({ password }));

    // Send verification email
    await this.emailVerificationService.sendVerificationEmail(email, name);

    // Send SMS verification if phone is provided
    if (phone) {
      await this.smsVerificationService.sendVerificationSms(phone);
    }

    return user;
  }

  public async signIn(email: string, password: string): Promise<User> {
    // Get stored credentials
    const storedCredentials = localStorage.getItem(`user_${email}`);
    if (!storedCredentials) {
      throw new Error('User not found');
    }

    const { password: storedPassword } = JSON.parse(storedCredentials);

    // Check password (in a real app, you'd compare hashed passwords)
    if (password !== storedPassword) {
      throw new Error('Invalid password');
    }

    // Find user by email
    const user = this.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    // Set current user
    this.currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));

    return user;
  }

  public signOut(): void {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public async verifyEmail(email: string, token: string): Promise<boolean> {
    const isVerified = this.emailVerificationService.verifyToken(email, token);
    
    if (isVerified) {
      // Update user's email verification status
      const user = this.getUserByEmail(email);
      if (user) {
        user.emailVerified = true;
        user.updatedAt = new Date();
        
        // Update current user if it's the same user
        if (this.currentUser && this.currentUser.email === email) {
          this.currentUser = { ...user };
          localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        }
      }
    }
    
    return isVerified;
  }

  public async verifyPhone(phone: string, code: string): Promise<boolean> {
    const isVerified = this.smsVerificationService.verifyCode(phone, code);
    
    if (isVerified) {
      // Update user's phone verification status
      const user = this.getUserByPhone(phone);
      if (user) {
        user.phoneVerified = true;
        user.updatedAt = new Date();
        
        // Update current user if it's the same user
        if (this.currentUser && this.currentUser.phone === phone) {
          this.currentUser = { ...user };
          localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        }
      }
    }
    
    return isVerified;
  }

  public async resendEmailVerification(email: string): Promise<boolean> {
    const user = this.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    return this.emailVerificationService.sendVerificationEmail(email, user.name);
  }

  public async resendPhoneVerification(phone: string): Promise<boolean> {
    if (!phone) {
      throw new Error('Phone number is required');
    }

    return this.smsVerificationService.sendVerificationSms(phone);
  }

  private getUserByEmail(email: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return undefined;
  }

  private getUserByPhone(phone: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.phone === phone) {
        return user;
      }
    }
    return undefined;
  }

  private generateUserId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
} 