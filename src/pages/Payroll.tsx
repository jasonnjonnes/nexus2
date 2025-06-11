import React, { useState } from 'react';
import { 
  DollarSign, 
  Clock, 
  Calendar, 
  Download, 
  Filter, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  Plus,
  ArrowUpRight, 
  ArrowDownRight,
  FileText
} from 'lucide-react';

// Sample technician payroll data
const technicianPayroll = [
  {
    id: 1,
    name: "Jeremy Skinner",
    hourlyRate: 28.50,
    hoursWorked: 40,
    overtime: 5,
    commission: 450.00,
    bonus: 100.00,
    deductions: 125.00,
    totalPay: 1765.00,
    status: "pending" // pending, approved, processed
  },
  {
    id: 2,
    name: "Leah Proctor",
    hourlyRate: 32.00,
    hoursWorked: 38,
    overtime: 0,
    commission: 750.00,
    bonus: 0.00,
    deductions: 150.00,
    totalPay: 1816.00,
    status: "approved"
  },
  {
    id: 3,
    name: "Jason Jones",
    hourlyRate: 30.00,
    hoursWorked: 40,
    overtime: 8,
    commission: 320.00,
    bonus: 200.00,
    deductions: 140.00,
    totalPay: 1940.00,
    status: "processed"
  },
  {
    id: 4,
    name: "Faisal Malik",
    hourlyRate: 29.50,
    hoursWorked: 36,
    overtime: 0,
    commission: 510.00,
    bonus: 0.00,
    deductions: 120.00,
    totalPay: 1452.00,
    status: "pending"
  }
];

// Sample payroll periods
const payrollPeriods = [
  { id: 1, name: "June 1-15, 2025", status: "current" },
  { id: 2, name: "May 16-31, 2025", status: "completed" },
  { id: 3, name: "May 1-15, 2025", status: "completed" },
  { id: 4, name: "April 16-30, 2025", status: "completed" }
];

