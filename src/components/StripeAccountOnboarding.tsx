import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, CheckCircle, AlertCircle, ExternalLink, Loader, DollarSign, Trash2 } from 'lucide-react';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { stripeService } from '../services/stripeService';
import { loadConnectAndInitialize } from '@stripe/connect-js';

interface StripeAccountData {
  accountId?: string;
  accountStatus?: 'pending' | 'active' | 'restricted';
  onboardingCompleted?: boolean;
  dashboardUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

const StripeAccountOnboarding: React.FC = () => {
  const { user, tenantId } = useFirebaseAuth();
  const userId = user?.uid;

  const [accountData, setAccountData] = useState<StripeAccountData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showEmbeddedOnboarding, setShowEmbeddedOnboarding] = useState(false);
  const [stripeConnectInstance, setStripeConnectInstance] = useState<any>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const onboardingElementRef = useRef<HTMLDivElement>(null);

  // Load existing account data
  const loadAccountData = async () => {
    if (!userId || !tenantId) return;

    try {
      const accountDoc = await getDoc(doc(db, `tenants/${tenantId}/stripeAccounts`, userId));
      if (accountDoc.exists()) {
        setAccountData(accountDoc.data() as StripeAccountData);
      }
    } catch (err) {
      console.error('Error loading Stripe account data:', err);
      setError('Failed to load account information');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccountData();
  }, [userId, tenantId]);

  // Initialize embedded onboarding
  const initializeEmbeddedOnboarding = async (accountId: string) => {
    try {
      // Initialize Stripe Connect
      const stripeConnectInstance = await loadConnectAndInitialize({
        publishableKey: 'pk_test_51RZMFHP1fdhfOoU3wQDUAc4SDNcPUQ5RlzUhp8DeFKi1ouiZNl7MQ8380ysl2CYtqEXMvYNJV82e5qWe2oYfqMo700lKRYxShC',
        fetchClientSecret: async () => {
          // TODO: Replace with actual backend call when Stripe account is activated
          // For now, this will fail but shows the proper structure
          // return await fetch('/api/stripe/account-session', {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify({ accountId })
          // }).then(res => res.json()).then(data => data.client_secret);
          
          throw new Error('Backend endpoint needed for embedded onboarding. Please activate your Stripe account and implement the client secret endpoint.');
        },
      });

      setStripeConnectInstance(stripeConnectInstance);
      setShowEmbeddedOnboarding(true);

      // Create and mount the onboarding component
      if (onboardingElementRef.current) {
        const onboardingComponent = stripeConnectInstance.create('account-onboarding', {
          connectedAccountId: accountId,
        });

        onboardingComponent.mount(onboardingElementRef.current);

        // Listen for onboarding events
        onboardingComponent.on('onboardingCompleted', () => {
          setSuccess('Onboarding completed successfully!');
          setShowEmbeddedOnboarding(false);
          // Refresh account data
          loadAccountData();
        });

        onboardingComponent.on('onboardingExited', () => {
          setShowEmbeddedOnboarding(false);
        });
      }

    } catch (err) {
      console.error('Error initializing embedded onboarding:', err);
      setError('Embedded onboarding requires an active Stripe account and backend endpoint. Please activate your Stripe account first.');
      setShowEmbeddedOnboarding(false);
    }
  };

