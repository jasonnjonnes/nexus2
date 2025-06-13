import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
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
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
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
  
  // Debug logging
  console.log('FirebaseAuthProvider render:', { user: user?.email, loading, tenantId, role });

  useEffect(() => {
    console.log('onAuthStateChanged useEffect running');
    const unsub = onAuthStateChanged(auth, async (u) => {
      console.log('onAuthStateChanged callback triggered', u ? u.email : 'no user');
      setUser(u);
      if (u) {
        try {
          const tokenRes = await u.getIdTokenResult();
          setTenantId((tokenRes.claims as any).tenantId ?? null);
          setRole((tokenRes.claims as any).role ?? null);
          console.log('User signed in:', u.email, 'Claims:', tokenRes.claims);
        } catch (err) {
          console.warn('Failed to load custom claims', err);
        }
      } else {
        setTenantId(null);
        setRole(null);
        console.log('No user signed in');
      }
      setLoading(false);
    });
    return () => {
      console.log('onAuthStateChanged useEffect unsubscribing');
      unsub();
    };
  }, []); // Empty dependency array to prevent loops

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

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Force token refresh to get latest custom claims
      await cred.user.getIdToken(true);
      // Optionally, reload user to ensure claims are up to date
      await cred.user.reload();
      setUser(cred.user);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Force token refresh to get latest custom claims
      await cred.user.getIdToken(true);
      await cred.user.reload();
      setUser(cred.user);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => wrap(() => signOut(auth));

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      // Force token refresh to get latest custom claims
      await cred.user.getIdToken(true);
      await cred.user.reload();
      setUser(cred.user);
    } catch (err: any) {
      setError(err.message);
      throw err;
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