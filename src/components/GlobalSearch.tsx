import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, X, FileText, Users, MapPin, Phone, MessageSquare, 
  DollarSign, ShoppingCart, Calendar, Mail, User, Wrench
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

interface SearchResult {
  id: string;
  type: 'customer' | 'location' | 'job' | 'invoice' | 'estimate' | 'call' | 'sms' | 'purchase_order';
  title: string;
  subtitle: string;
  details: string;
  metadata?: string;
  customerId?: string;
  locationId?: string;
  jobId?: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  
  // Firebase state
  const { user, tenantId } = useFirebaseAuth();
  const userId = user?.uid || null;
  
  // Data state
  const [customers, setCustomers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [estimates, setEstimates] = useState([]);

  // Filter options
  const filterOptions = [
    { value: 'all', label: 'All', icon: Search },
    { value: 'jobs', label: 'Jobs', icon: Wrench },
    { value: 'estimates', label: 'Estimates', icon: FileText },
    { value: 'customers', label: 'Customers', icon: Users },
    { value: 'locations', label: 'Locations', icon: MapPin },
    { value: 'calls', label: 'Calls', icon: Phone },
    { value: 'sms', label: 'SMS', icon: MessageSquare },
    { value: 'invoices', label: 'Invoices', icon: DollarSign },
    { value: 'purchase_orders', label: 'Purchase Orders', icon: ShoppingCart },
  ];

  // Load data from Firebase
  useEffect(() => {
    if (!db || !userId || !tenantId) return;

    const unsubscribes = [];

    // Load customers
    const customersQuery = query(
      collection(db, 'tenants', tenantId, 'customers'),
      where("userId", "==", userId)
    );
    unsubscribes.push(onSnapshot(customersQuery, (querySnapshot) => {
      const customersData = [];
      querySnapshot.forEach((doc) => {
        customersData.push({ id: doc.id, ...doc.data() });
      });
      console.log('GlobalSearch - Loaded customers:', customersData.length);
      setCustomers(customersData);
    }));

    // Load jobs
    const jobsQuery = query(
      collection(db, 'tenants', tenantId, 'jobs'),
      where("userId", "==", userId)
    );
    unsubscribes.push(onSnapshot(jobsQuery, (querySnapshot) => {
      const jobsData = [];
      querySnapshot.forEach((doc) => {
        jobsData.push({ id: doc.id, ...doc.data() });
      });
      console.log('GlobalSearch - Loaded jobs:', jobsData.length);
      setJobs(jobsData);
    }));

    // Load invoices
    const invoicesQuery = query(
      collection(db, 'tenants', tenantId, 'invoices'),
      where("userId", "==", userId)
    );
    unsubscribes.push(onSnapshot(invoicesQuery, (querySnapshot) => {
      const invoicesData = [];
      querySnapshot.forEach((doc) => {
        invoicesData.push({ id: doc.id, ...doc.data() });
      });
      console.log('GlobalSearch - Loaded invoices:', invoicesData.length);
      setInvoices(invoicesData);
    }));

    // Load estimates
    const estimatesQuery = query(
      collection(db, 'tenants', tenantId, 'estimates'),
      where("userId", "==", userId)
    );
    unsubscribes.push(onSnapshot(estimatesQuery, (querySnapshot) => {
      const estimatesData = [];
      querySnapshot.forEach((doc) => {
        estimatesData.push({ id: doc.id, ...doc.data() });
      });
      console.log('GlobalSearch - Loaded estimates:', estimatesData.length);
      setEstimates(estimatesData);
    }));

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [db, userId, tenantId]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Search function
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];

    const term = searchTerm.toLowerCase();
    const results: SearchResult[] = [];
    
    console.log('GlobalSearch - Searching for:', term);
    console.log('Available data:', { 
      customers: customers.length, 
      jobs: jobs.length, 
      invoices: invoices.length, 
      estimates: estimates.length 
    });

    // Helper function to check if text matches search term
    const matches = (text: string) => text?.toLowerCase().includes(term);

    // Search customers
    if (selectedFilter === 'all' || selectedFilter === 'customers') {
      customers.forEach(customer => {
        if (
          matches(customer.name) ||
          matches(customer.email) ||
          matches(customer.phone) ||
          matches(customer.company)
        ) {
          results.push({
            id: customer.id,
            type: 'customer',
            title: customer.name,
            subtitle: customer.company ? `${customer.company}` : 'Customer',
            details: `${customer.email || ''} • ${customer.phone || ''}`.replace(/^• |• $/, ''),
            metadata: customer.status ? customer.status.charAt(0).toUpperCase() + customer.status.slice(1) : undefined
          });
        }
      });
    }

    // Search locations (from customer locations)
    if (selectedFilter === 'all' || selectedFilter === 'locations') {
      customers.forEach(customer => {
        if (customer.locations && Array.isArray(customer.locations)) {
          customer.locations.forEach(location => {
            if (
              matches(location.name) ||
              matches(location.address) ||
              matches(location.street) ||
              matches(location.city) ||
              matches(location.state) ||
              matches(location.zip) ||
              matches(location.phone) ||
              matches(location.contactPerson)
            ) {
              const address = location.address || 
                [location.street, location.city, location.state, location.zip].filter(Boolean).join(', ');
              
              results.push({
                id: location.id,
                type: 'location',
                title: location.name,
                subtitle: customer.name,
                details: address,
                metadata: location.phone,
                customerId: customer.id,
                locationId: location.id
              });
            }
          });
        }
      });
    }

    // Search jobs
    if (selectedFilter === 'all' || selectedFilter === 'jobs') {
      jobs.forEach(job => {
        let matchesJob = false;
        
        // Search job-specific fields
        if (
          matches(job.jobNumber) ||
          matches(job.jobType) ||
          matches(job.description) ||
          matches(job.summary) ||
          matches(job.customerName) ||
          matches(job.technician) ||
          matches(job.status) ||
          matches(job.priority) ||
          matches(job.notes)
        ) {
          matchesJob = true;
        }
        
        // Search by customer information if job has customerId
        if (!matchesJob && job.customerId) {
          const customer = customers.find(c => c.id === job.customerId);
          if (customer) {
            const customerMatches = 
              matches(customer.name) ||
              matches(customer.email) ||
              matches(customer.phone) ||
              matches(customer.company) ||
              customer.tags?.some(tag => matches(tag));
              
            const locationMatches = customer.locations?.some(location => 
              matches(location.address) ||
              matches(location.name) ||
              matches(location.city) ||
              matches(location.state) ||
              matches(location.zip) ||
              matches(location.phone) ||
              matches(location.contactPerson)
            );
            
            if (customerMatches || locationMatches) {
              console.log(`Job ${job.jobNumber || job.id} matched via customer:`, {
                customerName: customer.name,
                customerMatches,
                locationMatches,
                searchTerm: term
              });
              matchesJob = true;
            }
          }
        }
        
        if (matchesJob) {
          // Get customer info for display
          const customer = job.customerId ? customers.find(c => c.id === job.customerId) : null;
          const customerName = customer?.name || job.customerName || 'Unknown Customer';
          
          results.push({
            id: job.id,
            type: 'job',
            title: job.jobNumber ? `Job ${job.jobNumber}` : `Job ${job.id.slice(-6)}`,
            subtitle: job.jobType || 'Service Call',
            details: `${customerName} • ${job.technician || 'Unassigned'}`,
            metadata: job.status ? job.status.replace('_', ' ').charAt(0).toUpperCase() + job.status.slice(1) : undefined,
            jobId: job.id,
            customerId: job.customerId
          });
        }
      });
    }

    // Search invoices
    if (selectedFilter === 'all' || selectedFilter === 'invoices') {
      invoices.forEach(invoice => {
        let matchesInvoice = false;
        
        // Search invoice-specific fields
        if (
          matches(invoice.invoiceNumber) ||
          matches(invoice.customerName) ||
          matches(invoice.description) ||
          matches(invoice.summary) ||
          matches(invoice.jobNumber) ||
          matches(invoice.status) ||
          matches(invoice.notes) ||
          matches(invoice.poNumber)
        ) {
          matchesInvoice = true;
        }
        
        // Search by customer information if invoice has customerId
        if (!matchesInvoice && invoice.customerId) {
          const customer = customers.find(c => c.id === invoice.customerId);
          if (customer) {
            if (
              matches(customer.name) ||
              matches(customer.email) ||
              matches(customer.phone) ||
              matches(customer.company) ||
              customer.tags?.some(tag => matches(tag)) ||
              customer.locations?.some(location => 
                matches(location.address) ||
                matches(location.name) ||
                matches(location.city) ||
                matches(location.state) ||
                matches(location.zip) ||
                matches(location.phone) ||
                matches(location.contactPerson)
              )
            ) {
              matchesInvoice = true;
            }
          }
        }
        
        if (matchesInvoice) {
          // Get customer info for display
          const customer = invoice.customerId ? customers.find(c => c.id === invoice.customerId) : null;
          const customerName = customer?.name || invoice.customerName || 'Unknown Customer';
          
          results.push({
            id: invoice.id,
            type: 'invoice',
            title: invoice.invoiceNumber || `Invoice ${invoice.id.slice(-6)}`,
            subtitle: customerName,
            details: `${invoice.summary || invoice.description || ''} • $${(invoice.total || 0).toFixed(2)}`,
            metadata: invoice.status ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1) : undefined,
            customerId: invoice.customerId
          });
        }
      });
    }

    // Search estimates
    if (selectedFilter === 'all' || selectedFilter === 'estimates') {
      estimates.forEach(estimate => {
        let matchesEstimate = false;
        
        // Search estimate-specific fields
        if (
          matches(estimate.estimateNumber) ||
          matches(estimate.customerName) ||
          matches(estimate.description) ||
          matches(estimate.summary) ||
          matches(estimate.jobNumber) ||
          matches(estimate.status) ||
          matches(estimate.notes) ||
          matches(estimate.title) ||
          matches(estimate.workDescription)
        ) {
          matchesEstimate = true;
        }
        
        // Search by customer information if estimate has customerId
        if (!matchesEstimate && estimate.customerId) {
          const customer = customers.find(c => c.id === estimate.customerId);
          if (customer) {
            if (
              matches(customer.name) ||
              matches(customer.email) ||
              matches(customer.phone) ||
              matches(customer.company) ||
              customer.tags?.some(tag => matches(tag)) ||
              customer.locations?.some(location => 
                matches(location.address) ||
                matches(location.name) ||
                matches(location.city) ||
                matches(location.state) ||
                matches(location.zip) ||
                matches(location.phone) ||
                matches(location.contactPerson)
              )
            ) {
              matchesEstimate = true;
            }
          }
        }
        
        if (matchesEstimate) {
          // Get customer info for display
          const customer = estimate.customerId ? customers.find(c => c.id === estimate.customerId) : null;
          const customerName = customer?.name || estimate.customerName || 'Unknown Customer';
          
          results.push({
            id: estimate.id,
            type: 'estimate',
            title: estimate.estimateNumber || estimate.title || `Estimate ${estimate.id.slice(-6)}`,
            subtitle: customerName,
            details: `${estimate.summary || estimate.description || estimate.workDescription || ''} • $${(estimate.total || 0).toFixed(2)}`,
            metadata: estimate.status ? estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1) : undefined,
            customerId: estimate.customerId
          });
        }
      });
    }

