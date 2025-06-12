import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useBasicAuth } from '../contexts/BasicAuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export function BasicProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, loading } = useBasicAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Not logged in - redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin route check
  if (adminOnly && !user.isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
} 