  // Create Stripe account and start onboarding
  const handleStartOnboarding = async () => {
    if (!userId || !tenantId) return;

    setIsCreatingAccount(true);
    setError(null);
    setSuccess(null);

    try {
      // Step 1: Create Stripe Connect account
      const stripeAccount = await stripeService.createAccount('Test Business Account');

      const newAccountData: StripeAccountData = {
        accountId: stripeAccount.id,
        accountStatus: 'pending',
        onboardingCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to Firestore
      await setDoc(doc(db, `tenants/${tenantId}/stripeAccounts`, userId), newAccountData);
      setAccountData(newAccountData);

      // Step 2: Start onboarding using embedded onboarding
      await initializeEmbeddedOnboarding(stripeAccount.id);

      console.log('Stripe Account Created:', stripeAccount);

    } catch (err) {
      console.error('Error creating Stripe account:', err);
      setError('Failed to create Stripe account. Please try again.');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  // Delete Stripe account and reset local data
  const handleDeleteAccount = async () => {
    if (!userId || !tenantId || !accountData?.accountId) return;

    setIsDeletingAccount(true);
    setError(null);
    setSuccess(null);

    try {
      // Step 1: Delete from Stripe (for test accounts)
      const deleteResult = await stripeService.deleteAccount(accountData.accountId);
      
      if (deleteResult.success) {
        // Step 2: Remove from Firestore
        await setDoc(doc(db, `tenants/${tenantId}/stripeAccounts`, userId), {});
        
        // Step 3: Reset local state
        setAccountData(null);
        setShowDeleteConfirmation(false);
        setSuccess('Account deleted successfully. You can now set up a new payment account.');
      } else {
        setError(deleteResult.message);
      }

    } catch (err) {
      console.error('Error deleting Stripe account:', err);
      setError('Failed to delete account. Please try again.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (isLoading && !accountData) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="animate-spin mr-2" size={20} />
        <span className="text-gray-600 dark:text-gray-400">Loading payment settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {showEmbeddedOnboarding ? (
        // Embedded Onboarding Interface
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Complete Your Account Setup</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please provide the required information to start accepting payments
            </p>
          </div>

          {/* Embedded Onboarding Component Container */}
          <div 
            ref={onboardingElementRef}
            className="min-h-[600px] border border-gray-200 dark:border-slate-600 rounded-lg"
          />

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setShowEmbeddedOnboarding(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Powered by Stripe Connect
            </p>
          </div>
        </div>
      ) : !accountData ? (
        <div className="text-center py-12">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col lg:flex-row items-center justify-center gap-12">
              <div className="relative">
                <div className="w-80 h-[600px] bg-gradient-to-b from-gray-800 to-black rounded-[3.5rem] p-3 shadow-2xl drop-shadow-2xl">
                  <div className="w-full h-full bg-gradient-to-b from-blue-900 via-gray-900 to-gray-800 rounded-[3rem] overflow-hidden shadow-inner relative">
                    {/* Animated blue particles background */}
                    <div className="absolute inset-0 opacity-30">
                      <div className="absolute top-8 left-12 w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
                      <div className="absolute top-16 right-16 w-1 h-1 bg-blue-300 rounded-full animate-pulse delay-100"></div>
                      <div className="absolute top-24 left-8 w-1 h-1 bg-blue-500 rounded-full animate-pulse delay-200"></div>
                      <div className="absolute top-32 right-12 w-1 h-1 bg-blue-400 rounded-full animate-pulse delay-300"></div>
                      <div className="absolute top-40 left-16 w-1 h-1 bg-blue-300 rounded-full animate-pulse delay-400"></div>
                      <div className="absolute top-48 right-8 w-1 h-1 bg-blue-500 rounded-full animate-pulse delay-500"></div>
                      <div className="absolute top-56 left-20 w-1 h-1 bg-blue-400 rounded-full animate-pulse delay-600"></div>
                      <div className="absolute top-64 right-20 w-1 h-1 bg-blue-300 rounded-full animate-pulse delay-700"></div>
                      <div className="absolute top-72 left-24 w-1 h-1 bg-blue-500 rounded-full animate-pulse delay-800"></div>
                      <div className="absolute top-80 right-24 w-1 h-1 bg-blue-400 rounded-full animate-pulse delay-900"></div>
                    </div>
                    
                    <div className="relative z-10 p-6 h-full flex flex-col text-white">
                      {/* NFC Icon and "Hold Here to Pay" */}
                      <div className="text-center mb-8 mt-12">
                        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                          <div className="relative">
                            <div className="w-12 h-12 border-2 border-white rounded-full flex items-center justify-center">
                              <div className="flex space-x-1">
                                <div className="w-1 h-4 bg-white rounded-full"></div>
                                <div className="w-1 h-3 bg-white rounded-full"></div>
                                <div className="w-1 h-2 bg-white rounded-full"></div>
                              </div>
                            </div>
                            <div className="absolute -right-1 -top-1 w-4 h-4">
                              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white">
                                <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" fill="currentColor"/>
                              </svg>
                            </div>
                          </div>
                        </div>
                        <h3 className="text-sm font-medium text-white mb-1">Hold Here to Pay</h3>
                      </div>

                      {/* Payment Card */}
                      <div className="flex-1 flex items-center justify-center">
                        <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 w-full max-w-xs text-center">
                          <div className="w-12 h-12 bg-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                              <path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V19H17V6H7Z" fill="currentColor"/>
                              <path d="M9 8V17H11V8H9ZM13 8V17H15V8H13Z" fill="currentColor"/>
                            </svg>
                          </div>
                          <p className="text-white text-sm mb-2">Pay Grapner's Greenhouse</p>
                          <p className="text-white text-3xl font-bold">$17.25</p>
                        </div>
                      </div>

                      {/* Close button */}
                      <div className="text-center pb-8">
                        <button className="w-8 h-8 text-gray-400 hover:text-white transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="max-w-md text-left lg:text-left">
                <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                  Set up online payments
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                  Accept credit cards, bank transfers, and digital payments from your customers with secure, fast processing.
                </p>
                <button
                  onClick={handleStartOnboarding}
                  disabled={isCreatingAccount}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white text-base font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                >
                  {isCreatingAccount ? (
                    <>
                      <Loader className="animate-spin mr-2" size={18} />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2" size={18} />
                      SET UP PAYMENTS
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-8 max-w-md mx-auto">
              <div className="flex items-center p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="mr-2 text-red-600" size={16} />
                <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="mt-8 max-w-md mx-auto">
              <div className="flex items-center p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="mr-2 text-green-600" size={16} />
                <span className="text-sm text-green-700 dark:text-green-300">{success}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Account Management Interface
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Payment Processing</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your Stripe payment processing account
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <CreditCard className="mr-3 text-blue-600" size={24} />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    Payments Account Processing
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Your payment processing account
                  </p>
                </div>
              </div>
              
              <div className="flex items-center">
                {accountData.accountStatus === 'active' && accountData.onboardingCompleted ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle size={20} className="mr-2" />
                    <span className="text-sm font-medium">Active</span>
                  </div>
                ) : accountData.accountStatus === 'pending' ? (
                  <div className="flex items-center text-yellow-600">
                    <AlertCircle size={20} className="mr-2" />
                    <span className="text-sm font-medium">Pending Setup</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <AlertCircle size={20} className="mr-2" />
                    <span className="text-sm font-medium">Restricted</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Account ID:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400 font-mono">
                    {accountData.accountId}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400 capitalize">
                    {accountData.accountStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {!accountData.onboardingCompleted && (
                <button
                  onClick={() => initializeEmbeddedOnboarding(accountData.accountId!)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="mr-2" size={16} />
                  Complete Setup
                </button>
              )}
              
              <button
                onClick={() => setSuccess('Account management features available!')}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <CreditCard className="mr-2" size={16} />
                Manage Account
              </button>

              <button
                onClick={async () => {
                  if (window.confirm('Are you sure you want to reset your payment account? This will delete your current Stripe account and allow you to start over. This action cannot be undone.')) {
                    try {
                      setError(null);
                      setSuccess(null);
                      
                      // Delete from Firestore (reset local data)
                      if (userId && tenantId) {
                        await setDoc(doc(db, `tenants/${tenantId}/stripeAccounts`, userId), {});
                        setAccountData(null);
                        setSuccess('Account reset successfully. You can now set up a new payment account.');
                      }
                    } catch (err) {
                      console.error('Error resetting account:', err);
                      setError('Failed to reset account. Please try again.');
                    }
                  }
                }}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <DollarSign className="mr-2" size={16} />
                Reset Account
              </button>
            </div>

            {error && (
              <div className="mt-4 flex items-center p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="mr-2 text-red-600" size={16} />
                <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
              </div>
            )}

            {success && (
              <div className="mt-4 flex items-center p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="mr-2 text-green-600" size={16} />
                <span className="text-sm text-green-700 dark:text-green-300">{success}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StripeAccountOnboarding; 