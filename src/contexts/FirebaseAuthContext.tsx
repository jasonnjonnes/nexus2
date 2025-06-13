import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User as FirebaseUser,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';

// Load Firebase config injected by Vite
const firebaseCfg: any = typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;

// Prevent duplicate apps during Vite HMR
const firebaseApp = initializeApp(firebaseCfg, '[WEB]');
const auth = getAuth(firebaseApp);
setPersistence(auth, browserLocalPersistence);

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  /** Firebase custom claim: company identifier (null until loaded) */
  companyId: string | null;
  /** Firebase custom claim: role name such as 'admin', 'office', 'technician' */
  role: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Custom claims that drive multi-tenant access
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (u) {
        try {
          const tokenRes = await u.getIdTokenResult(true); // force refresh so recently set claims are present
          setCompanyId((tokenRes.claims as any).companyId ?? null);
          setRole((tokenRes.claims as any).role ?? null);
        } catch (err) {
          console.warn('Failed to load custom claims', err);
        }
      } else {
        setCompanyId(null);
        setRole(null);
      }

      setLoading(false);
    });
    return () => unsub();
  }, []);

  const wrap = async (fn: () => Promise<any>) => {
    setError(null);
    setLoading(true);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message || 'Authentication error');
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const login = (email: string, password: string) => wrap(() => signInWithEmailAndPassword(auth, email, password));
  const register = (email: string, password: string) => wrap(() => createUserWithEmailAndPassword(auth, email, password));
  const logout = () => wrap(() => signOut(auth));

  const value: AuthContextType = {
    user,
    loading,
    error,
    companyId,
    role,
    login,
    register,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useFirebaseAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useFirebaseAuth must be used within FirebaseAuthProvider');
  return ctx;
}; 