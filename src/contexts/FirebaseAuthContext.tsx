import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User as FirebaseUser,
  browserLocalPersistence,
  setPersistence,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { useNavigate, useLocation } from 'react-router-dom';

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
  /** Firebase custom claim: tenant identifier (null until loaded) */
  tenantId: string | null;
  /** Firebase custom claim: role name such as 'admin', 'office', 'technician' */
  role: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Custom claims that drive multi-tenant access
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const tokenRes = await u.getIdTokenResult(); // do not force refresh
          setTenantId((tokenRes.claims as any).tenantId ?? null);
          setRole((tokenRes.claims as any).role ?? null);
          console.log('User signed in:', u.email, 'Claims:', tokenRes.claims);
        } catch (err) {
          console.warn('Failed to load custom claims', err);
        }
        // Redirect to dashboard if not already there or on login
        if (location.pathname === '/login' || location.pathname === '/') {
          navigate('/dashboard');
        }
      } else {
        setTenantId(null);
        setRole(null);
        console.log('No user signed in');
      }
      setLoading(false);
    });
    return () => unsub();
  }, [navigate]);

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

  const signInWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(() => ({
    user,
    loading,
    error,
    tenantId,
    role,
    login,
    register,
    logout,
    signInWithGoogle
  }), [user, loading, error, tenantId, role]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useFirebaseAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useFirebaseAuth must be used within FirebaseAuthProvider');
  return ctx;
}; 