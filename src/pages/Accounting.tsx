import React, { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, 
  FileText, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  CheckCircle,
  Filter,
  Download,
  Plus,
  Search,
  User,
  Calendar,
  Briefcase,
  Edit,
  Trash2,
  Save,
  X,
  Receipt,
  CreditCard,
  Building,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { db } from '../firebase';
import TakePaymentModal from '../components/TakePaymentModal';

// Types
interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  jobId?: string;
  jobNumber?: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  amountPaid?: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  createdAt: string;
  dueDate: string;
  paidDate?: string;
  businessUnitId?: string;
  businessUnit?: string;
  services?: any[];
  materials?: any[];
  payments?: Payment[];
}

interface Payment {
  id: string;
  invoiceId?: string;
  customerName: string;
  amount: number;
  date: string;
  method: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'other';
  processor?: string;
  memo?: string;
  type: 'invoice_payment' | 'deposit' | 'refund';
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  subcategory?: string;
  vendor?: string;
  jobId?: string;
  jobNumber?: string;
  businessUnitId?: string;
  businessUnit?: string;
  paymentMethod: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'other';
  receiptUrl?: string;
  taxDeductible: boolean;
  glAccount?: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  glAccount?: string;
  taxDeductible: boolean;
  requiresReceipt: boolean;
  subcategories: string[];
}

// Default expense categories
const DEFAULT_EXPENSE_CATEGORIES: Omit<ExpenseCategory, 'id'>[] = [
  {
    name: 'Vehicle & Transportation',
    description: 'Vehicle expenses, fuel, maintenance, insurance',
    glAccount: '5-200',
    taxDeductible: true,
    requiresReceipt: true,
    subcategories: ['Fuel', 'Vehicle Maintenance', 'Vehicle Insurance', 'Parking & Tolls', 'Vehicle Rental']
  },
  {
    name: 'Materials & Supplies',
    description: 'Job materials, tools, supplies',
    glAccount: '5-100',
    taxDeductible: true,
    requiresReceipt: true,
    subcategories: ['Plumbing Supplies', 'Electrical Supplies', 'HVAC Parts', 'Tools', 'Safety Equipment']
  },
  {
    name: 'Office & Administrative',
    description: 'Office supplies, software, administrative costs',
    glAccount: '5-300',
    taxDeductible: true,
    requiresReceipt: true,
    subcategories: ['Office Supplies', 'Software Subscriptions', 'Phone & Internet', 'Printing', 'Postage']
  },
  {
    name: 'Professional Services',
    description: 'Legal, accounting, consulting fees',
    glAccount: '5-400',
    taxDeductible: true,
    requiresReceipt: true,
    subcategories: ['Legal Fees', 'Accounting Fees', 'Consulting', 'Professional Licenses', 'Training']
  },
  {
    name: 'Rent & Utilities',
    description: 'Office rent, utilities, facility costs',
    glAccount: '5-500',
    taxDeductible: true,
    requiresReceipt: true,
    subcategories: ['Office Rent', 'Electricity', 'Water', 'Gas', 'Internet', 'Phone']
  },
  {
    name: 'Marketing & Advertising',
    description: 'Marketing campaigns, advertising, promotional materials',
    glAccount: '5-600',
    taxDeductible: true,
    requiresReceipt: true,
    subcategories: ['Online Advertising', 'Print Advertising', 'Website', 'Business Cards', 'Trade Shows']
  },
  {
    name: 'Insurance',
    description: 'Business insurance premiums',
    glAccount: '5-700',
    taxDeductible: true,
    requiresReceipt: true,
    subcategories: ['General Liability', 'Workers Compensation', 'Professional Liability', 'Property Insurance']
  },
  {
    name: 'Meals & Entertainment',
    description: 'Business meals and entertainment',
    glAccount: '5-800',
    taxDeductible: true,
    requiresReceipt: true,
    subcategories: ['Client Meals', 'Team Meals', 'Business Entertainment', 'Travel Meals']
  }
];

