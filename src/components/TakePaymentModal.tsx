import React, { useState, useEffect } from 'react';
import { X, CreditCard, DollarSign, User, FileText, Calendar, AlertCircle } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { db } from '../firebase';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  amountPaid: number;
  status: string;
}

interface TakePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice?: Invoice | null; // Optional - for invoice payments
  onPaymentComplete?: (paymentData: any) => void;
}

interface PaymentFormData {
  amount: number;
  customerName: string;
  customerEmail: string;
  paymentMethod: 'stripe' | 'cash' | 'check' | 'bank_transfer';
  memo: string;
  invoiceId?: string;
  checkNumber?: string;
  referenceNumber?: string;
}

const TakePaymentModal: React.FC<TakePaymentModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onPaymentComplete
}) => {
  const { user, tenantId } = useFirebaseAuth();
  const userId = user?.uid;

  const [formData, setFormData] = useState<PaymentFormData>({
    amount: 0,
    customerName: '',
    customerEmail: '',
    paymentMethod: 'stripe',
    memo: '',
    invoiceId: invoice?.id || '',
    checkNumber: '',
    referenceNumber: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStripeForm, setShowStripeForm] = useState(false);

  // Initialize form data when invoice is provided
  useEffect(() => {
    if (invoice) {
      const balanceDue = invoice.total - (invoice.amountPaid || 0);
      setFormData(prev => ({
        ...prev,
        amount: balanceDue,
        customerName: invoice.customerName,
        invoiceId: invoice.id,
        memo: `Payment for Invoice ${invoice.invoiceNumber}`
      }));
    }
  }, [invoice]);

  const handleInputChange = (field: keyof PaymentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.amount || formData.amount <= 0) {
      setError('Please enter a valid payment amount');
      return false;
    }
    if (!formData.customerName.trim()) {
      setError('Please enter customer name');
      return false;
    }
    if (formData.paymentMethod === 'stripe' && !formData.customerEmail.trim()) {
      setError('Email is required for credit card payments');
      return false;
    }
    if (formData.paymentMethod === 'check' && !formData.checkNumber?.trim()) {
      setError('Please enter check number');
      return false;
    }
    return true;
  };

  const handleStripePayment = async () => {
    if (!validateForm()) return;
    
    setIsProcessing(true);
    setShowStripeForm(true);
    
    try {
      // TODO: Implement Stripe Embedded Checkout
      // This will be replaced with actual Stripe integration
      console.log('Processing Stripe payment:', formData);
      
      // Simulate Stripe processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create payment record
      await processPayment({
        ...formData,
        status: 'completed',
        processor: 'stripe',
        stripePaymentIntentId: 'pi_simulated_' + Date.now()
      });
      
    } catch (error) {
      console.error('Stripe payment error:', error);
      setError('Payment processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
      setShowStripeForm(false);
    }
  };

  const handleManualPayment = async () => {
    if (!validateForm()) return;
    
    setIsProcessing(true);
    
    try {
      await processPayment({
        ...formData,
        status: 'completed'
      });
    } catch (error) {
      console.error('Manual payment error:', error);
      setError('Failed to record payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processPayment = async (paymentData: any) => {
    if (!db || !userId || !tenantId) throw new Error('Missing required data');

    const paymentRecord = {
      ...paymentData,
      userId,
      tenantId,
      type: invoice ? 'invoice_payment' : 'standalone_payment',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId
    };

    // Add to centralized payments collection
    const paymentRef = await addDoc(
      collection(db, 'tenants', tenantId, 'payments'),
      paymentRecord
    );

    // If this is an invoice payment, also update the invoice
    if (invoice && formData.invoiceId) {
      const invoicePayment = {
        id: paymentRef.id,
        amount: formData.amount,
        date: new Date().toISOString().split('T')[0],
        method: formData.paymentMethod,
        memo: formData.memo,
        processor: paymentData.processor,
        status: paymentData.status
      };

      await updateDoc(doc(db, 'tenants', tenantId, 'invoices', formData.invoiceId), {
        payments: arrayUnion(invoicePayment),
        amountPaid: (invoice.amountPaid || 0) + formData.amount,
        status: (invoice.amountPaid || 0) + formData.amount >= invoice.total ? 'paid' : 'partial',
        updatedAt: new Date().toISOString()
      });
    }

    // Call completion callback
    if (onPaymentComplete) {
      onPaymentComplete({ ...paymentRecord, id: paymentRef.id });
    }

    // Close modal
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.paymentMethod === 'stripe') {
      await handleStripePayment();
    } else {
      await handleManualPayment();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center">
            <CreditCard className="mr-3 text-blue-600" size={24} />
            <div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                {invoice ? 'Take Invoice Payment' : 'Take Payment'}
              </h2>
              {invoice && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Invoice {invoice.invoiceNumber} • Balance Due: ${(invoice.total - (invoice.amountPaid || 0)).toFixed(2)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Payment Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Payment Method
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'stripe', label: 'Credit Card', icon: CreditCard },
                { value: 'cash', label: 'Cash', icon: DollarSign },
                { value: 'check', label: 'Check', icon: FileText },
                { value: 'bank_transfer', label: 'Bank Transfer', icon: User }
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleInputChange('paymentMethod', value)}
                  className={`p-3 border-2 rounded-lg flex flex-col items-center space-y-2 transition-colors ${
                    formData.paymentMethod === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Customer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Customer Name *
              </label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => handleInputChange('customerName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                placeholder="Enter customer name"
                required
              />
            </div>
            
            {formData.paymentMethod === 'stripe' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Customer Email *
                </label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  placeholder="customer@example.com"
                  required
                />
              </div>
            )}
          </div>

          {/* Payment Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount || ''}
                onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Additional Fields Based on Payment Method */}
          {formData.paymentMethod === 'check' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Check Number *
              </label>
              <input
                type="text"
                value={formData.checkNumber || ''}
                onChange={(e) => handleInputChange('checkNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                placeholder="Enter check number"
                required
              />
            </div>
          )}

          {formData.paymentMethod === 'bank_transfer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reference Number
              </label>
              <input
                type="text"
                value={formData.referenceNumber || ''}
                onChange={(e) => handleInputChange('referenceNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                placeholder="Enter reference number"
              />
            </div>
          )}

          {/* Memo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Memo
            </label>
            <textarea
              value={formData.memo}
              onChange={(e) => handleInputChange('memo', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              placeholder="Optional payment memo or notes"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="mr-2 text-red-600" size={16} />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          {/* Stripe Embedded Form Placeholder */}
          {showStripeForm && (
            <div className="p-6 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="text-center">
                <CreditCard className="mx-auto mb-3 text-blue-600" size={32} />
                <p className="text-blue-700 dark:text-blue-300 font-medium">
                  Stripe Embedded Checkout will appear here
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  Processing payment for ${formData.amount.toFixed(2)}...
                </p>
                <div className="mt-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2" size={16} />
                  {formData.paymentMethod === 'stripe' ? 'Process Payment' : 'Record Payment'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TakePaymentModal; 