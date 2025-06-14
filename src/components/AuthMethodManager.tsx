import React, { useState, useEffect } from 'react';
import { AuthMethodService, AuthMethodsInfo } from '../services/AuthMethodService';
import { Shield, Plus, Trash2, Eye, EyeOff, Check, X, AlertTriangle } from 'lucide-react';

interface AuthMethodManagerProps {
  className?: string;
}

const AuthMethodManager: React.FC<AuthMethodManagerProps> = ({ className = '' }) => {
  const [authInfo, setAuthInfo] = useState<AuthMethodsInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadAuthMethods();
  }, []);

  const loadAuthMethods = () => {
    setIsLoading(true);
    const info = AuthMethodService.getCurrentUserAuthMethods();
    setAuthInfo(info);
    setIsLoading(false);
  };

  const clearMessage = () => {
    setTimeout(() => setMessage(null), 5000);
  };

  const handleAddPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      clearMessage();
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      clearMessage();
      return;
    }

    setIsSubmitting(true);
    const result = await AuthMethodService.linkPasswordAuth(newPassword);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Password authentication added successfully!' });
      setShowAddPassword(false);
      setNewPassword('');
      setConfirmPassword('');
      loadAuthMethods();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to add password' });
    }
    
    clearMessage();
    setIsSubmitting(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      clearMessage();
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      clearMessage();
      return;
    }

    setIsSubmitting(true);
    const result = await AuthMethodService.updateUserPassword(newPassword, currentPassword);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setShowChangePassword(false);
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to update password' });
    }
    
    clearMessage();
    setIsSubmitting(false);
  };

  const handleLinkGoogle = async () => {
    setIsSubmitting(true);
    const result = await AuthMethodService.linkGoogleAuth();
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Google account linked successfully!' });
      loadAuthMethods();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to link Google account' });
    }
    
    clearMessage();
    setIsSubmitting(false);
  };

  const handleUnlinkMethod = async (providerId: string) => {
    if (!confirm('Are you sure you want to remove this authentication method?')) {
      return;
    }

    setIsSubmitting(true);
    const result = await AuthMethodService.unlinkAuthMethod(providerId);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Authentication method removed successfully!' });
      loadAuthMethods();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to remove authentication method' });
    }
    
    clearMessage();
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-8 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!authInfo) {
    return (
      <div className={`text-center text-gray-500 ${className}`}>
        <Shield className="mx-auto mb-2" size={24} />
        <p>Unable to load authentication methods</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="text-blue-600" size={24} />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Authentication Methods
        </h3>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-md flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <Check size={16} /> : <X size={16} />}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Security Warning for Google-only users */}
      {authInfo.hasGoogle && !authInfo.hasPassword && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 mt-0.5" size={20} />
            <div>
              <h4 className="font-medium text-yellow-800">Add Password for Better Security</h4>
              <p className="text-sm text-yellow-700 mt-1">
                You're currently using only Google sign-in. Adding a password gives you more 
                options to access your account and improves security.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Authentication Methods */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900 dark:text-gray-100">Current Methods</h4>
        
        {authInfo.methods.filter(m => m.isLinked).map(method => (
          <div key={method.providerId} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{method.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {method.displayName}
                  </span>
                  {method.isDefault && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Primary
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {method.providerId === 'password' ? authInfo.primaryEmail : 'Linked'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {method.providerId === 'password' && (
                <button
                  onClick={() => setShowChangePassword(true)}
                  disabled={isSubmitting}
                  className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  Change Password
                </button>
              )}
              
              {authInfo.methods.filter(m => m.isLinked).length > 1 && (
                <button
                  onClick={() => handleUnlinkMethod(method.providerId)}
                  disabled={isSubmitting}
                  className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                  title="Remove this authentication method"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Available Methods to Add */}
      {authInfo.methods.some(m => !m.isLinked) && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Add Authentication Method</h4>
          
          {authInfo.methods.filter(m => !m.isLinked).map(method => (
            <div key={method.providerId} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-2xl opacity-60">{method.icon}</span>
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {method.displayName}
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {method.providerId === 'password' 
                      ? 'Add password authentication' 
                      : 'Link your Google account'
                    }
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => {
                  if (method.providerId === 'password') {
                    setShowAddPassword(true);
                  } else if (method.providerId === 'google.com') {
                    handleLinkGoogle();
                  }
                }}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Plus size={16} />
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Password Modal */}
      {showAddPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Add Password Authentication
            </h3>
            
            <form onSubmit={handleAddPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Confirm new password"
                />
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPassword(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Change Password
            </h3>
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Enter current password"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Enter new password"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Confirm new password"
                />
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePassword(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setCurrentPassword('');
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthMethodManager; 