const Accounting: React.FC = () => {
  const { user, tenantId } = useFirebaseAuth();
  const userId = user?.uid;

  // State
  const [activeTab, setActiveTab] = useState('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [invoiceFilters, setInvoiceFilters] = useState({
    search: '',
    status: 'all',
    dateRange: 'all'
  });
  const [paymentFilters, setPaymentFilters] = useState({
    search: '',
    method: 'all',
    dateRange: 'all'
  });
  const [expenseFilters, setExpenseFilters] = useState({
    search: '',
    category: 'all',
    status: 'all',
    dateRange: 'all'
  });

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTakePaymentModal, setShowTakePaymentModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);

  // Load data
  useEffect(() => {
    if (!db || !userId || !tenantId) return;

    const unsubscribes: (() => void)[] = [];

    // Load invoices
    const invoicesQuery = query(
      collection(db, 'tenants', tenantId, 'invoices'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    unsubscribes.push(onSnapshot(invoicesQuery, (snapshot) => {
      const invoicesData: Invoice[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const payments = data.payments || [];
        const amountPaid = payments.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
        
        invoicesData.push({
          id: doc.id,
          invoiceNumber: data.invoiceNumber || `INV-${doc.id.slice(-6)}`,
          customerName: data.customerName || 'Unknown Customer',
          jobId: data.jobId,
          jobNumber: data.jobNumber,
          total: data.total || 0,
          subtotal: data.subtotal || 0,
          taxAmount: data.taxAmount || 0,
          amountPaid: amountPaid,
          status: data.status || 'draft',
          createdAt: data.createdAt || new Date().toISOString(),
          dueDate: data.dueDate || new Date().toISOString(),
          paidDate: data.paidDate,
          businessUnitId: data.businessUnitId,
          businessUnit: data.businessUnit,
          services: data.services || [],
          materials: data.materials || [],
          payments: payments
        });
      });
      setInvoices(invoicesData);
    }));

    // Load payments
    const paymentsQuery = query(
      collection(db, 'tenants', tenantId, 'payments'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    unsubscribes.push(onSnapshot(paymentsQuery, (snapshot) => {
      const paymentsData: Payment[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        paymentsData.push({
          id: doc.id,
          invoiceId: data.invoiceId,
          customerName: data.customerName || 'Unknown Customer',
          amount: data.amount || 0,
          date: data.date || new Date().toISOString().split('T')[0],
          method: data.method || 'cash',
          processor: data.processor,
          memo: data.memo,
          type: data.type || 'invoice_payment',
          status: data.status || 'completed',
          createdAt: data.createdAt || new Date().toISOString()
        });
      });
      setPayments(paymentsData);
    }));

    // Load expenses
    const expensesQuery = query(
      collection(db, 'tenants', tenantId, 'expenses'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    unsubscribes.push(onSnapshot(expensesQuery, (snapshot) => {
      const expensesData: Expense[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        expensesData.push({
          id: doc.id,
          description: data.description || '',
          amount: data.amount || 0,
          date: data.date || new Date().toISOString().split('T')[0],
          category: data.category || 'Other',
          subcategory: data.subcategory,
          vendor: data.vendor,
          jobId: data.jobId,
          jobNumber: data.jobNumber,
          businessUnitId: data.businessUnitId,
          businessUnit: data.businessUnit,
          paymentMethod: data.paymentMethod || 'cash',
          receiptUrl: data.receiptUrl,
          taxDeductible: data.taxDeductible || false,
          glAccount: data.glAccount,
          status: data.status || 'pending',
          createdBy: data.createdBy || userId,
          createdAt: data.createdAt || new Date().toISOString(),
          approvedBy: data.approvedBy,
          approvedAt: data.approvedAt
        });
      });
      setExpenses(expensesData);
    }));

    // Load expense categories
    const categoriesQuery = query(
      collection(db, 'tenants', tenantId, 'expenseCategories'),
      where('userId', '==', userId)
    );
    
    unsubscribes.push(onSnapshot(categoriesQuery, (snapshot) => {
      const categoriesData: ExpenseCategory[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        categoriesData.push({
          id: doc.id,
          name: data.name || '',
          description: data.description,
          glAccount: data.glAccount,
          taxDeductible: data.taxDeductible || false,
          requiresReceipt: data.requiresReceipt || false,
          subcategories: data.subcategories || []
        });
      });
      setExpenseCategories(categoriesData);
    }));

    setIsLoading(false);

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [db, userId, tenantId]);

  // Initialize default expense categories if none exist
  useEffect(() => {
    if (!db || !userId || !tenantId || expenseCategories.length > 0) return;

    const initializeCategories = async () => {
      try {
        const batch = writeBatch(db);
        
        DEFAULT_EXPENSE_CATEGORIES.forEach((category) => {
          const docRef = doc(collection(db, 'tenants', tenantId, 'expenseCategories'));
          batch.set(docRef, {
            ...category,
            userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });

        await batch.commit();
      } catch (error) {
        console.error('Error initializing expense categories:', error);
      }
    };

    // Only initialize if we've loaded and there are no categories
    if (!isLoading && expenseCategories.length === 0) {
      initializeCategories();
    }
  }, [db, userId, tenantId, expenseCategories.length, isLoading]);

  // Calculate financial metrics
  const calculateMetrics = useCallback(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Filter current month data
    const currentMonthInvoices = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.createdAt);
      return invoiceDate.getMonth() === currentMonth && invoiceDate.getFullYear() === currentYear;
    });

    const currentMonthPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
    });

    const currentMonthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
    });

    // Calculate totals
    const totalRevenue = currentMonthInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const paidInvoices = currentMonthInvoices.filter(invoice => invoice.status === 'paid');
    const totalPaid = paidInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const overdueInvoices = invoices.filter(invoice => {
      const dueDate = new Date(invoice.dueDate);
      return invoice.status !== 'paid' && dueDate < new Date();
    });
    const totalOverdue = overdueInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const pendingInvoices = invoices.filter(invoice => invoice.status === 'sent');
    const totalPending = pendingInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const totalExpenses = currentMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    return {
      totalRevenue,
      totalPaid,
      totalOverdue,
      totalPending,
      totalExpenses,
      netIncome: totalPaid - totalExpenses,
      overdueCount: overdueInvoices.length,
      pendingCount: pendingInvoices.length
    };
  }, [invoices, payments, expenses]);

  const metrics = calculateMetrics();

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Filter functions
  const getFilteredInvoices = () => {
    return invoices.filter(invoice => {
      const matchesSearch = invoice.customerName.toLowerCase().includes(invoiceFilters.search.toLowerCase()) ||
                           invoice.invoiceNumber.toLowerCase().includes(invoiceFilters.search.toLowerCase()) ||
                           (invoice.jobNumber && invoice.jobNumber.toLowerCase().includes(invoiceFilters.search.toLowerCase()));
      
      const matchesStatus = invoiceFilters.status === 'all' || invoice.status === invoiceFilters.status;
      
      let matchesDate = true;
      if (invoiceFilters.dateRange !== 'all') {
        const invoiceDate = new Date(invoice.createdAt);
        const now = new Date();
        
        switch (invoiceFilters.dateRange) {
          case 'last_30_days':
            matchesDate = invoiceDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'this_month':
            matchesDate = invoiceDate.getMonth() === now.getMonth() && invoiceDate.getFullYear() === now.getFullYear();
            break;
          case 'last_month':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            matchesDate = invoiceDate.getMonth() === lastMonth.getMonth() && invoiceDate.getFullYear() === lastMonth.getFullYear();
            break;
          case 'this_year':
            matchesDate = invoiceDate.getFullYear() === now.getFullYear();
            break;
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  };

  const getFilteredPayments = () => {
    return payments.filter(payment => {
      const matchesSearch = payment.customerName.toLowerCase().includes(paymentFilters.search.toLowerCase()) ||
                           (payment.invoiceId && payment.invoiceId.toLowerCase().includes(paymentFilters.search.toLowerCase()));
      
      const matchesMethod = paymentFilters.method === 'all' || payment.method === paymentFilters.method;
      
      let matchesDate = true;
      if (paymentFilters.dateRange !== 'all') {
        const paymentDate = new Date(payment.date);
        const now = new Date();
        
        switch (paymentFilters.dateRange) {
          case 'last_30_days':
            matchesDate = paymentDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'this_month':
            matchesDate = paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
            break;
          case 'last_month':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            matchesDate = paymentDate.getMonth() === lastMonth.getMonth() && paymentDate.getFullYear() === lastMonth.getFullYear();
            break;
          case 'this_year':
            matchesDate = paymentDate.getFullYear() === now.getFullYear();
            break;
        }
      }
      
      return matchesSearch && matchesMethod && matchesDate;
    });
  };

  const getFilteredExpenses = () => {
    return expenses.filter(expense => {
      const matchesSearch = expense.description.toLowerCase().includes(expenseFilters.search.toLowerCase()) ||
                           (expense.vendor && expense.vendor.toLowerCase().includes(expenseFilters.search.toLowerCase())) ||
                           (expense.jobNumber && expense.jobNumber.toLowerCase().includes(expenseFilters.search.toLowerCase()));
      
      const matchesCategory = expenseFilters.category === 'all' || expense.category === expenseFilters.category;
      const matchesStatus = expenseFilters.status === 'all' || expense.status === expenseFilters.status;
      
      let matchesDate = true;
      if (expenseFilters.dateRange !== 'all') {
        const expenseDate = new Date(expense.date);
        const now = new Date();
        
        switch (expenseFilters.dateRange) {
          case 'last_30_days':
            matchesDate = expenseDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'this_month':
            matchesDate = expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
            break;
          case 'last_month':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            matchesDate = expenseDate.getMonth() === lastMonth.getMonth() && expenseDate.getFullYear() === lastMonth.getFullYear();
            break;
          case 'this_year':
            matchesDate = expenseDate.getFullYear() === now.getFullYear();
            break;
        }
      }
      
      return matchesSearch && matchesCategory && matchesStatus && matchesDate;
    });
  };

  // CRUD operations
  const handleAddExpense = async (expenseData: Omit<Expense, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!db || !userId || !tenantId) return;

    try {
      await addDoc(collection(db, 'tenants', tenantId, 'expenses'), {
        ...expenseData,
        userId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setShowExpenseModal(false);
      setEditingExpense(null);
    } catch (error) {
      console.error('Error adding expense:', error);
      setError('Failed to add expense');
    }
  };

  const handleUpdateExpense = async (expenseId: string, expenseData: Partial<Expense>) => {
    if (!db || !tenantId) return;

    try {
      await updateDoc(doc(db, 'tenants', tenantId, 'expenses', expenseId), {
        ...expenseData,
        updatedAt: new Date().toISOString()
      });
      setEditingExpense(null);
    } catch (error) {
      console.error('Error updating expense:', error);
      setError('Failed to update expense');
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!db || !tenantId) return;
    
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      await deleteDoc(doc(db, 'tenants', tenantId, 'expenses', expenseId));
    } catch (error) {
      console.error('Error deleting expense:', error);
      setError('Failed to delete expense');
    }
  };

  const handleAddPayment = async (paymentData: Omit<Payment, 'id' | 'createdAt'>) => {
    if (!db || !userId || !tenantId) return;

    try {
      await addDoc(collection(db, 'tenants', tenantId, 'payments'), {
        ...paymentData,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setShowPaymentModal(false);
    } catch (error) {
      console.error('Error adding payment:', error);
      setError('Failed to add payment');
    }
  };

  // TakePaymentModal handlers
  const handleTakePayment = (invoice?: Invoice) => {
    setSelectedInvoiceForPayment(invoice || null);
    setShowTakePaymentModal(true);
  };

  const handlePaymentComplete = (paymentData: any) => {
    console.log('Payment completed:', paymentData);
    // Refresh data is handled by real-time listeners
    setShowTakePaymentModal(false);
    setSelectedInvoiceForPayment(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600 dark:text-gray-300">Loading accounting data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="mt-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Accounting</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage invoices, payments, expenses, and financial reports</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
          <button 
            onClick={() => setShowReportModal(true)}
            className="px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
          >
            <Download size={16} className="inline-block mr-2" />
            Export Reports
          </button>
          <button 
            onClick={() => handleTakePayment()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <CreditCard size={16} className="inline-block mr-2" />
            Take Payment
          </button>
          <button 
            onClick={() => setShowPaymentModal(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            <Plus size={16} className="inline-block mr-2" />
            Record Payment
          </button>
          <button 
            onClick={() => setShowExpenseModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} className="inline-block mr-2" />
            Add Expense
          </button>
        </div>
      </div>
      
      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <DollarSign size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">This Month</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">TOTAL REVENUE</h3>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {formatCurrency(metrics.totalRevenue)}
            </span>
            <span className="ml-2 text-xs font-medium text-green-600 dark:text-green-400 flex items-center">
              <ArrowUpRight size={12} className="mr-0.5" />
              12%
            </span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
              <CheckCircle size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">This Month</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">PAID INVOICES</h3>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {formatCurrency(metrics.totalPaid)}
            </span>
            <span className="ml-2 text-xs font-medium text-green-600 dark:text-green-400 flex items-center">
              <ArrowUpRight size={12} className="mr-0.5" />
              8%
            </span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
              <Clock size={24} className="text-red-600 dark:text-red-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Overdue</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">OVERDUE ({metrics.overdueCount})</h3>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {formatCurrency(metrics.totalOverdue)}
            </span>
            {metrics.totalOverdue > 0 && (
              <span className="ml-2 text-xs font-medium text-red-600 dark:text-red-400 flex items-center">
                <ArrowDownRight size={12} className="mr-0.5" />
                Alert
              </span>
            )}
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
              <FileText size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Net Income</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">THIS MONTH</h3>
          <div className="flex items-baseline">
            <span className={`text-2xl font-bold ${metrics.netIncome >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(metrics.netIncome)}
            </span>
            <span className={`ml-2 text-xs font-medium flex items-center ${metrics.netIncome >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {metrics.netIncome >= 0 ? <TrendingUp size={12} className="mr-0.5" /> : <TrendingDown size={12} className="mr-0.5" />}
              {metrics.netIncome >= 0 ? 'Profit' : 'Loss'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'invoices'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            Invoices ({getFilteredInvoices().length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'payments'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            Payments ({getFilteredPayments().length})
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'expenses'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            Expenses ({getFilteredExpenses().length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'reports'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            Reports
          </button>
        </nav>
      </div>
      
      {/* Tab Content */}
      <div>
        {activeTab === 'invoices' && (
          <div>
            {/* Invoices filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative flex-grow max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Search invoices..."
                  value={invoiceFilters.search}
                  onChange={(e) => setInvoiceFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                />
              </div>
              
              <select 
                value={invoiceFilters.status}
                onChange={(e) => setInvoiceFilters(prev => ({ ...prev, status: e.target.value }))}
                className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
              
              <select 
                value={invoiceFilters.dateRange}
                onChange={(e) => setInvoiceFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              >
                <option value="all">All Time</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_year">This Year</option>
              </select>
            </div>
            
            {/* Invoices table */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-700/50">
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Invoice #
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Customer
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Job
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Amount
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {getFilteredInvoices().map(invoice => (
                      <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                          {invoice.customerName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                          <div className="flex items-center">
                            <span className="text-gray-800 dark:text-gray-200">{invoice.jobNumber || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">
                          {formatCurrency(invoice.total)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {formatDate(invoice.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {formatDate(invoice.dueDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                              <button 
                                onClick={() => handleTakePayment(invoice)}
                                className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 transition-colors"
                              >
                                Take Payment
                              </button>
                            )}
                            <button 
                              onClick={() => window.open(`/invoice/${invoice.id}`, '_blank')}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {getFilteredInvoices().length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                          No invoices found matching your criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'payments' && (
          <div>
            {/* Payments filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative flex-grow max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Search payments..."
                  value={paymentFilters.search}
                  onChange={(e) => setPaymentFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                />
              </div>
              
              <select 
                value={paymentFilters.method}
                onChange={(e) => setPaymentFilters(prev => ({ ...prev, method: e.target.value }))}
                className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              >
                <option value="all">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="credit_card">Credit Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
              
              <select 
                value={paymentFilters.dateRange}
                onChange={(e) => setPaymentFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              >
                <option value="all">All Time</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_year">This Year</option>
              </select>
            </div>
            
            {/* Payments table */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-700/50">
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Payment #
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Customer
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Invoice
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Amount
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Method
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {getFilteredPayments().map(payment => (
                      <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                          PMT-{payment.id.slice(-6)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                          {payment.customerName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400">
                          {payment.invoiceId ? `INV-${payment.invoiceId.slice(-6)}` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {formatDate(payment.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          <div className="flex items-center">
                            {payment.method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            {payment.processor && (
                              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">via {payment.processor}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${getStatusColor(payment.status)}`}>
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors">
                              View
                            </button>
                            <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                              Receipt
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {getFilteredPayments().length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                          No payments found matching your criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'expenses' && (
          <div>
            {/* Expenses filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative flex-grow max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Search expenses..."
                  value={expenseFilters.search}
                  onChange={(e) => setExpenseFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                />
              </div>
              
              <select 
                value={expenseFilters.category}
                onChange={(e) => setExpenseFilters(prev => ({ ...prev, category: e.target.value }))}
                className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              >
                <option value="all">All Categories</option>
                {expenseCategories.map(category => (
                  <option key={category.id} value={category.name}>{category.name}</option>
                ))}
              </select>
              
              <select 
                value={expenseFilters.status}
                onChange={(e) => setExpenseFilters(prev => ({ ...prev, status: e.target.value }))}
                className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
              
              <select 
                value={expenseFilters.dateRange}
                onChange={(e) => setExpenseFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              >
                <option value="all">All Time</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_year">This Year</option>
              </select>
            </div>
            
            {/* Expenses table */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-700/50">
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Category
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Amount
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Vendor
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Job
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {getFilteredExpenses().map(expense => (
                      <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                          <div className="flex items-center">
                            <span>{expense.description}</span>
                            {expense.taxDeductible && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Tax Deductible
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          <div>
                            <div className="font-medium">{expense.category}</div>
                            {expense.subcategory && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">{expense.subcategory}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {formatDate(expense.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {expense.vendor || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {expense.jobNumber || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${getStatusColor(expense.status)}`}>
                            {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button 
                              onClick={() => setEditingExpense(expense)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors"
                            >
                              <Edit size={16} />
                            </button>
                            {expense.receiptUrl && (
                              <button className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 transition-colors">
                                <Receipt size={16} />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {getFilteredExpenses().length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                          No expenses found matching your criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'reports' && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">Financial Reports</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Generate comprehensive financial reports to analyze your business performance and make informed decisions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Profit & Loss Report */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow">
                <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/50 inline-block mb-4">
                  <TrendingUp size={24} className="text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Profit & Loss Statement</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Comprehensive income statement showing revenue, expenses, and net profit over a specified period.
                </p>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">This Month Revenue:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(metrics.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">This Month Expenses:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(metrics.totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200 dark:border-slate-600">
                    <span className="text-gray-800 dark:text-gray-200">Net Income:</span>
                    <span className={metrics.netIncome >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {formatCurrency(metrics.netIncome)}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedReport('profit_loss');
                    setShowReportModal(true);
                  }}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Generate P&L Report
                </button>
              </div>

              {/* Balance Sheet Report */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/50 inline-block mb-4">
                  <BarChart3 size={24} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Balance Sheet</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Snapshot of your company's financial position showing assets, liabilities, and equity.
                </p>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Total Receivables:</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      {formatCurrency(metrics.totalPending + metrics.totalOverdue)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Cash (Paid):</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(metrics.totalPaid)}</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedReport('balance_sheet');
                    setShowReportModal(true);
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Generate Balance Sheet
                </button>
              </div>

              {/* Accounts Receivable Aging */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow">
                <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/50 inline-block mb-4">
                  <Clock size={24} className="text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">A/R Aging Summary</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Track outstanding invoices by age to manage collections and cash flow effectively.
                </p>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Current (0-30 days):</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(metrics.totalPending)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Overdue (30+ days):</span>
                    <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(metrics.totalOverdue)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200 dark:border-slate-600">
                    <span className="text-gray-800 dark:text-gray-200">Total Outstanding:</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      {formatCurrency(metrics.totalPending + metrics.totalOverdue)}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedReport('ar_aging');
                    setShowReportModal(true);
                  }}
                  className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                >
                  Generate A/R Aging
                </button>
              </div>

              {/* Cash Flow Statement */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow">
                <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/50 inline-block mb-4">
                  <DollarSign size={24} className="text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Cash Flow Statement</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Track cash inflows and outflows from operating, investing, and financing activities.
                </p>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Cash Inflows:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(metrics.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Cash Outflows:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(metrics.totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200 dark:border-slate-600">
                    <span className="text-gray-800 dark:text-gray-200">Net Cash Flow:</span>
                    <span className={metrics.netIncome >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {formatCurrency(metrics.totalPaid - metrics.totalExpenses)}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedReport('cash_flow');
                    setShowReportModal(true);
                  }}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  Generate Cash Flow
                </button>
              </div>

              {/* Revenue by Business Unit */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow">
                <div className="p-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 inline-block mb-4">
                  <Building size={24} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Business Unit Analysis</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Compare performance across different business units and service divisions.
                </p>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Active Units:</span>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      {new Set(invoices.filter(inv => inv.businessUnit).map(inv => inv.businessUnit)).size || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Total Revenue:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(metrics.totalRevenue)}</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedReport('business_unit');
                    setShowReportModal(true);
                  }}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Generate Unit Analysis
                </button>
              </div>

              {/* Tax Summary Report */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-6 hover:shadow-md transition-shadow">
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/50 inline-block mb-4">
                  <FileText size={24} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Tax Preparation Report</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Generate tax-related summaries including deductible expenses and revenue totals.
                </p>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Deductible Expenses:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(expenses.filter(exp => exp.taxDeductible).reduce((sum, exp) => sum + exp.amount, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Taxable Revenue:</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(metrics.totalRevenue)}</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedReport('tax_summary');
                    setShowReportModal(true);
                  }}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Generate Tax Report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals would go here - ExpenseModal, PaymentModal, ReportModal */}
      {/* For now, we'll add placeholder modals */}
      
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                {editingExpense ? 'Edit Expense' : 'Add New Expense'}
              </h3>
              <button 
                onClick={() => {
                  setShowExpenseModal(false);
                  setEditingExpense(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Expense management modal would be implemented here with full form functionality.
            </p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => {
                  setShowExpenseModal(false);
                  setEditingExpense(null);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {editingExpense ? 'Update' : 'Add'} Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Record Payment</h3>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Payment recording modal would be implemented here with full form functionality.
            </p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                {selectedReport === 'profit_loss' && 'Profit & Loss Report'}
                {selectedReport === 'balance_sheet' && 'Balance Sheet Report'}
                {selectedReport === 'ar_aging' && 'Accounts Receivable Aging Report'}
                {selectedReport === 'cash_flow' && 'Cash Flow Statement'}
                {selectedReport === 'business_unit' && 'Business Unit Analysis'}
                {selectedReport === 'tax_summary' && 'Tax Preparation Report'}
              </h3>
              <button 
                onClick={() => {
                  setShowReportModal(false);
                  setSelectedReport(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Detailed {selectedReport?.replace('_', ' ')} report would be generated here with:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
                <li>Interactive charts and graphs</li>
                <li>Detailed financial breakdowns</li>
                <li>Export to PDF/Excel functionality</li>
                <li>Date range filtering</li>
                <li>Business unit comparisons</li>
                <li>Year-over-year analysis</li>
              </ul>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button 
                onClick={() => {
                  setShowReportModal(false);
                  setSelectedReport(null);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Close
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Download size={16} className="mr-2 inline" />
                Export Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TakePaymentModal */}
      <TakePaymentModal
        isOpen={showTakePaymentModal}
        onClose={() => {
          setShowTakePaymentModal(false);
          setSelectedInvoiceForPayment(null);
        }}
        invoice={selectedInvoiceForPayment}
        onPaymentComplete={handlePaymentComplete}
      />
    </div>
  );
};

export default Accounting;
