import React, { createContext, useContext, useState, useEffect } from 'react';
import { BasicAuthService, User } from '../services/BasicAuthService';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  register: (username: string, password: string, name: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function BasicAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize the auth system
  useEffect(() => {
    // Initialize with default admin user if needed
    BasicAuthService.init();
    
    // Check if user is already logged in from localStorage
    const currentUser = BasicAuthService.getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  // Login function
  const login = async (username: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      const loggedInUser = BasicAuthService.login(username, password);
      setUser(loggedInUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to login');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    BasicAuthService.logout();
    setUser(null);
  };

  // Register function
  const register = async (username: string, password: string, name: string) => {
    try {
      setError(null);
      setLoading(true);
      await BasicAuthService.createUser({ username, password, name });
      // Automatically log in after registration
      const registeredUser = BasicAuthService.login(username, password);
      setUser(registeredUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    login,
    logout,
    register,
    loading,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useBasicAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useBasicAuth must be used within a BasicAuthProvider');
  }
  return context;
} 