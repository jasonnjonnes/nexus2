import React, { useState, useEffect, useCallback, useRef } from 'react';
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

interface FirebaseEmailInterfaceProps {
  selectedEmail?: Email | null;
  onEmailSelect?: (email: Email) => void;
}

const FirebaseEmailInterface: React.FC<FirebaseEmailInterfaceProps> = ({ 
  selectedEmail, 
  onEmailSelect 
}) => {
  const { tenantId, user } = useFirebaseAuth();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEmails, setFilteredEmails] = useState<Email[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [composeData, setComposeData] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
    attachments: [] as File[]
  });
  const [isSending, setIsSending] = useState(false);
  const [hasAutoSynced, setHasAutoSynced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Firebase Functions - memoize to prevent recreation
  const getEmailsFunction = httpsCallable(functions, 'getEmails');
  const sendEmailFunction = httpsCallable(functions, 'sendEmail');
  const markEmailAsReadFunction = httpsCallable(functions, 'markEmailAsRead');
  const addEmailAccountFunction = httpsCallable(functions, 'addEmailAccount');
  const getEmailAccountsFunction = httpsCallable(functions, 'getEmailAccounts');
  const syncGmailEmailsFunction = httpsCallable(functions, 'syncGmailEmails');
  const setupGmailWatchFunction = httpsCallable(functions, 'setupGmailWatch');

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

  // Sync Gmail emails
  const handleSyncGmailEmails = useCallback(async () => {
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
      const emailResult = await getEmailsFunction({
        tenantId,
        folder: currentFolder,
        limit: 50
      });
      
      const emailsData = (emailResult.data as any)?.emails || [];
      setEmails(emailsData);
      
      if (totalSynced > 0) {
        alert(`Successfully synced ${totalSynced} new emails from Gmail.`);
      } else {
        alert('No new emails to sync. All emails are up to date.');
      }
    } catch (error) {
      console.error('Error syncing Gmail emails:', error);
      alert('Failed to sync Gmail emails. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, emailAccounts, syncGmailEmailsFunction, getEmailsFunction, currentFolder]);



  // Load emails on component mount and folder change
  useEffect(() => {
    if (!tenantId) return;

    const timeoutId = setTimeout(async () => {
      try {
        setIsLoading(true);
        
        const result = await getEmailsFunction({
          tenantId,
          folder: currentFolder,
          limit: 50
        });
        
        const emailsData = (result.data as any)?.emails || [];
        setEmails(emailsData);
      } catch (error) {
        console.error('Error loading emails:', error);
        // Set demo emails if Firebase fails
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
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [tenantId, currentFolder]); // Only run when tenantId or currentFolder changes

  // Load email accounts on component mount
  useEffect(() => {
    if (!tenantId) return;

    const loadAccounts = async () => {
      try {
        const result = await getEmailAccountsFunction({
          tenantId
        });
        
        const accountsData = (result.data as any)?.accounts || [];
        setEmailAccounts(accountsData);
        
        // Only auto-sync if we have connected Gmail accounts, haven't auto-synced yet, AND there are no emails
        const connectedGmailAccounts = accountsData.filter(account => 
          account.provider === 'gmail' && account.isConnected
        );
        
        // Set up Gmail watch for real-time sync and do initial sync if needed
        if (connectedGmailAccounts.length > 0 && !hasAutoSynced) {
          console.log('Setting up Gmail sync and performing initial sync...');
          setHasAutoSynced(true); // Prevent multiple setups
          
          setTimeout(async () => {
            try {
              setIsLoading(true);
              let totalSynced = 0;

              for (const account of connectedGmailAccounts) {
                try {
                  // Set up Gmail watch for push notifications
                  console.log(`Setting up Gmail watch for account ${account.id}`);
                  const watchResult = await setupGmailWatchFunction({
                    tenantId,
                    accountId: account.id
                  });
                  
                  const response = watchResult.data as any;
                  if (response.success) {
                    console.log(`Gmail watch setup completed for ${account.email}: ${response.message}`);
                  }
                } catch (watchError) {
                  console.error(`Failed to setup Gmail watch for ${account.email}:`, watchError);
                  // Continue with other accounts even if one fails
                }

                // Do initial sync only if no emails exist
                if (emails.length === 0) {
                  try {
                    const result = await syncGmailEmailsFunction({
                      tenantId,
                      accountId: account.id,
                      maxResults: 20 // Reduced for initial sync
                    });

                    const response = result.data as any;
                    if (response.success) {
                      totalSynced += response.syncedCount || 0;
                    }
                  } catch (syncError) {
                    console.error(`Failed to sync emails for ${account.email}:`, syncError);
                  }
                }
              }

              // Refresh emails after sync (only if we actually synced)
              if (totalSynced > 0 || emails.length === 0) {
                const emailResult = await getEmailsFunction({
                  tenantId,
                  folder: currentFolder,
                  limit: 50
                });
                
                const emailsData = (emailResult.data as any)?.emails || [];
                setEmails(emailsData);
              }
              
              if (totalSynced > 0) {
                console.log(`Initial sync completed: ${totalSynced} emails from Gmail`);
              }
              console.log('Gmail sync setup and initial sync completed');
            } catch (error) {
              console.error('Error during Gmail setup:', error);
            } finally {
              setIsLoading(false);
            }
          }, 1000); // Reduced delay
        }
      } catch (error) {
        console.error('Error loading email accounts:', error);
        // Set demo accounts if Firebase fails
        setEmailAccounts([
          {
            id: 'demo-gmail',
            provider: 'gmail',
            email: 'demo@gmail.com',
            displayName: 'Demo Gmail Account',
            isConnected: false
          }
        ]);
      }
    };

    loadAccounts();
  }, [tenantId]); // Only run when tenantId changes - removed hasAutoSynced dependency

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

  // Refresh emails
  const handleRefresh = async () => {
    if (!tenantId) return;
    
    setRefreshing(true);
    try {
      const result = await getEmailsFunction({
        tenantId,
        folder: currentFolder,
        limit: 50
      });
      
      const emailsData = (result.data as any)?.emails || [];
      setEmails(emailsData);
    } catch (error) {
      console.error('Error refreshing emails:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Mark email as read
  const handleEmailClick = async (email: Email) => {
    onEmailSelect?.(email);
    
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
        setShowAddAccount(false);
        window.location.href = response.oauthUrl;
      } else {
        alert('Email account setup initiated, but OAuth URL not available.');
      }
    } catch (error) {
      console.error('Error adding email account:', error);
      alert('Failed to add email account. Please try again.');
    }
  };

  // Send email
  const handleSendEmail = async () => {
    if (!tenantId || !composeData.to || !composeData.subject) {
      alert('Please fill in required fields (To and Subject)');
      return;
    }

    try {
      setIsSending(true);
      
      // Find a connected Gmail account to send from
      const gmailAccount = emailAccounts.find(account => 
        account.provider === 'gmail' && account.isConnected
      );

      if (!gmailAccount) {
        alert('No connected Gmail account found. Please connect a Gmail account first.');
        return;
      }

      const result = await sendEmailFunction({
        tenantId,
        accountId: gmailAccount.id,
        to: composeData.to,
        cc: composeData.cc || undefined,
        bcc: composeData.bcc || undefined,
        subject: composeData.subject,
        body: composeData.body,
        // Note: File attachments would need additional handling for upload
      });

      const response = result.data as any;
      if (response.success) {
        // Reset compose form
        setComposeData({
          to: '',
          cc: '',
          bcc: '',
          subject: '',
          body: '',
          attachments: []
        });
        setIsComposing(false);
        
        // Refresh emails
        const emailResult = await getEmailsFunction({
          tenantId,
          folder: currentFolder,
          limit: 50
        });
        
        const emailsData = (emailResult.data as any)?.emails || [];
        setEmails(emailsData);
        
        alert('Email sent successfully!');
      } else {
        throw new Error(response.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setIsSending(false);
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

  // Filter emails based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredEmails(emails);
      return;
    }

    const filtered = emails.filter(email => 
      email.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.from?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.to?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.body?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    setFilteredEmails(filtered);
  }, [searchTerm, emails]);

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
                      Manual Sync
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
        <div className={`border rounded-lg p-3 ${
          emailAccounts.some(account => account.provider === 'gmail' && account.isConnected)
            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
            : 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700'
        }`}>
          <div className="flex items-start space-x-2">
            <Mail className={`w-4 h-4 mt-0.5 ${
              emailAccounts.some(account => account.provider === 'gmail' && account.isConnected)
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-amber-600 dark:text-amber-400'
            }`} />
            <div>
              <p className={`text-xs font-medium ${
                emailAccounts.some(account => account.provider === 'gmail' && account.isConnected)
                  ? 'text-blue-900 dark:text-blue-100'
                  : 'text-amber-900 dark:text-amber-100'
              }`}>
                {emailAccounts.some(account => account.provider === 'gmail' && account.isConnected)
                  ? 'Gmail Connected'
                  : 'No Email Accounts Connected'
                }
              </p>
              <p className={`text-xs ${
                emailAccounts.some(account => account.provider === 'gmail' && account.isConnected)
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}>
                {emailAccounts.some(account => account.provider === 'gmail' && account.isConnected)
                  ? emails.length === 0 && !emails[0]?.id.startsWith('demo-')
                    ? 'Setting up email sync...'
                    : `${emails.length} emails • Auto-sync every hour`
                  : 'Add an email account to get started'
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
        ) : filteredEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
            <Mail className="w-8 h-8 mb-2" />
            <span className="mb-3">No emails in {currentFolder}</span>
            {emailAccounts.some(account => account.provider === 'gmail' && account.isConnected) && (
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Auto-sync runs every hour. New emails will appear automatically.
                </p>
                <button
                  onClick={handleSyncGmailEmails}
                  className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors flex items-center mx-auto"
                >
                  <RefreshCw size={12} className="mr-1" />
                  Manual Sync
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 p-2">
            {filteredEmails.map((email) => (
              <div
                key={email.id}
                onClick={() => handleEmailClick(email)}
                className={`p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors border-l-4 ${
                  selectedEmail?.id === email.id 
                    ? 'bg-blue-50 dark:bg-slate-700 border-l-blue-500' 
                    : email.isRead 
                      ? 'border-l-transparent' 
                      : 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <Mail size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`text-sm truncate ${
                        email.isRead 
                          ? 'font-normal text-gray-900 dark:text-gray-100' 
                          : 'font-semibold text-gray-900 dark:text-gray-100'
                      }`}>
                        {email.subject || '(No Subject)'}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                        {email.receivedAt ? new Date(email.receivedAt.seconds ? email.receivedAt.seconds * 1000 : email.receivedAt).toLocaleDateString() : 'Unknown'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate mb-1">
                      From: {email.from}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {email.body?.replace(/<[^>]*>/g, '').substring(0, 100)}...
                    </p>
                  </div>
                  {!email.isRead && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Compose Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Compose Email</h3>
              <button
                onClick={() => setShowCompose(false)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Compose Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To *</label>
                <input
                  type="email"
                  value={composeData.to}
                  onChange={(e) => setComposeData(prev => ({ ...prev, to: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="recipient@example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CC</label>
                  <input
                    type="email"
                    value={composeData.cc}
                    onChange={(e) => setComposeData(prev => ({ ...prev, cc: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="cc@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">BCC</label>
                  <input
                    type="email"
                    value={composeData.bcc}
                    onChange={(e) => setComposeData(prev => ({ ...prev, bcc: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="bcc@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject *</label>
                <input
                  type="text"
                  value={composeData.subject}
                  onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Email subject"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                <textarea
                  value={composeData.body}
                  onChange={(e) => setComposeData(prev => ({ ...prev, body: e.target.value }))}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Type your message here..."
                />
              </div>

              {/* Attachments */}
              {composeData.attachments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Attachments</label>
                  <div className="space-y-2">
                    {composeData.attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Paperclip size={14} className="text-gray-500 dark:text-gray-400" />
                          <span className="text-sm text-gray-900 dark:text-gray-100">{file.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setComposeData(prev => ({
                              ...prev,
                              attachments: prev.attachments.filter((_, i) => i !== index)
                            }));
                          }}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Compose Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setComposeData(prev => ({
                      ...prev,
                      attachments: [...prev.attachments, ...files]
                    }));
                  }}
                  multiple
                  className="hidden"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Attach files"
                >
                  <Paperclip size={18} />
                </button>
                {selectedEmail && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setComposeData(prev => ({
                        ...prev,
                        to: '',
                        cc: '',
                        bcc: '',
                        subject: `Re: ${selectedEmail.subject}`,
                        body: `\n\n--- Original Message ---\nFrom: ${selectedEmail.from}\nTo: ${selectedEmail.to}\nSubject: ${selectedEmail.subject}\n\n${selectedEmail.body}`,
                        attachments: []
                      }));
                      setIsComposing(true);
                    }}
                    className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title="Reply"
                  >
                    <Reply size={18} />
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCompose(false);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={isSending || !composeData.to.trim() || !composeData.subject.trim()}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} className="mr-2" />
                      Send
                    </>
                  )}
                </button>
              </div>
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