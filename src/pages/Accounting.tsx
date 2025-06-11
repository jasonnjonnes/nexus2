import React, { useState } from 'react';
import { 
  DollarSign, 
  FileText, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  CheckCircle, 
  XCircle,
  Filter,
  Download,
  Plus,
  Search,
  User,
  Calendar,
  Briefcase
} from 'lucide-react';

// Sample invoices data
const invoices = [
  {
    id: "INV-1001",
    customer: "Sarah Johnson",
    jobId: "JOB-12345",
    amount: 750.00,
    date: "2025-06-01",
    dueDate: "2025-06-15",
    status: "paid", // draft, sent, paid, overdue
    jobType: "AC Repair"
  },
  {
    id: "INV-1002",
    customer: "Michael Robinson",
    jobId: "JOB-12346",
    amount: 1250.00,
    date: "2025-06-02",
    dueDate: "2025-06-16",
    status: "sent",
    jobType: "Plumbing Installation"
  },
  {
    id: "INV-1003",
    customer: "Jennifer Garcia",
    jobId: "JOB-12347",
    amount: 89.00,
    date: "2025-06-03",
    dueDate: "2025-06-17",
    status: "draft",
    jobType: "HVAC Maintenance"
  },
  {
    id: "INV-1004",
    customer: "David Williams",
    jobId: "JOB-12348",
    amount: 475.50,
    date: "2025-05-15",
    dueDate: "2025-05-29",
    status: "overdue",
    jobType: "Water Heater Repair"
  },
  {
    id: "INV-1005",
    customer: "Robert Smith",
    jobId: "JOB-12349",
    amount: 2750.00,
    date: "2025-06-04",
    dueDate: "2025-06-18",
    status: "sent",
    jobType: "Kitchen Remodel"
  }
];

// Sample payments data
const payments = [
  {
    id: "PMT-2001",
    customer: "Sarah Johnson",
    invoiceId: "INV-1001",
    amount: 750.00,
    date: "2025-06-10",
    method: "Credit Card",
    processor: "Stripe"
  },
  {
    id: "PMT-2002",
    customer: "Thomas Edwards",
    invoiceId: "INV-996",
    amount: 325.00,
    date: "2025-06-05",
    method: "Bank Transfer",
    processor: "ACH"
  },
  {
    id: "PMT-2003",
    customer: "Elizabeth Wilson",
    invoiceId: "INV-990",
    amount: 1100.00,
    date: "2025-06-02",
    method: "Check",
    processor: "Manual"
  }
];

const Accounting: React.FC = () => {
  const [activeTab, setActiveTab] = useState('invoices'); // invoices, payments, expenses, reports
  
  // Updated to support dark mode
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          {/* Updated text colors */}
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Accounting</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage invoices, payments, and financial reports</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
          {/* Updated button styles */}
          <button className="px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors">
            <Download size={16} className="inline-block mr-2" />
            Export
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={16} className="inline-block mr-2" />
            New Invoice
          </button>
        </div>
      </div>
      
      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Updated card styles */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <DollarSign size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">This Month</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">TOTAL REVENUE</h3>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">$5,314.50</span>
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
            <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">$3,750.00</span>
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
            <span className="text-sm text-gray-500 dark:text-gray-400">This Month</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">OVERDUE</h3>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">$475.50</span>
            <span className="ml-2 text-xs font-medium text-red-600 dark:text-red-400 flex items-center">
              <ArrowDownRight size={12} className="mr-0.5" />
              5%
            </span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
              <FileText size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">This Month</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">PENDING</h3>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">$4,000.00</span>
            <span className="ml-2 text-xs font-medium text-green-600 dark:text-green-400 flex items-center">
              <ArrowUpRight size={12} className="mr-0.5" />
              15%
            </span>
          </div>
        </div>
      </div>
      
      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <nav className="-mb-px flex space-x-8">
          {/* Updated tab styles */}
          <button
            onClick={() => setActiveTab('invoices')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'invoices'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            Invoices
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'payments'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            Payments
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'expenses'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            Expenses
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
                {/* Updated input styles */}
                <input 
                  type="text" 
                  placeholder="Search invoices..."
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                />
              </div>
              
              {/* Updated select styles */}
              <select className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200">
                <option>All Statuses</option>
                <option>Draft</option>
                <option>Sent</option>
                <option>Paid</option>
                <option>Overdue</option>
              </select>
              
              <select className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200">
                <option>All Time</option>
                <option>Last 30 Days</option>
                <option>This Month</option>
                <option>Last Month</option>
                <option>This Year</option>
              </select>
              
              <button className="flex items-center px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-800 dark:text-gray-200">
                <Filter size={18} className="mr-2 text-gray-600 dark:text-gray-400" />
                More Filters
              </button>
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
                    {invoices.map(invoice => (
                      <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                          {invoice.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                          {invoice.customer}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                          <div className="flex items-center">
                            <span className="text-gray-800 dark:text-gray-200">{invoice.jobId}</span>
                            <span className="ml-2 text-gray-500 dark:text-gray-400">({invoice.jobType})</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">
                          ${invoice.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {invoice.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {invoice.dueDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors">
                              View
                            </button>
                            <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                />
              </div>
              
              <select className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200">
                <option>All Payment Methods</option>
                <option>Credit Card</option>
                <option>Bank Transfer</option>
                <option>Cash</option>
                <option>Check</option>
              </select>
              
              <select className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200">
                <option>All Time</option>
                <option>Last 30 Days</option>
                <option>This Month</option>
                <option>Last Month</option>
                <option>This Year</option>
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
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {payments.map(payment => (
                      <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                          {payment.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                          {payment.customer}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400">
                          {payment.invoiceId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">
                          ${payment.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {payment.date}
                        </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          <div className="flex items-center">
                            {payment.method}
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">via {payment.processor}</span>
                          </div>
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
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'expenses' && (
          <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
            <FileText size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h2 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-2">Expense Tracking</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Track technician expenses, materials, and job-specific costs.
            </p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Set Up Expense Tracking
            </button>
          </div>
        )}
        
        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 inline-block mb-3">
                <DollarSign size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">Revenue Report</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Track revenue by job type, technician, and business unit
              </p>
              <button className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
                Run Report →
              </button>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50 inline-block mb-3">
                <User size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">Technician Performance</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Analyze technician productivity and revenue generation
              </p>
              <button className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
                Run Report →
              </button>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 inline-block mb-3">
                <Calendar size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">Job Profitability</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Analyze job costs and profitability by type and customer
              </p>
              <button className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
                Run Report →
              </button>
            </div>
            
             <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 inline-block mb-3">
                <FileText size={20} className="text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">Accounts Receivable</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Track outstanding invoices and aging report
              </p>
              <button className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
                Run Report →
              </button>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50 inline-block mb-3">
                <Briefcase size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">Business Unit Analysis</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Compare performance across business units
              </p>
              <button className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
                Run Report →
              </button>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 inline-block mb-3">
                <Download size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">Tax Preparation</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Generate tax-related reports and summaries
              </p>
              <button className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
                Run Report →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Accounting;
