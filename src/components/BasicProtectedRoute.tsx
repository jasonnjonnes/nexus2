import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

interface BasicProtectedRouteProps {
  children: React.ReactNode;
}

export default function BasicProtectedRoute({ children }: BasicProtectedRouteProps) {
  const { user, loading: authLoading } = useFirebaseAuth();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [checkingTenant, setCheckingTenant] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    const checkUserTenant = async () => {
      if (!user) {
        setCheckingTenant(false);
        return;
      }

      try {
        // First check custom claims
        const idTokenResult = await user.getIdTokenResult();
        const claims = idTokenResult.claims;
        
        if (claims.tenantId) {
          // User has custom claims - they're fully set up
          setTenantId(claims.tenantId as string);
          setOnboardingComplete(true);
          setCheckingTenant(false);
          return;
        }

        // No custom claims - check if they have a user document (meaning they're in onboarding)
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setTenantId(userData.tenantId || null);
          setOnboardingComplete(userData.onboardingComplete || false);
        } else {
          // No user document - something went wrong, they need to go through signup again
          setTenantId(null);
          setOnboardingComplete(false);
        }
      } catch (error) {
        console.error('Error checking user tenant:', error);
        setTenantId(null);
        setOnboardingComplete(false);
      } finally {
        setCheckingTenant(false);
      }
    };

    if (!authLoading) {
      checkUserTenant();
    }
  }, [user, authLoading]);

  // Still loading authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Still checking tenant status
  if (checkingTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Setting up your account...</p>
        </div>
      </div>
    );
  }

  // User exists but onboarding is not complete
  if (tenantId && onboardingComplete === false) {
    return <Navigate to="/onboarding" replace />;
  }

  // User doesn't have a tenant ID or onboarding status is unclear
  if (!tenantId || onboardingComplete === null) {
    return <Navigate to="/onboarding" replace />;
  }

  // User is fully set up - render the protected content
  return <>{children}</>;
} 
