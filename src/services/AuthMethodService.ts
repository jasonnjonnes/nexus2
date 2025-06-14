import { auth } from '../firebase';
import { 
  User, 
  linkWithCredential, 
  EmailAuthProvider, 
  GoogleAuthProvider,
  updatePassword,
  reauthenticateWithCredential,
  unlink,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  signInWithPopup
} from 'firebase/auth';

export interface AuthMethod {
  providerId: string;
  displayName: string;
  icon: string;
  isLinked: boolean;
  isDefault?: boolean;
}

export interface AuthMethodsInfo {
  methods: AuthMethod[];
  hasPassword: boolean;
  hasGoogle: boolean;
  primaryEmail: string;
  canAddPassword: boolean;
}

export class AuthMethodService {
  private static readonly PROVIDER_INFO = {
    'password': {
      displayName: 'Email & Password',
      icon: '🔐',
    },
    'google.com': {
      displayName: 'Google',
      icon: '🔍',
    },
    'facebook.com': {
      displayName: 'Facebook',
      icon: '📘',
    },
    'twitter.com': {
      displayName: 'Twitter',
      icon: '🐦',
    }
  };

  /**
   * Get all authentication methods for the current user
   */
  static getCurrentUserAuthMethods(): AuthMethodsInfo | null {
    const user = auth.currentUser;
    if (!user) return null;

    const methods: AuthMethod[] = [];
    let hasPassword = false;
    let hasGoogle = false;

    // Check each provider data
    user.providerData.forEach(provider => {
      const providerInfo = this.PROVIDER_INFO[provider.providerId] || {
        displayName: provider.providerId,
        icon: '🔑'
      };

      methods.push({
        providerId: provider.providerId,
        displayName: providerInfo.displayName,
        icon: providerInfo.icon,
        isLinked: true,
        isDefault: provider.providerId === user.providerData[0]?.providerId
      });

      if (provider.providerId === 'password') hasPassword = true;
      if (provider.providerId === 'google.com') hasGoogle = true;
    });

    // Add unlinked methods that could be added
    const availableProviders = ['password', 'google.com'];
    availableProviders.forEach(providerId => {
      const isLinked = methods.some(m => m.providerId === providerId);
      if (!isLinked) {
        const providerInfo = this.PROVIDER_INFO[providerId];
        methods.push({
          providerId,
          displayName: providerInfo.displayName,
          icon: providerInfo.icon,
          isLinked: false
        });
      }
    });

    return {
      methods,
      hasPassword,
      hasGoogle,
      primaryEmail: user.email || '',
      canAddPassword: !hasPassword && !!user.email
    };
  }

  /**
   * Check what sign-in methods are available for an email
   */
  static async getSignInMethodsForEmail(email: string): Promise<string[]> {
    try {
      return await fetchSignInMethodsForEmail(auth, email);
    } catch (error) {
      console.error('Error fetching sign-in methods:', error);
      return [];
    }
  }

  /**
   * Link password authentication to current user
   */
  static async linkPasswordAuth(password: string): Promise<{ success: boolean; error?: string }> {
    const user = auth.currentUser;
    if (!user || !user.email) {
      return { success: false, error: 'No authenticated user found' };
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await linkWithCredential(user, credential);
      return { success: true };
    } catch (error: any) {
      let errorMessage = 'Failed to add password authentication';
      
      switch (error.code) {
        case 'auth/credential-already-in-use':
          errorMessage = 'This email is already associated with another account';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Please choose a stronger password';
          break;
        case 'auth/email-already-in-use':
          errorMessage = 'An account with this email already exists';
          break;
        case 'auth/provider-already-linked':
          errorMessage = 'Password authentication is already linked to this account';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Link Google authentication to current user
   */
  static async linkGoogleAuth(): Promise<{ success: boolean; error?: string }> {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'No authenticated user found' };
    }

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (credential) {
        await linkWithCredential(user, credential);
      }
      
      return { success: true };
    } catch (error: any) {
      let errorMessage = 'Failed to link Google account';
      
      switch (error.code) {
        case 'auth/credential-already-in-use':
          errorMessage = 'This Google account is already linked to another user';
          break;
        case 'auth/provider-already-linked':
          errorMessage = 'Google authentication is already linked to this account';
          break;
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in popup was closed before completion';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Unlink an authentication method
   */
  static async unlinkAuthMethod(providerId: string): Promise<{ success: boolean; error?: string }> {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'No authenticated user found' };
    }

    // Prevent unlinking if it's the only auth method
    if (user.providerData.length <= 1) {
      return { 
        success: false, 
        error: 'Cannot remove the only authentication method. Please add another method first.' 
      };
    }

    try {
      await unlink(user, providerId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to unlink authentication method' };
    }
  }

  /**
   * Update user password (requires current password for email/password users)
   */
  static async updateUserPassword(
    newPassword: string, 
    currentPassword?: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'No authenticated user found' };
    }

    try {
      // If user has password auth and we have current password, reauthenticate first
      if (currentPassword && user.email) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }

      await updatePassword(user, newPassword);
      return { success: true };
    } catch (error: any) {
      let errorMessage = 'Failed to update password';
      
      switch (error.code) {
        case 'auth/wrong-password':
          errorMessage = 'Current password is incorrect';
          break;
        case 'auth/weak-password':
          errorMessage = 'New password is too weak. Please choose a stronger password';
          break;
        case 'auth/requires-recent-login':
          errorMessage = 'Please sign out and sign back in, then try again';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if user can sign in with email/password
   */
  static async canSignInWithEmail(email: string): Promise<{
    canSignIn: boolean;
    availableMethods: string[];
    needsGoogleAuth: boolean;
  }> {
    try {
      const methods = await this.getSignInMethodsForEmail(email);
      
      return {
        canSignIn: methods.includes('password'),
        availableMethods: methods,
        needsGoogleAuth: methods.includes('google.com') && !methods.includes('password')
      };
    } catch (error) {
      return {
        canSignIn: false,
        availableMethods: [],
        needsGoogleAuth: false
      };
    }
  }

  /**
   * Smart sign-in helper that determines the best auth method
   */
  static async smartSignIn(email: string, password?: string): Promise<{
    success: boolean;
    error?: string;
    needsGoogleAuth?: boolean;
    availableMethods?: string[];
  }> {
    try {
      const methodsCheck = await this.canSignInWithEmail(email);

      if (methodsCheck.needsGoogleAuth) {
        return {
          success: false,
          needsGoogleAuth: true,
          availableMethods: methodsCheck.availableMethods,
          error: 'This account was created with Google. Please use "Sign in with Google" instead.'
        };
      }

      if (!methodsCheck.canSignIn || !password) {
        return {
          success: false,
          error: 'No password authentication available for this email',
          availableMethods: methodsCheck.availableMethods
        };
      }

      // Try password sign-in
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };

    } catch (error: any) {
      let errorMessage = 'Sign-in failed';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }

      return { success: false, error: errorMessage };
    }
  }
} 