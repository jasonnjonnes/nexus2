import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Mail, Search, Star, Archive, Trash2, Reply, Forward, MoreHorizontal, Paperclip, Send, RefreshCw, X, Plus, Settings, UserPlus } from 'lucide-react';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

interface Email {
  id: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  folder: string;
  isRead: boolean;
  receivedAt?: any;
  sentAt?: any;
  status: string;
  attachments?: Array<{
    filename: string;
    size: number;
  }>;
}

interface EmailAccount {
  id: string;
  provider: 'gmail' | 'outlook' | 'icloud' | 'yahoo' | 'other';
  email: string;
  displayName: string;
  isConnected: boolean;
  lastSync?: Date;
}

const FirebaseEmailInterface: React.FC = () => {
  const { tenantId, user } = useFirebaseAuth();
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);

  // Compose form state
  const [composeForm, setComposeForm] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: ''
  });

  // Firebase Functions - memoize to prevent recreation
  const getEmailsFunction = useMemo(() => httpsCallable(functions, 'getEmails'), []);
  const sendEmailFunction = useMemo(() => httpsCallable(functions, 'sendEmail'), []);
  const markEmailAsReadFunction = useMemo(() => httpsCallable(functions, 'markEmailAsRead'), []);
  const addEmailAccountFunction = useMemo(() => httpsCallable(functions, 'addEmailAccount'), []);
  const getEmailAccountsFunction = useMemo(() => httpsCallable(functions, 'getEmailAccounts'), []);
  const syncGmailEmailsFunction = useMemo(() => httpsCallable(functions, 'syncGmailEmails'), []);

  // Load emails from Firebase with retry logic
  const loadEmails = useCallback(async (retryCount = 0) => {
    if (!tenantId) return;

    try {
      setIsLoading(true);
      
      // Add a small delay to prevent rapid requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const result = await getEmailsFunction({
        tenantId,
        folder: currentFolder,
        limit: 50
      });
      
      const emailsData = (result.data as any)?.emails || [];
      setEmails(emailsData);
      setHasError(false);
    } catch (error: any) {
      console.error('Error loading emails:', error);
      
      // Retry logic for resource errors
      if (retryCount < 2 && (
        error.message?.includes('INSUFFICIENT_RESOURCES') || 
        error.code === 'internal'
      )) {
        console.log(`Retrying email load (attempt ${retryCount + 1})`);
        setTimeout(() => {
          loadEmails(retryCount + 1).catch(err => {
            console.error('Retry failed:', err);
          });
        }, 1000 * (retryCount + 1));
        return;
      }
      
      setHasError(true);
      // Fallback to demo data if Firebase functions have issues
      console.log('Using demo data due to Firebase Functions error');
      setEmails([
        {
          id: 'demo-1',
          from: 'sarah.johnson@customer.com',
          to: user?.email || '',
          subject: 'Service Request - HVAC Maintenance',
          body: 'Hi, I need to schedule maintenance for my HVAC system. Could you please provide availability for next week?',
          folder: 'inbox',
          isRead: false,
          receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          status: 'received',
          attachments: []
        },
        {
          id: 'demo-2',
          from: 'mike.wilson@email.com',
          to: user?.email || '',
          subject: 'Re: Invoice #1234',
          body: 'Thank you for the quick service. Payment has been processed through our accounting department.',
          folder: 'inbox',
          isRead: false,
          receivedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
          status: 'received',
          attachments: []
        },
        {
          id: 'demo-3',
          from: 'emma.davis@company.com',
          to: user?.email || '',
          subject: 'Quote Request - Plumbing Installation',
          body: 'Could you please provide a quote for bathroom plumbing installation? We have the plans ready.',
          folder: 'inbox',
          isRead: true,
          receivedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          status: 'received',
          attachments: [{ filename: 'bathroom_plans.pdf', size: 2048000 }]
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, currentFolder, getEmailsFunction]);

  // Load email accounts from Firebase
  const loadEmailAccounts = useCallback(async () => {
    if (!tenantId) return;

    try {
      const result = await getEmailAccountsFunction({
        tenantId
      });
      
      const accountsData = (result.data as any)?.accounts || [];
      setEmailAccounts(accountsData);
    } catch (error) {
      console.error('Error loading email accounts:', error);
      // Set demo accounts if Firebase fails
      setEmailAccounts([
        {
          id: 'demo-gmail',
          provider: 'gmail',
          email: 'demo@gmail.com',
          displayName: 'Demo Gmail Account',
          isConnected: false,
          lastSync: new Date()
        }
      ]);
    }
  }, [tenantId, getEmailAccountsFunction]);

  // Load emails on component mount and folder change with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadEmails().catch(error => {
        console.error('Failed to load emails:', error);
      });
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [loadEmails]);

  // Load email accounts on component mount
  useEffect(() => {
    loadEmailAccounts().catch(error => {
      console.error('Failed to load email accounts:', error);
    });
  }, [loadEmailAccounts]);

  // Handle click outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDropdown && !(event.target as Element).closest('.dropdown-container')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Handle OAuth callback
  useEffect(() => {
    const handleOAuthCallback = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const oauthSuccess = urlParams.get('oauth_success');
        const oauthError = urlParams.get('oauth_error');
        const provider = urlParams.get('provider');
        
        if (oauthSuccess === 'true') {
          // OAuth was successful
          const storedProvider = sessionStorage.getItem('oauth_provider');
          const returnUrl = sessionStorage.getItem('oauth_return_url');
          
          // Clean up session storage
          sessionStorage.removeItem('oauth_provider');
          sessionStorage.removeItem('oauth_return_url');
          
          // Show success message
          setTimeout(() => {
            alert(`${storedProvider || provider} account connected successfully!`);
            
            // Refresh email accounts
            loadEmailAccounts().catch(error => {
              console.error('Failed to refresh email accounts:', error);
            });
          }, 500);
          
          // Clean up URL parameters and redirect back
          if (returnUrl) {
            window.history.replaceState({}, document.title, returnUrl);
          } else {
            // Remove oauth parameters from URL
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          }
        } else if (oauthError) {
          // OAuth failed
          const storedProvider = sessionStorage.getItem('oauth_provider');
          const returnUrl = sessionStorage.getItem('oauth_return_url');
          
          // Clean up session storage
          sessionStorage.removeItem('oauth_provider');
          sessionStorage.removeItem('oauth_return_url');
          
          // Show error message
          setTimeout(() => {
            alert(`Failed to connect ${storedProvider || provider} account: ${oauthError}`);
          }, 500);
          
          // Clean up URL and redirect back
          if (returnUrl) {
            window.history.replaceState({}, document.title, returnUrl);
          } else {
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          }
        }
      } catch (error) {
        console.error('Error handling OAuth callback:', error);
      }
    };

    handleOAuthCallback();
  }, [loadEmailAccounts]);

  // Refresh emails
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEmails();
    setRefreshing(false);
  };

  // Mark email as read
  const handleEmailClick = async (email: Email) => {
    setSelectedEmail(email);
    
    if (!email.isRead && email.id.startsWith('demo-')) {
      // For demo emails, just update locally
      setEmails(prev => prev.map(e => 
        e.id === email.id ? { ...e, isRead: true } : e
      ));
    } else if (!email.isRead && tenantId) {
      // For real emails, call Firebase function
      try {
        await markEmailAsReadFunction({
          tenantId,
          emailId: email.id,
          isRead: true
        });
        
        setEmails(prev => prev.map(e => 
          e.id === email.id ? { ...e, isRead: true } : e
        ));
      } catch (error) {
        console.error('Error marking email as read:', error);
      }
    }
  };

  // Handle adding email account
  const handleAddEmailAccount = async (provider: string, email: string) => {
    if (!tenantId) return;

    try {
      const result = await addEmailAccountFunction({
        tenantId,
        provider,
        email
      });
      
      const response = result.data as any;
      
      if (response.success && response.oauthUrl) {
        // Close the modal
        setShowAddAccount(false);
        
        // Detect if we're in a secure context for popup usage
        const isSecureContext = window.isSecureContext || window.location.protocol === 'https:';
        const usePopup = isSecureContext && window.location.hostname !== 'localhost';
        
        if (usePopup) {
          // Try popup approach for HTTPS sites
          try {
            const popup = window.open('', 'oauth', 'width=500,height=600,scrollbars=yes,resizable=yes');
            
            if (popup) {
              // Use the OAuth URL without adding popup parameter
              popup.location.href = response.oauthUrl;
              
              // Listen for messages from the popup
              const messageHandler = (event: MessageEvent) => {
                if (event.origin !== window.location.origin) return;
                
                if (event.data.type === 'OAUTH_SUCCESS') {
                  popup.close();
                  window.removeEventListener('message', messageHandler);
                  alert(`${provider} account connected successfully!`);
                  loadEmailAccounts().catch(console.error);
                } else if (event.data.type === 'OAUTH_ERROR') {
                  popup.close();
                  window.removeEventListener('message', messageHandler);
                  alert(`Failed to connect ${provider} account: ${event.data.error}`);
                }
              };
              
              window.addEventListener('message', messageHandler);
              
              // Fallback timeout
              setTimeout(() => {
                if (!popup.closed) {
                  popup.close();
                  window.removeEventListener('message', messageHandler);
                  alert('OAuth window was closed. Please try again.');
                }
              }, 300000); // 5 minutes timeout
              
              // Inform user about potential Google OAuth warnings
              console.info('Note: Any accessibility warnings in the OAuth popup are from Google\'s interface, not our application.');
              alert(`${provider} OAuth initiated. Please complete authentication in the popup window.\n\n(Note: You may see accessibility warnings in the console - these are from Google's OAuth interface, not our app.)`);
            } else {
              throw new Error('Popup blocked');
            }
          } catch (popupError) {
            console.log('Popup failed, falling back to redirect:', popupError);
            // Fallback to redirect method
            useRedirectMethod(response.oauthUrl, provider);
          }
        } else {
          // Use redirect method for localhost or HTTP
          useRedirectMethod(response.oauthUrl, provider);
        }
      } else {
        alert('Email account setup initiated, but OAuth URL not available.');
      }
    } catch (error) {
      console.error('Error adding email account:', error);
      alert('Failed to add email account. Please try again.');
      setIsLoading(false);
    }
  };

  // Helper function for redirect-based OAuth
  const useRedirectMethod = (oauthUrl: string, provider: string) => {
    setIsLoading(true);
    
    // Store current URL to return to after OAuth
    const currentUrl = window.location.href;
    sessionStorage.setItem('oauth_return_url', currentUrl);
    sessionStorage.setItem('oauth_provider', provider);
    
    // Navigate to OAuth URL in the same window
    window.location.href = oauthUrl;
  };

  // Sync Gmail emails
  const handleSyncGmailEmails = async () => {
    if (!tenantId) return;

    // Find connected Gmail accounts
    const gmailAccounts = emailAccounts.filter(account => 
      account.provider === 'gmail' && account.isConnected
    );

    if (gmailAccounts.length === 0) {
      alert('No connected Gmail accounts found. Please add a Gmail account first.');
      return;
    }

    try {
      setIsLoading(true);
      let totalSynced = 0;

      for (const account of gmailAccounts) {
        const result = await syncGmailEmailsFunction({
          tenantId,
          accountId: account.id,
          maxResults: 50
        });

        const response = result.data as any;
        if (response.success) {
          totalSynced += response.syncedCount || 0;
        }
      }

      // Refresh emails after sync
      await loadEmails();
      
      alert(`Successfully synced ${totalSynced} new emails from Gmail.`);
    } catch (error) {
      console.error('Error syncing Gmail emails:', error);
      alert('Failed to sync Gmail emails. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Send email
  const handleSendEmail = async () => {
    if (!tenantId || !composeForm.to || !composeForm.subject) {
      alert('Please fill in required fields (To and Subject)');
      return;
    }

    try {
      await sendEmailFunction({
        tenantId,
        to: composeForm.to.split(',').map(email => email.trim()),
        cc: composeForm.cc ? composeForm.cc.split(',').map(email => email.trim()) : [],
        bcc: composeForm.bcc ? composeForm.bcc.split(',').map(email => email.trim()) : [],
        subject: composeForm.subject,
        body: composeForm.body
      });

      // Reset form and close compose
      setComposeForm({ to: '', cc: '', bcc: '', subject: '', body: '' });
      setShowCompose(false);
      
      // Refresh emails
      await loadEmails();
      
      alert('Email sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    }
  };

  // Format timestamp
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const unreadCount = emails.filter(email => !email.isRead).length;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {currentFolder.charAt(0).toUpperCase() + currentFolder.slice(1)}
          </h3>
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={() => setShowCompose(true)}
              className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
            >
              <Send size={16} />
            </button>
            <div className="relative dropdown-container">
              <button 
                onClick={() => setShowDropdown(!showDropdown)}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
              >
                <MoreHorizontal size={16} />
              </button>
              
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-700 rounded-md shadow-lg border border-gray-200 dark:border-slate-600 z-50">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowAddAccount(true);
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center"
                    >
                      <UserPlus size={14} className="mr-2" />
                      Add Email Account
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        handleSyncGmailEmails();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center"
                    >
                      <RefreshCw size={14} className="mr-2" />
                      Sync Gmail
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        // Add settings functionality later
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center"
                    >
                      <Settings size={14} className="mr-2" />
                      Settings
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Status Notice */}
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <Mail className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-green-900 dark:text-green-100">Firebase Email Service</p>
              <p className="text-xs text-green-700 dark:text-green-300">
                {emails.length > 0 && emails[0].id.startsWith('demo-') 
                  ? 'Demo data - Configure email settings for real emails'
                  : 'Connected to Firebase Functions'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading emails...</span>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
            <Mail className="w-8 h-8 mr-2" />
            <span>No emails in {currentFolder}</span>
          </div>
        ) : (
          emails.map((email) => (
            <div
              key={email.id}
              onClick={() => handleEmailClick(email)}
              className={`p-3 border-b border-gray-100 dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                selectedEmail?.id === email.id ? 'bg-blue-50 dark:bg-slate-700 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex items-center mt-1">
                  {!email.isRead && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  )}
                  <Star 
                    size={14} 
                    className="text-gray-300 dark:text-gray-600 hover:text-yellow-400 cursor-pointer" 
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm truncate ${email.isRead ? 'text-gray-700 dark:text-gray-300' : 'font-semibold text-gray-900 dark:text-gray-100'}`}>
                      {email.from}
                    </span>
                    <div className="flex items-center space-x-1">
                      {email.attachments && email.attachments.length > 0 && (
                        <Paperclip size={12} className="text-gray-400" />
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTime(email.receivedAt || email.sentAt)}
                      </span>
                    </div>
                  </div>
                  
                  <div className={`text-sm truncate ${email.isRead ? 'text-gray-600 dark:text-gray-400' : 'font-medium text-gray-900 dark:text-gray-100'}`}>
                    {email.subject}
                  </div>
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                    {email.body.replace(/<[^>]*>/g, '').substring(0, 100)}...
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Compose Email</h3>
                <button 
                  onClick={() => setShowCompose(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <MoreHorizontal size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              <input
                type="email"
                placeholder="To (required)"
                value={composeForm.to}
                onChange={(e) => setComposeForm(prev => ({ ...prev, to: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                required
              />
              <input
                type="email"
                placeholder="CC (optional)"
                value={composeForm.cc}
                onChange={(e) => setComposeForm(prev => ({ ...prev, cc: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                placeholder="Subject (required)"
                value={composeForm.subject}
                onChange={(e) => setComposeForm(prev => ({ ...prev, subject: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                required
              />
              <textarea
                placeholder="Message body"
                value={composeForm.body}
                onChange={(e) => setComposeForm(prev => ({ ...prev, body: e.target.value }))}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 resize-none"
              />
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end space-x-3">
              <button 
                onClick={() => setShowCompose(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button 
                onClick={handleSendEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Send size={16} className="mr-2" />
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Email Account Modal */}
      {showAddAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Email Account</h3>
                <button 
                  onClick={() => setShowAddAccount(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Choose an email provider to connect your account
              </p>
              
              <div className="space-y-2">
                <button
                  onClick={() => handleAddEmailAccount('gmail', 'gmail')}
                  className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center space-x-3"
                >
                  <div className="w-8 h-8 bg-red-500 rounded flex items-center justify-center">
                    <Mail size={16} className="text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">Gmail</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Connect your Google account</div>
                  </div>
                </button>
                
                <button
                  onClick={() => handleAddEmailAccount('outlook', 'outlook')}
                  className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center space-x-3"
                >
                  <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                    <Mail size={16} className="text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">Outlook</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Connect your Microsoft account</div>
                  </div>
                </button>
                
                <button
                  onClick={() => handleAddEmailAccount('icloud', 'icloud')}
                  className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center space-x-3"
                >
                  <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center">
                    <Mail size={16} className="text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">iCloud</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Connect your Apple account</div>
                  </div>
                </button>
                
                <button
                  onClick={() => handleAddEmailAccount('yahoo', 'yahoo')}
                  className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center space-x-3"
                >
                  <div className="w-8 h-8 bg-purple-500 rounded flex items-center justify-center">
                    <Mail size={16} className="text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">Yahoo</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Connect your Yahoo account</div>
                  </div>
                </button>
                
                <button
                  onClick={() => handleAddEmailAccount('other', 'custom')}
                  className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center space-x-3"
                >
                  <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
                    <Settings size={16} className="text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">Other</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Custom IMAP/SMTP settings</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{unreadCount} unread of {emails.length}</span>
          <span>Firebase Powered</span>
        </div>
      </div>
    </div>
  );
};

export default FirebaseEmailInterface; 