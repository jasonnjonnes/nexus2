import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  User,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updatePhoneNumber
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, phone: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  sendPhoneVerification: (phoneNumber: string) => Promise<void>;
  verifyPhoneNumber: (verificationCode: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  error: string | null;
  verificationStatus: {
    emailVerified: boolean;
    phoneVerified: boolean;
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState({
    emailVerified: false,
    phoneVerified: false
  });
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  
  const auth = getAuth();
  const db = getFirestore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Check verification status
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        setVerificationStatus({
          emailVerified: user.emailVerified,
          phoneVerified: userData?.phoneVerified || false
        });
      } else {
        setVerificationStatus({
          emailVerified: false,
          phoneVerified: false
        });
      }
      setLoading(false);
    });

    // Initialize reCAPTCHA verifier
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      }
    });
    setRecaptchaVerifier(verifier);

    return () => {
      unsubscribe();
      verifier.clear();
    };
  }, [auth, db]);

  const signUp = async (email: string, password: string, name: string, phone: string) => {
    try {
      setError(null);
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update profile
      await updateProfile(user, { displayName: name });

      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email,
        name,
        phone,
        phoneVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Send verification email
      await sendEmailVerification(user);

      // Send phone verification
      await sendPhoneVerification(phone);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
      throw err;
    }
  };

  const sendVerificationEmail = async () => {
    if (!user) throw new Error('No user logged in');
    try {
      setError(null);
      await sendEmailVerification(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification email');
      throw err;
    }
  };

  const sendPhoneVerification = async (phoneNumber: string) => {
    if (!recaptchaVerifier) throw new Error('reCAPTCHA not initialized');
    try {
      setError(null);
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      // Store the confirmation result in window for later use
      (window as any).confirmationResult = confirmationResult;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send phone verification');
      throw err;
    }
  };

  const verifyPhoneNumber = async (verificationCode: string) => {
    if (!user) throw new Error('No user logged in');
    try {
      setError(null);
      const confirmationResult = (window as any).confirmationResult;
      if (!confirmationResult) throw new Error('No verification in progress');

      const credential = PhoneAuthProvider.credential(
        confirmationResult.verificationId,
        verificationCode
      );

      // Update phone number
      await updatePhoneNumber(user, credential);

      // Update user document
      await updateDoc(doc(db, 'users', user.uid), {
        phoneVerified: true,
        updatedAt: new Date().toISOString()
      });

      setVerificationStatus(prev => ({
        ...prev,
        phoneVerified: true
      }));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify phone number');
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setError(null);
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send password reset email');
      throw err;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      throw err;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await firebaseSignOut(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out');
      throw err;
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    sendVerificationEmail,
    sendPhoneVerification,
    verifyPhoneNumber,
    resetPassword,
    error,
    verificationStatus
  };

  return (
    <AuthContext.Provider value={value}>
      <div id="recaptcha-container"></div>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 