    // Placeholder data for calls, SMS, and purchase orders
    if (selectedFilter === 'all' || selectedFilter === 'calls') {
      if (matches('inbound') || matches('call') || term.includes('9524')) {
        results.push({
          id: 'call-1',
          type: 'call',
          title: '9s - Inbound',
          subtitle: 'Incoming Call',
          details: 'Caller: (530) 730-0372 • Number Dialed: (469) 666-1934',
          metadata: '06/09/2025, 5:17 PM'
        });
      }
    }

    if (selectedFilter === 'all' || selectedFilter === 'sms') {
      if (matches('technician') || matches('jeremy') || term.includes('9524')) {
        results.push({
          id: 'sms-1',
          type: 'sms',
          title: 'SMS Message',
          subtitle: 'Thomas Magelssen',
          details: 'Hi, your technician Jeremy Skinner from Evolution Plumbing LLC is on the way...',
          metadata: 'To: (281) 222-9832 • 12/10/2024, 10:28 AM'
        });
      }
    }

    if (selectedFilter === 'all' || selectedFilter === 'purchase_orders') {
      // Placeholder - no data yet
    }

    return results;
  }, [searchTerm, selectedFilter, customers, jobs, invoices, estimates]);

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups = {};
    searchResults.forEach(result => {
      if (!groups[result.type]) {
        groups[result.type] = [];
      }
      groups[result.type].push(result);
    });
    return groups;
  }, [searchResults]);

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'customer':
        // Navigate to customers page with customer selected
        navigate(`/customers`, { state: { selectedCustomerId: result.id } });
        break;
      case 'location':
        // Navigate to customers page with location selected
        navigate(`/customers`, { state: { selectedCustomerId: result.customerId, selectedLocationId: result.locationId } });
        break;
      case 'job':
        navigate(`/job/${result.id}`);
        break;
      case 'invoice':
        navigate(`/invoice/${result.id}`);
        break;
      case 'estimate':
        navigate(`/estimate/${result.id}`);
        break;
      default:
        break;
    }
    onClose();
    setSearchTerm('');
  };

  // Get icon for result type
  const getResultIcon = (type: string) => {
    switch (type) {
      case 'customer': return Users;
      case 'location': return MapPin;
      case 'job': return Wrench;
      case 'invoice': return DollarSign;
      case 'estimate': return FileText;
      case 'call': return Phone;
      case 'sms': return MessageSquare;
      case 'purchase_order': return ShoppingCart;
      default: return Search;
    }
  };

  // Get display name for result type
  const getTypeDisplayName = (type: string) => {
    switch (type) {
      case 'customer': return 'Customers';
      case 'location': return 'Locations';
      case 'job': return 'Jobs';
      case 'invoice': return 'Invoices';
      case 'estimate': return 'Estimates';
      case 'call': return 'Calls';
      case 'sms': return 'SMS';
      case 'purchase_order': return 'Purchase Orders';
      default: return 'Results';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center pt-20">
      <div ref={searchRef} className="w-full max-w-3xl bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-h-[80vh] flex flex-col">
        {/* Search Header */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search customers, jobs, invoices, locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
            </div>
            
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
            >
              {filterOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X size={18} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto">
          {searchTerm.trim() === '' ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Search size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <h3 className="text-lg font-medium mb-2">Search your business data</h3>
              <p className="text-sm">Search across customers, jobs, invoices, estimates, and more...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Search size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <h3 className="text-lg font-medium mb-2">No results found</h3>
              <p className="text-sm">Try adjusting your search terms or filters</p>
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {Object.entries(groupedResults).map(([type, results]) => {
                const IconComponent = getResultIcon(type);
                const displayName = getTypeDisplayName(type);
                
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <IconComponent size={16} className="mr-2 text-gray-500 dark:text-gray-400" />
                        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {displayName}
                        </h3>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          ({results.length})
                        </span>
                      </div>
                      <button className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                        View All
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {results.slice(0, 5).map((result) => {
                        const ResultIcon = getResultIcon(result.type);
                        
                        return (
                          <div
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className="p-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                          >
                            <div className="flex items-start">
                              <div className="p-2 rounded bg-blue-100 dark:bg-blue-900/50 mr-3 mt-0.5">
                                <ResultIcon size={16} className="text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-gray-800 dark:text-gray-200 truncate">
                                    {result.title}
                                  </h4>
                                  {result.metadata && (
                                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-slate-600 dark:text-gray-300 flex-shrink-0">
                                      {result.metadata}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {result.subtitle}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate">
                                  {result.details}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {results.length > 5 && (
                        <button className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
                          View {results.length - 5} more {displayName.toLowerCase()}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;