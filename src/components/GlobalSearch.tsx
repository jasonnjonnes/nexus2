import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Search, X, FileText, Users, MapPin, Phone, MessageSquare, 
  DollarSign, ShoppingCart, Calendar, Mail, User, Wrench, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { collection, query, where, limit, orderBy, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { trackItemAccess, getRecentItems } from '../utils/recentItemsTracker';

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
  lastAccessed?: Date;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RecentItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  details: string;
  metadata?: string;
  lastAccessed: Date;
  accessCount: number;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  
  // Firebase state
  const { user, tenantId } = useFirebaseAuth();
  const userId = user?.uid || null;

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

  // Load recent items from Firestore
  useEffect(() => {
    const loadRecentItems = async () => {
      if (!userId || !tenantId) return;
      
      try {
        const items = await getRecentItems(userId, tenantId);
        const formattedItems = items.map(item => ({
          ...item,
          lastAccessed: new Date(item.lastAccessed)
        }));
        setRecentItems(formattedItems);
      } catch (error) {
        console.error('Error loading recent items:', error);
      }
    };

    if (isOpen) {
      loadRecentItems();
    }
  }, [isOpen, userId, tenantId]);

  // Add item to recents using shared utility
  const addToRecents = useCallback((result: SearchResult) => {
    if (!userId || !tenantId) return;
    
    trackItemAccess(
      userId,
      tenantId,
      result.id,
      result.type as any,
      result.title,
      result.subtitle,
      result.details,
      result.metadata
    );

    // Update local state immediately for better UX
    const newItem: RecentItem = {
      id: result.id,
      type: result.type,
      title: result.title,
      subtitle: result.subtitle,
      details: result.details,
      metadata: result.metadata,
      lastAccessed: new Date(),
      accessCount: 1
    };

    setRecentItems(prev => {
      const existing = prev.find(item => item.id === result.id && item.type === result.type);
      let updated;
      
      if (existing) {
        // Update existing item
        updated = prev.map(item => 
          item.id === result.id && item.type === result.type
            ? { ...item, lastAccessed: new Date(), accessCount: item.accessCount + 1 }
            : item
        );
      } else {
        // Add new item
        updated = [newItem, ...prev];
      }
      
      // Keep only the 25 most recent items
      updated = updated
        .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
        .slice(0, 25);
      
      return updated;
    });
  }, [userId, tenantId]);

  // Debounced search function
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        performSearch(searchTerm.trim());
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedFilter, tenantId]);

  // Perform actual search
  const performSearch = async (term: string) => {
    if (!tenantId) return;
    
    setIsLoading(true);
    const results: SearchResult[] = [];
    const searchTerm = term.toLowerCase();

    try {
      // Search customers using Firestore queries
      if (selectedFilter === 'all' || selectedFilter === 'customers') {
        try {
          // Search by name
          const nameQuery = query(
            collection(db, `tenants/${tenantId}/customers`),
            where('name', '>=', searchTerm),
            where('name', '<=', searchTerm + '\uf8ff'),
            limit(10)
          );
          
          // Search by email
          const emailQuery = query(
            collection(db, `tenants/${tenantId}/customers`),
            where('email', '>=', searchTerm),
            where('email', '<=', searchTerm + '\uf8ff'),
            limit(10)
          );
          
          // Search by company
          const companyQuery = query(
            collection(db, `tenants/${tenantId}/customers`),
            where('company', '>=', searchTerm),
            where('company', '<=', searchTerm + '\uf8ff'),
            limit(10)
          );

          const [nameSnap, emailSnap, companySnap] = await Promise.all([
            getDocs(nameQuery),
            getDocs(emailQuery),
            getDocs(companyQuery)
          ]);

          const customerIds = new Set();
          [nameSnap, emailSnap, companySnap].forEach(snap => {
            snap.docs.forEach(doc => {
              if (!customerIds.has(doc.id)) {
                customerIds.add(doc.id);
                const customer = { id: doc.id, ...doc.data() };
                results.push({
                  id: customer.id,
                  type: 'customer',
                  title: customer.name,
                  subtitle: customer.company || 'Customer',
                  details: `${customer.email || ''} • ${customer.phone || ''}`.replace(/^• |• $/, ''),
                  metadata: customer.status
                });
              }
            });
          });
        } catch (error) {
          console.error('Error searching customers:', error);
        }
      }

      // Search jobs using Firestore queries
      if (selectedFilter === 'all' || selectedFilter === 'jobs') {
        try {
          // Search by customer name
          const customerNameQuery = query(
            collection(db, `tenants/${tenantId}/jobs`),
            where('customerName', '>=', searchTerm),
            where('customerName', '<=', searchTerm + '\uf8ff'),
            limit(10)
          );
          
          // Search by description
          const descriptionQuery = query(
            collection(db, `tenants/${tenantId}/jobs`),
            where('description', '>=', searchTerm),
            where('description', '<=', searchTerm + '\uf8ff'),
            limit(10)
          );

          const [customerNameSnap, descriptionSnap] = await Promise.all([
            getDocs(customerNameQuery),
            getDocs(descriptionQuery)
          ]);

          const jobIds = new Set();
          [customerNameSnap, descriptionSnap].forEach(snap => {
            snap.docs.forEach(doc => {
              if (!jobIds.has(doc.id)) {
                jobIds.add(doc.id);
                const job = { id: doc.id, ...doc.data() };
                results.push({
                  id: job.id,
                  type: 'job',
                  title: job.jobNumber ? `Job ${job.jobNumber}` : `Job ${job.id.slice(-6)}`,
                  subtitle: job.jobType || 'Service Call',
                  details: `${job.customerName || 'Unknown Customer'} • ${job.technician || 'Unassigned'}`,
                  metadata: job.status,
                  jobId: job.id,
                  customerId: job.customerId
                });
              }
            });
          });
        } catch (error) {
          console.error('Error searching jobs:', error);
        }
      }

      // Search invoices using Firestore queries
      if (selectedFilter === 'all' || selectedFilter === 'invoices') {
        try {
          // Search by customer name
          const customerNameQuery = query(
            collection(db, `tenants/${tenantId}/invoices`),
            where('customerName', '>=', searchTerm),
            where('customerName', '<=', searchTerm + '\uf8ff'),
            limit(10)
          );
          
          // Search by description
          const descriptionQuery = query(
            collection(db, `tenants/${tenantId}/invoices`),
            where('description', '>=', searchTerm),
            where('description', '<=', searchTerm + '\uf8ff'),
            limit(10)
          );

          const [customerNameSnap, descriptionSnap] = await Promise.all([
            getDocs(customerNameQuery),
            getDocs(descriptionQuery)
          ]);

          const invoiceIds = new Set();
          [customerNameSnap, descriptionSnap].forEach(snap => {
            snap.docs.forEach(doc => {
              if (!invoiceIds.has(doc.id)) {
                invoiceIds.add(doc.id);
                const invoice = { id: doc.id, ...doc.data() };
                results.push({
                  id: invoice.id,
                  type: 'invoice',
                  title: invoice.invoiceNumber || `Invoice ${invoice.id.slice(-6)}`,
                  subtitle: invoice.customerName || 'Unknown Customer',
                  details: `${invoice.description || ''} • $${(invoice.total || 0).toFixed(2)}`,
                  metadata: invoice.status,
                  customerId: invoice.customerId
                });
              }
            });
          });
        } catch (error) {
          console.error('Error searching invoices:', error);
        }
      }

      // Search estimates using Firestore queries
      if (selectedFilter === 'all' || selectedFilter === 'estimates') {
        try {
          // Search by customer name
          const customerNameQuery = query(
            collection(db, `tenants/${tenantId}/estimates`),
            where('customerName', '>=', searchTerm),
            where('customerName', '<=', searchTerm + '\uf8ff'),
            limit(10)
          );
          
          // Search by description
          const descriptionQuery = query(
            collection(db, `tenants/${tenantId}/estimates`),
            where('description', '>=', searchTerm),
            where('description', '<=', searchTerm + '\uf8ff'),
            limit(10)
          );

          const [customerNameSnap, descriptionSnap] = await Promise.all([
            getDocs(customerNameQuery),
            getDocs(descriptionQuery)
          ]);

          const estimateIds = new Set();
          [customerNameSnap, descriptionSnap].forEach(snap => {
            snap.docs.forEach(doc => {
              if (!estimateIds.has(doc.id)) {
                estimateIds.add(doc.id);
                const estimate = { id: doc.id, ...doc.data() };
                results.push({
                  id: estimate.id,
                  type: 'estimate',
                  title: estimate.estimateNumber || `Estimate ${estimate.id.slice(-6)}`,
                  subtitle: estimate.customerName || 'Unknown Customer',
                  details: `${estimate.description || ''} • $${(estimate.total || 0).toFixed(2)}`,
                  metadata: estimate.status,
                  customerId: estimate.customerId
                });
              }
            });
          });
        } catch (error) {
          console.error('Error searching estimates:', error);
        }
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle clicks outside modal
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

  // Get recent items by type
  const getRecentsByType = (type: string) => {
    return recentItems
      .filter(item => type === 'all' || item.type === type)
      .slice(0, 5);
  };

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: { [key: string]: SearchResult[] } = {};
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
    addToRecents(result);
    
    switch (result.type) {
      case 'customer':
        navigate(`/customers`, { state: { selectedCustomerId: result.id } });
        break;
      case 'location':
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

  const showingRecents = searchTerm.trim() === '';
  const recentsToShow = showingRecents ? getRecentsByType(selectedFilter) : [];

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
          {showingRecents ? (
            <div className="p-4">
              {recentsToShow.length > 0 ? (
                <div>
                  <div className="flex items-center mb-4">
                    <Clock size={16} className="mr-2 text-gray-500 dark:text-gray-400" />
                    <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      Recent {selectedFilter === 'all' ? 'Items' : getTypeDisplayName(selectedFilter)}
                    </h3>
                  </div>
                  
                  <div className="space-y-2">
                    {recentsToShow.map((item) => {
                      const ResultIcon = getResultIcon(item.type);
                      
                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          onClick={() => handleResultClick({
                            id: item.id,
                            type: item.type as any,
                            title: item.title,
                            subtitle: item.subtitle,
                            details: item.details,
                            metadata: item.metadata
                          })}
                          className="p-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start">
                            <div className="p-2 rounded bg-blue-100 dark:bg-blue-900/50 mr-3 mt-0.5">
                              <ResultIcon size={16} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-gray-800 dark:text-gray-200 truncate">
                                  {item.title}
                                </h4>
                                {item.metadata && (
                                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-slate-600 dark:text-gray-300 flex-shrink-0">
                                    {item.metadata}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {item.subtitle}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate">
                                {item.details}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Clock size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <h3 className="text-lg font-medium mb-2">No recent items</h3>
                  <p className="text-sm">Start searching to see your recently accessed items here</p>
                </div>
              )}
            </div>
          ) : isLoading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm">Searching...</p>
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
                    </div>
                    
                    <div className="space-y-2">
                      {results.map((result) => {
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