const Payroll: React.FC = () => {
  const [activeTab, setActiveTab] = useState('current'); // current, history, settings
  const [selectedPeriod, setSelectedPeriod] = useState(payrollPeriods[0].id);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'processed': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} />;
      case 'approved': return <CheckCircle size={16} />;
      case 'processed': return <CheckCircle size={16} />;
      case 'error': return <AlertCircle size={16} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Payroll</h1>
          <p className="text-gray-600 mt-1">Manage technician compensation and payroll processing</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex items-center space-x-3">
          <select 
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {payrollPeriods.map(period => (
              <option key={period.id} value={period.id}>
                {period.name} {period.status === 'current' ? '(Current)' : ''}
              </option>
            ))}
          </select>
          
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={16} className="inline-block mr-2" />
            Add Pay Item
          </button>
        </div>
      </div>
      
      {/* Payroll summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <DollarSign size={24} className="text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Current Period</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">TOTAL PAYROLL</h3>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-800">$6,973.00</span>
            <span className="ml-2 text-xs font-medium text-green-600 flex items-center">
              <ArrowUpRight size={12} className="mr-0.5" />
              5%
            </span>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-green-100">
              <Clock size={24} className="text-green-600" />
            </div>
            <span className="text-sm text-gray-500">Current Period</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">TOTAL HOURS</h3>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-800">154 hrs</span>
            <span className="ml-2 text-xs font-medium text-red-600 flex items-center">
              <ArrowDownRight size={12} className="mr-0.5" />
              2%
            </span>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-purple-100">
              <Calendar size={24} className="text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">Current Period</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">PAY DATE</h3>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-800">Jun 20, 2025</span>
          </div>
        </div>
      </div>
      
      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('current')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'current'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } transition-colors`}
          >
            Current Payroll
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } transition-colors`}
          >
            Payroll History
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } transition-colors`}
          >
            Payroll Settings
          </button>
        </nav>
      </div>
      
      {/* Tab Content */}
      <div>
        {activeTab === 'current' && (
          <div>
            {/* Action buttons */}
            <div className="flex justify-end mb-4 space-x-3">
              <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                <Download size={16} className="inline-block mr-2" />
                Export
              </button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                <CheckCircle size={16} className="inline-block mr-2" />
                Approve All
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                <DollarSign size={16} className="inline-block mr-2" />
                Process Payroll
              </button>
            </div>
            
            {/* Payroll table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Technician
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hourly Rate
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Regular Hours
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Overtime
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Commission
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bonus
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Deductions
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {technicianPayroll.map(tech => (
                      <tr key={tech.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                              {tech.name.split(' ')[0][0]}{tech.name.split(' ')[1][0]}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{tech.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          ${tech.hourlyRate.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {tech.hoursWorked}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {tech.overtime}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          ${tech.commission.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          ${tech.bonus.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          ${tech.deductions.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ${tech.totalPay.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tech.status)}`}>
                            {getStatusIcon(tech.status)}
                            <span className="ml-1 capitalize">{tech.status}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900 transition-colors">
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'history' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-800">Payroll History</h3>
                  <div className="flex space-x-2">
                    <select className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option>Last 3 Months</option>
                      <option>Last 6 Months</option>
                      <option>Year to Date</option>
                      <option>Last Year</option>
                    </select>
                    <button className="p-1.5 rounded hover:bg-gray-100 transition-colors">
                      <Download size={18} className="text-gray-600" />
                    </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Period
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pay Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Amount
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Technicians Paid
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">May 16-31, 2025</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">Jun 5, 2025</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">$6,845.00</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">4</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900">View</button>
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">May 1-15, 2025</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">May 20, 2025</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">$7,230.00</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">4</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900">View</button>
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Apr 16-30, 2025</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">May 5, 2025</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">$6,950.00</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">4</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900">View</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Payroll Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">YTD Total Payroll</span>
                    <span className="font-medium text-gray-800">$78,450.00</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">YTD Regular Hours</span>
                    <span className="font-medium text-gray-800">1,640 hrs</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">YTD Overtime Hours</span>
                    <span className="font-medium text-gray-800">120 hrs</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">YTD Commissions</span>
                    <span className="font-medium text-gray-800">$12,500.00</span>
                  </div>
                </div>
                
                <div className="mt-4">
                  <button className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">
                    View Annual Report
                  </button>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Payroll Documents</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className="p-2 rounded bg-blue-100 mr-3">
                      <FileText size={16} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">Payroll Tax Reports</p>
                      <p className="text-xs text-gray-600">Last updated: May 31, 2025</p>
                    </div>
                    <button className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-600">
                      <Download size={16} />
                    </button>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="p-2 rounded bg-green-100 mr-3">
                      <FileText size={16} className="text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">Employee Earnings Report</p>
                      <p className="text-xs text-gray-600">Last updated: Jun 5, 2025</p>
                    </div>
                    <button className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-600">
                      <Download size={16} />
                    </button>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="p-2 rounded bg-amber-100 mr-3">
                      <FileText size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">Commission Statements</p>
                      <p className="text-xs text-gray-600">Last updated: Jun 5, 2025</p>
                    </div>
                    <button className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-600">
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Payroll Schedule</h3>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pay Period</label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center">
                      <input 
                        type="radio" 
                        id="weekly" 
                        name="payPeriod"
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="weekly" className="ml-2 block text-sm text-gray-700">Weekly</label>
                    </div>
                    <div className="flex items-center">
                      <input 
                        type="radio" 
                        id="biweekly" 
                        name="payPeriod"
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="biweekly" className="ml-2 block text-sm text-gray-700">Bi-weekly</label>
                    </div>
                    <div className="flex items-center">
                      <input 
                        type="radio" 
                        id="semimonthly" 
                        name="payPeriod" 
                        checked
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="semimonthly" className="ml-2 block text-sm text-gray-700">Semi-monthly (1st and 15th)</label>
                    </div>
                    <div className="flex items-center">
                      <input 
                        type="radio" 
                        id="monthly" 
                        name="payPeriod"
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="monthly" className="ml-2 block text-sm text-gray-700">Monthly</label>
                    </div>
                  </div>
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pay Delay</label>
                  <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                    <option>Same day</option>
                    <option>Next business day</option>
                    <option selected>5 days after period end</option>
                    <option>10 days after period end</option>
                    <option>Custom...</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500">
                    Pay delay determines how many days after the pay period ends before payment is processed.
                  </p>
                </div>
                
                <h3 className="text-lg font-medium text-gray-800 mb-4 mt-8">Overtime Rules</h3>
                <div className="mb-6">
                  <div className="flex items-center mb-4">
                    <input 
                      id="enableOvertime"
                      type="checkbox"
                      checked
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="enableOvertime" className="ml-2 block text-sm text-gray-700">
                      Enable overtime calculation
                    </label>
                  </div>
                  
                  <div className="ml-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Standard Overtime (1.5x)</label>
                        <div className="flex items-center">
                          <span className="text-gray-500 mr-2">After</span>
                          <input 
                            type="number"
                            value="40"
                            min="0"
                            max="168"
                            className="block w-16 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                          <span className="text-gray-500 ml-2">hours per week</span>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Double Time (2x)</label>
                        <div className="flex items-center">
                          <span className="text-gray-500 mr-2">After</span>
                          <input 
                            type="number"
                            value="60"
                            min="0"
                            max="168"
                            className="block w-16 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                          <span className="text-gray-500 ml-2">hours per week</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Special Days</label>
                      <div className="flex items-center mb-2">
                        <input 
                          id="sundayOvertime"
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="sundayOvertime" className="ml-2 block text-sm text-gray-700">
                          Sunday work is paid at 1.5x rate
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input 
                          id="holidayOvertime"
                          type="checkbox"
                          checked
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="holidayOvertime" className="ml-2 block text-sm text-gray-700">
                          Holiday work is paid at 2x rate
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end mt-8">
                  <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors mr-3">
                    Cancel
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
            
            <div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Commission Structure</h3>
                <div className="space-y-4">
                  <div className="p-3 border border-gray-200 rounded-lg hover:border-blue-200 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-800">Standard Service</h4>
                      <button className="text-blue-600 text-sm hover:text-blue-800">Edit</button>
                    </div>
                    <p className="text-sm text-gray-600">5% of total job revenue</p>
                  </div>
                  
                  <div className="p-3 border border-gray-200 rounded-lg hover:border-blue-200 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-800">System Installation</h4>
                      <button className="text-blue-600 text-sm hover:text-blue-800">Edit</button>
                    </div>
                    <p className="text-sm text-gray-600">2% of total job revenue</p>
                  </div>
                  
                  <div className="p-3 border border-gray-200 rounded-lg hover:border-blue-200 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-800">Add-on Sales</h4>
                      <button className="text-blue-600 text-sm hover:text-blue-800">Edit</button>
                    </div>
                    <p className="text-sm text-gray-600">10% of add-on price</p>
                  </div>
                  
                  <div className="p-3 border border-gray-200 rounded-lg hover:border-blue-200 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-800">Service Contract</h4>
                      <button className="text-blue-600 text-sm hover:text-blue-800">Edit</button>
                    </div>
                    <p className="text-sm text-gray-600">$50 flat fee per contract</p>
                  </div>
                </div>
                
                <button className="mt-4 w-full py-2 text-blue-600 border border-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors flex items-center justify-center">
                  <Plus size={16} className="mr-2" />
                  Add Commission Structure
                </button>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 mt-4">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Deductions</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Federal Income Tax</span>
                    <span className="text-sm text-gray-800">Based on W-4</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Social Security</span>
                    <span className="text-sm text-gray-800">6.2%</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Medicare</span>
                    <span className="text-sm text-gray-800">1.45%</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Health Insurance</span>
                    <span className="text-sm text-gray-800">$85.00</span>
                  </div>
                </div>
                
                <button className="mt-4 w-full py-2 text-blue-600 border border-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors flex items-center justify-center">
                  <Plus size={16} className="mr-2" />
                  Add Custom Deduction
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Payroll;