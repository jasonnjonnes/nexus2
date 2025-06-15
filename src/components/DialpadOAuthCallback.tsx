import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';
import DialpadAPIService, { DialpadOAuthConfig } from '../services/DialpadAPIService';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';

const DialpadOAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tenantId } = useFirebaseAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract parameters from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Check for OAuth errors
        if (error) {
          setStatus('error');
          setMessage(errorDescription || `OAuth error: ${error}`);
          return;
        }

        // Validate required parameters
        if (!code || !state) {
          setStatus('error');
          setMessage('Missing authorization code or state parameter');
          return;
        }

        if (!tenantId) {
          setStatus('error');
          setMessage('No tenant ID found. Please log in again.');
          return;
        }

        // Initialize Dialpad service
          const clientId = import.meta.env.VITE_DIALPAD_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_DIALPAD_CLIENT_SECRET;
  const redirectUri = import.meta.env.VITE_DIALPAD_REDIRECT_URI || 
    (window.location.hostname === 'localhost' 
      ? `${window.location.origin}/oauth/dialpad/callback`
      : 'https://pro.nexus.io/oauth/dialpad/callback');
  const environment = import.meta.env.VITE_DIALPAD_ENVIRONMENT || 'beta';

        if (!clientId || !clientSecret) {
          setStatus('error');
          setMessage('Dialpad OAuth configuration is missing');
          return;
        }

        const config: DialpadOAuthConfig = {
          clientId,
          clientSecret,
          redirectUri,
          environment: environment as 'sandbox' | 'production',
          scopes: import.meta.env.VITE_DIALPAD_SCOPES?.split(',') || undefined
        };

        const dialpadService = new DialpadAPIService(config);

        // Handle OAuth callback
        setMessage('Exchanging authorization code for access token...');
        const result = await dialpadService.handleOAuthCallback(tenantId, code, state);

        if (result.success && result.user) {
          setStatus('success');
          setMessage('Successfully connected to Dialpad!');
          setUserInfo(result.user);

          // Store success in localStorage for the parent window to detect
          localStorage.setItem('dialpad_auth_success', JSON.stringify({
            timestamp: Date.now(),
            user: result.user
          }));

          // Redirect after a short delay
          setTimeout(() => {
            navigate('/inbound?tab=inbox');
          }, 2000);
        } else {
          setStatus('error');
          setMessage(result.error || 'Authentication failed');
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred during authentication');
      }
    };

    handleCallback();
  }, [searchParams, tenantId, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
        <div className="text-center">
          {/* Status Icon */}
          <div className="mb-4">
            {status === 'loading' && (
              <Loader className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto animate-spin" />
            )}
            {status === 'success' && (
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto" />
            )}
            {status === 'error' && (
              <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400 mx-auto" />
            )}
          </div>

          {/* Title */}
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {status === 'loading' && 'Connecting to Dialpad'}
            {status === 'success' && 'Connection Successful'}
            {status === 'error' && 'Connection Failed'}
          </h1>

          {/* Message */}
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {message}
          </p>

          {/* User Info */}
          {status === 'success' && userInfo && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
              <div className="text-sm text-green-800 dark:text-green-200">
                <p className="font-medium">{userInfo.display_name}</p>
                <p>{userInfo.email}</p>
                <p className="text-xs mt-1">{userInfo.company.name}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {status === 'success' && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Redirecting to inbox...
              </p>
            )}
            
            {status === 'error' && (
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/inbound')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Return to Inbox
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>


        </div>
      </div>
    </div>
  );
};

export default DialpadOAuthCallback; 