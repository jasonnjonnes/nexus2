import React, { useState, useEffect, useCallback } from 'react';
import { Phone, CheckCircle, AlertCircle, ExternalLink, Settings, LogOut } from 'lucide-react';
import DialpadAPIService, { DialpadOAuthConfig, DialpadUser } from '../services/DialpadAPIService';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';

interface DialpadOAuthManagerProps {
  onAuthenticationChange?: (authenticated: boolean, user?: DialpadUser) => void;
  className?: string;
}

const DialpadOAuthManager: React.FC<DialpadOAuthManagerProps> = ({
  onAuthenticationChange,
  className = ''
}) => {
  const { user, tenantId } = useFirebaseAuth();
  const [dialpadService, setDialpadService] = useState<DialpadAPIService | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [dialpadUser, setDialpadUser] = useState<DialpadUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Initialize Dialpad service
  useEffect(() => {
      const clientId = import.meta.env.VITE_DIALPAD_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_DIALPAD_CLIENT_SECRET;
  const redirectUri = import.meta.env.VITE_DIALPAD_REDIRECT_URI || 
    (window.location.hostname === 'localhost' 
      ? `${window.location.origin}/oauth/dialpad/callback`
      : 'https://pro.nexus.io/oauth/dialpad/callback');
  const environment = import.meta.env.VITE_DIALPAD_ENVIRONMENT || 'beta';

    if (clientId && clientSecret) {
      const config: DialpadOAuthConfig = {
        clientId,
        clientSecret,
        redirectUri,
        environment: environment as 'sandbox' | 'production',
        scopes: import.meta.env.VITE_DIALPAD_SCOPES?.split(',') || undefined
      };

      const service = new DialpadAPIService(config);
      setDialpadService(service);
    } else {
      setError('Dialpad OAuth configuration missing. Please check environment variables.');
    }
  }, []);

  // Check authentication status
  useEffect(() => {
    if (dialpadService && tenantId) {
      const authenticated = dialpadService.isAuthenticated(tenantId);
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        const cachedUser = dialpadService.getCachedUser(tenantId);
        setDialpadUser(cachedUser);
        onAuthenticationChange?.(true, cachedUser || undefined);
      } else {
        setDialpadUser(null);
        onAuthenticationChange?.(false);
      }
    }
  }, [dialpadService, tenantId, onAuthenticationChange]);

  // Handle OAuth callback (should be called from your OAuth callback route)
  const handleOAuthCallback = useCallback(async (code: string, state: string) => {
    if (!dialpadService || !tenantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await dialpadService.handleOAuthCallback(tenantId, code, state);
      
      if (result.success && result.user) {
        setIsAuthenticated(true);
        setDialpadUser(result.user);
        onAuthenticationChange?.(true, result.user);
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [dialpadService, tenantId, onAuthenticationChange]);

  // Start OAuth flow
  const handleLogin = useCallback(() => {
    if (!dialpadService || !tenantId) return;

    try {
      const authUrl = dialpadService.generateAuthUrl(tenantId);
      window.location.href = authUrl;
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to start authentication. Please try again.');
    }
  }, [dialpadService, tenantId]);

  // Logout and revoke tokens
  const handleLogout = useCallback(async () => {
    if (!dialpadService || !tenantId) return;

    setIsLoading(true);
    try {
      await dialpadService.revokeTokens(tenantId);
      setIsAuthenticated(false);
      setDialpadUser(null);
      onAuthenticationChange?.(false);
    } catch (error) {
      console.error('Logout error:', error);
      setError('Failed to logout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [dialpadService, tenantId, onAuthenticationChange]);

  // Refresh authentication
  const handleRefresh = useCallback(async () => {
    if (!dialpadService || !tenantId) return;

    setIsLoading(true);
    try {
      const refreshed = await dialpadService.refreshAccessToken(tenantId);
      if (refreshed) {
        const user = await dialpadService.getCurrentUser(tenantId);
        setDialpadUser(user);
        onAuthenticationChange?.(true, user);
      } else {
        setError('Failed to refresh authentication');
      }
    } catch (error) {
      console.error('Refresh error:', error);
      setError('Failed to refresh authentication');
    } finally {
      setIsLoading(false);
    }
  }, [dialpadService, tenantId, onAuthenticationChange]);

  if (!dialpadService) {
    return (
      <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
          <div>
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Dialpad Configuration Error
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {error || 'Missing Dialpad OAuth configuration'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Dialpad Integration
            </h3>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {isAuthenticated && dialpadUser ? (
          <div className="space-y-4">
            {/* Authenticated Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Connected to Dialpad
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {dialpadUser.display_name} • {dialpadUser.company.name}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoading}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Disconnect
              </button>
            </div>

            {/* User Details */}
            {showSettings && (
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">User ID:</span>
                    <div className="text-gray-900 dark:text-gray-100">{dialpadUser.id}</div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Email:</span>
                    <div className="text-gray-900 dark:text-gray-100">{dialpadUser.email}</div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Timezone:</span>
                    <div className="text-gray-900 dark:text-gray-100">{dialpadUser.timezone}</div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Company ID:</span>
                    <div className="text-gray-900 dark:text-gray-100">{dialpadUser.company.id}</div>
                  </div>
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="w-full text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 py-1 disabled:opacity-50"
                >
                  Refresh Connection
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div>
              <Phone className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Connect your Dialpad account to enable call and SMS tracking
              </p>
            </div>
            
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Connect to Dialpad
            </button>
            
            <p className="text-xs text-gray-500 dark:text-gray-400">
              You'll be redirected to Dialpad to authorize this application
            </p>
          </div>
        )}
      </div>

      {/* OAuth Scopes Info */}
      {showSettings && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Requested Permissions:
          </h4>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Access call logs and history</li>
            <li>• Export SMS message content</li>
            <li>• Access call recordings</li>
            <li>• Maintain connection when offline</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default DialpadOAuthManager;
export { type DialpadUser }; 