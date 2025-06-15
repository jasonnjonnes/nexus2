import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  User, Phone, Mail, MapPin, FileText, Plus, Search, Filter, Calendar, 
  MessageSquare, Star, MoreHorizontal, Clock, CheckCircle, FileCheck, X, 
  Tag, Trash2, Edit, Briefcase, Home, ChevronDown, ArrowLeft
} from 'lucide-react';
import { auth as sharedAuth, db as sharedDb } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, setDoc, doc, updateDoc, deleteDoc, getFirestore, getDocs, getDoc, limit, orderBy, serverTimestamp } from 'firebase/firestore';
import CustomerDetailView from '../components/CustomerDetailView';
import LocationDetailView from '../components/LocationDetailView';
import TagInput from '../components/TagInput';
import CustomerImportModal from '../components/CustomerImportModal';
import JobImportModal from '../components/JobImportModal';
import InvoiceImportModal from '../components/InvoiceImportModal';
import EstimateImportModal from '../components/EstimateImportModal';
import LocationImportModal from '../components/LocationImportModal';
import { Menu } from '@headlessui/react';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { useCache } from '../contexts/CacheContext';
import CallButton from '../components/CallButton';
import { trackItemAccess, getRecentItems } from '../utils/recentItemsTracker';

// Use any type for flexibility with Firestore data

// --- Helper Functions ---
const getStatusColor = (status) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    case 'lead': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
};
const getCustomerTypeLabel = (type) => type ? type.charAt(0).toUpperCase() + type.slice(1) : '';
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
const formatCurrency = (amount) => `$${amount != null ? amount.toFixed(2) : '0.00'}`;

// --- Sub-Components ---

// Generic component for editable fields
const EditableField = ({ isEditing, value, onChange, name, placeholder, as: Component = 'input' }) => {
    if (isEditing) {
        if (Component === 'textarea') {
            return <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} className="w-full p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"/>;
        }
        return <input type="text" name={name} value={value} onChange={onChange} placeholder={placeholder} className="w-full p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"/>;
    }
    return <span className="text-gray-900 dark:text-gray-100">{value || 'N/A'}</span>;
};

const CreateCustomerForm = ({ onCancel, onCreate }) => {
    const [formData, setFormData] = useState({
      displayName: '', lastName: '', mobilePhone: '', company: '', email: '', homePhone: '', role: 'homeowner', workPhone: '', street: '', unit: '', city: '', state: '', zip: '', notes: '', tags: [], leadSource: '', referredBy: '',
    });
    
    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    
    const handleTagsChange = (newTags) => {
      setFormData(prev => ({ ...prev, tags: newTags }));
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        const newCustomerData = {
            name: formData.displayName, 
            company: formData.company, 
            email: formData.email, 
            phone: formData.mobilePhone, 
            status: 'lead', 
            customerSince: new Date().toISOString().split('T')[0], 
            tags: formData.tags, 
            leadSource: formData.leadSource, 
            notes: formData.notes,
            locations: [{ 
                id: `loc_${Date.now()}`, 
                name: 'Primary Location', 
                address: `${formData.street}${formData.unit ? ', ' + formData.unit : ''}, ${formData.city}, ${formData.state} ${formData.zip}`, 
                type: formData.role === 'homeowner' ? 'residential' : 'commercial', 
                isPrimary: true, 
                phone: formData.mobilePhone 
            }],
            billingAddress: `${formData.street}${formData.unit ? ', ' + formData.unit : ''}, ${formData.city}, ${formData.state} ${formData.zip}`, 
            lifetimeRevenue: 0, 
            avgJobTotal: 0, 
            balanceDue: 0,
            currentBalance: 0,
            totalJobs: 0,
            createdAt: new Date().toISOString(),
            membershipStatus: 'Not a Member',
            taxStatus: 'Non-Taxable',
            invoiceSignatureRequired: true
        };
        onCreate(newCustomerData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-end" onClick={onCancel}>
            <div className="w-full max-w-2xl bg-white dark:bg-slate-800 h-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                 <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-slate-700"><h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Add new customer</h2><button type="button" onClick={onCancel} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"><X size={20} className="text-gray-600 dark:text-gray-300" /></button></div>
                    <div className="p-8 space-y-8 overflow-y-auto flex-grow">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <input name="displayName" value={formData.displayName} onChange={handleChange} placeholder="Display name (shown on invoices)" required className="col-span-2 p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
                            <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Email" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
                            <input name="mobilePhone" value={formData.mobilePhone} onChange={handleChange} placeholder="Mobile phone" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
                            <input name="company" value={formData.company} onChange={handleChange} placeholder="Company" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
                            <input name="homePhone" value={formData.homePhone} onChange={handleChange} placeholder="Home phone" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
                             <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                                <div className="flex items-center space-x-4 mt-2"><label className="flex items-center"><input type="radio" name="role" value="homeowner" checked={formData.role === 'homeowner'} onChange={handleChange} className="form-radio text-blue-600"/><span className="ml-2 text-gray-800 dark:text-gray-200">Homeowner</span></label><label className="flex items-center"><input type="radio" name="role" value="business" checked={formData.role === 'business'} onChange={handleChange} className="form-radio text-blue-600"/><span className="ml-2 text-gray-800 dark:text-gray-200">Business</span></label></div>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center"><MapPin size={20} className="mr-2"/> Address</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><input name="street" value={formData.street} onChange={handleChange} placeholder="Street" className="col-span-2 p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/><input name="unit" value={formData.unit} onChange={handleChange} placeholder="Unit" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/><input name="city" value={formData.city} onChange={handleChange} placeholder="City" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/><input name="state" value={formData.state} onChange={handleChange} placeholder="State" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/><input name="zip" value={formData.zip} onChange={handleChange} placeholder="Zip" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/></div>
                        </div>
                        <div>
                             <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center"><FileText size={20} className="mr-2"/> Notes & Details</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Customer notes" className="col-span-2 p-2 border rounded-md h-24 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"></textarea>
                                 <div className="col-span-2">
                                   <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer tags</label>
                                   <TagInput
                                     tags={formData.tags}
                                     onTagsChange={handleTagsChange}
                                     placeholder="Type and press Enter to add tags"
                                   />
                                 </div>
                                 <input name="leadSource" value={formData.leadSource} onChange={handleChange} placeholder="Lead source" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/><input name="referredBy" value={formData.referredBy} onChange={handleChange} placeholder="Referred by" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
                             </div>
                        </div>
                    </div>
                    <div className="flex justify-end p-6 border-t bg-gray-50 dark:bg-slate-800 space-x-3 border-gray-200 dark:border-slate-700"><button type="button" onClick={onCancel} className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200">Cancel</button><button type="submit" className="px-6 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Create customer</button></div>
                </form>
            </div>
        </div>
    );
};

const Customers = () => {
  const location = useLocation();
  const [view, setView] = useState('list');
  const [customers, setCustomers] = useState<any[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [db, setDb] = useState(sharedDb);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCustomerImport, setShowCustomerImport] = useState(false);
  const [showJobImport, setShowJobImport] = useState(false);
  const [showInvoiceImport, setShowInvoiceImport] = useState(false);
  const [showEstimateImport, setShowEstimateImport] = useState(false);
  const [showLocationImport, setShowLocationImport] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [unsubscribeCustomers, setUnsubscribeCustomers] = useState<(() => void) | null>(null);
  const { tenantId } = useFirebaseAuth();
  const cache = useCache();

  // Handle navigation from global search
  useEffect(() => {
    if (location.state?.selectedCustomerId) {
      setSelectedCustomerId(location.state.selectedCustomerId);
      setView('detail');
      
      if (location.state?.selectedLocationId) {
        setSelectedLocationId(location.state.selectedLocationId);
        setView('location');
      }
      
      // Clear the state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Listen for auth changes
  useEffect(() => {
    const unsub = onAuthStateChanged(sharedAuth, (user) => {
      if (user) {
        setUserId(user.uid);
        setIsLoading(false);
      } else {
        window.location.href = '/login';
      }
    });
    return () => unsub();
  }, []);

  // Load recent customers
  const loadRecentCustomers = useCallback(async () => {
    if (!userId || !tenantId) return;
    
    try {
      const recentCustomerItems = await getRecentItems(userId, tenantId, 'customer');
      
      // Fetch full customer data for recents
      const recentCustomerData: any[] = [];
      for (const recent of recentCustomerItems) {
        try {
          // Get customer document directly by ID
          const customerDocRef = doc(db, `tenants/${tenantId}/customers/${recent.id}`);
          const customerSnap = await getDoc(customerDocRef);
          if (customerSnap.exists()) {
            recentCustomerData.push({ id: customerSnap.id, ...customerSnap.data() });
          }
        } catch (err) {
          console.log('Could not fetch recent customer:', recent.id);
        }
      }
      setRecentCustomers(recentCustomerData);
    } catch (error) {
      console.error('Error loading recent customers:', error);
    }
  }, [db, userId, tenantId]);

  // Track customer access using shared utility
  const trackCustomerAccess = useCallback(async (customerId: string, customerName: string, customerCompany?: string, customerEmail?: string, customerPhone?: string) => {
    if (!userId || !tenantId) return;
    
    const subtitle = customerCompany || 'Customer';
    const details = `${customerEmail || ''} • ${customerPhone || ''}`.replace(/^• |• $/, '');
    
    await trackItemAccess(
      userId,
      tenantId,
      customerId,
      'customer',
      customerName,
      subtitle,
      details
    );
  }, [userId, tenantId]);

  // Load initial customers (all customers, not limited)
  const loadInitialCustomers = useCallback(async () => {
    if (!db || !userId || !tenantId) return;
    
    try {
      // Load all customers without limit
      const customersQuery = query(
        collection(db, `tenants/${tenantId}/customers`)
      );
      const customersSnap = await getDocs(customersQuery);
      
      const customersData: any[] = [];
      customersSnap.docs.forEach(doc => {
        customersData.push({ id: doc.id, ...doc.data() });
      });
      
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  }, [db, userId, tenantId]);

  // Debounced search
  const performSearch = useCallback(async (term: string) => {
    if (!db || !userId || !tenantId) return;
    
    setIsSearching(true);
    try {
      const searchResults: any[] = [];
      const searchTerm = term.toLowerCase();
      
      const customersQuery = query(
        collection(db, `tenants/${tenantId}/customers`),
        where("userId", "==", userId),
        limit(25)
      );
      
      const customersSnap = await getDocs(customersQuery);
      customersSnap.docs.forEach(doc => {
        const customer = { id: doc.id, ...doc.data() } as any;
        if (
          customer.name?.toLowerCase().includes(searchTerm) ||
          customer.email?.toLowerCase().includes(searchTerm) ||
          customer.phone?.toLowerCase().includes(searchTerm) ||
          customer.company?.toLowerCase().includes(searchTerm) ||
          customer.tags?.some(tag => tag.toLowerCase().includes(searchTerm)) ||
          customer.locations?.some(location => 
            location.address?.toLowerCase().includes(searchTerm) ||
            location.name?.toLowerCase().includes(searchTerm) ||
            location.city?.toLowerCase().includes(searchTerm) ||
            location.state?.toLowerCase().includes(searchTerm)
          )
        ) {
          searchResults.push(customer);
        }
      });
      
      setCustomers(searchResults);
    } catch (error) {
      console.error('Error performing search:', error);
      setError("Could not search customers: " + (error as Error).message);
    } finally {
      setIsSearching(false);
    }
  }, [db, userId, tenantId]);

  const handleCustomerClick = useCallback(async (customerId: string) => {
    const customer = [...customers, ...recentCustomers].find(c => c.id === customerId);
    if (customer && customer.name) {
      await trackCustomerAccess(customerId, customer.name, customer.company, customer.email, customer.phone);
      setSelectedCustomerId(customerId);
      setView('detail');
    }
  }, [customers, recentCustomers, trackCustomerAccess]);

  // Search effect with debouncing
  useEffect(() => {
    if (!searchTerm.trim()) {
      // Load both recent customers and initial 25 customers
      loadRecentCustomers();
      loadInitialCustomers();
      return;
    }
    
    const timeoutId = setTimeout(() => {
      performSearch(searchTerm);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm, performSearch, loadRecentCustomers, loadInitialCustomers]);

  // Load initial data on mount
  useEffect(() => {
    if (db && userId && tenantId) {
      loadRecentCustomers();
      loadInitialCustomers();
    }
  }, [db, userId, tenantId, loadRecentCustomers, loadInitialCustomers]);

  // Note: Removed real-time listener in favor of on-demand loading for better performance

  // Note: Removed pause/resume listener functions as we're using on-demand loading

  const handleCreateCustomer = useCallback(async (newCustomerData) => { 
    console.log('➕ Creating customer:', newCustomerData);
    if (db && userId && tenantId) { 
      try { 
        // Use tenant-scoped collection path
        const customerCollectionPath = `tenants/${tenantId}/customers`;
        console.log('📂 Adding to collection:', customerCollectionPath);
        
        // Add userId to the customer data for filtering
        const customerDataWithUser = {
          ...newCustomerData,
          userId: userId // Add userId to filter customers by user
        };
        
        // Try to use setDoc with a custom ID first to avoid potential permission issues
        const customId = `customer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await setDoc(doc(db, customerCollectionPath, customId), customerDataWithUser);
        console.log('✅ Customer created with ID:', customId);
        setView('list'); 
      } catch (e) { 
        console.error("❌ Error adding document with setDoc: ", e);
        
        // Fall back to addDoc if setDoc fails
        try {
          const docRef = await addDoc(collection(db, `tenants/${tenantId}/customers`), {
            ...newCustomerData,
            userId: userId
          });
          console.log('✅ Customer created with ID (fallback):', docRef.id);
          setView('list');
        } catch (fallbackError) {
          console.error("❌ Error adding document with fallback: ", fallbackError);
          setError("Failed to create customer: " + fallbackError.message);
        }
      } 
    } else {
      console.error('❌ DB, userId, or tenantId not available:', { db: !!db, userId, tenantId });
      setError("Database not ready. Please try again.");
    }
  }, [db, userId, tenantId]);

  const handleUpdateCustomer = useCallback(async (updatedCustomer) => { 
    console.log('✏️ Updating customer:', updatedCustomer);
    if (db && userId && tenantId) { 
      const { id, ...data } = updatedCustomer; 
      // Ensure userId is preserved
      const updateData = {
        ...data,
        userId: userId // Make sure userId stays the same
      };
      try { 
        const customerDocPath = `tenants/${tenantId}/customers/${id}`;
        console.log('📝 Updating document at:', customerDocPath);
        await updateDoc(doc(db, customerDocPath), updateData); 
        console.log('✅ Customer updated successfully');
      } catch (e) { 
        console.error("❌ Error updating document: ", e); 
        setError("Failed to update customer: " + e.message); 
      } 
    } 
  }, [db, userId, tenantId]);

  const handleDeleteCustomer = useCallback(async (customerId) => { 
    console.log('🗑️ Deleting customer:', customerId);
    if (db && userId && tenantId) { 
      if (window.confirm("Are you sure you want to delete this customer? This action cannot be undone.")) { 
        try { 
          const customerDocPath = `tenants/${tenantId}/customers/${customerId}`;
          console.log('🗑️ Deleting document at:', customerDocPath);
          await deleteDoc(doc(db, customerDocPath)); 
          console.log('✅ Customer deleted successfully');
          setView('list'); 
          setSelectedCustomerId(null); 
        } catch (e) { 
          console.error("❌ Error deleting document: ", e); 
          setError("Failed to delete customer: " + e.message); 
        } 
      } 
    } 
  }, [db, userId, tenantId]);

  const handleLocationClick = (location) => {
    setSelectedLocationId(location.id);
    setView('location');
  };

  const handleBackToList = () => { 
    setView('list'); 
    setSelectedCustomerId(null); 
    setSelectedLocationId(null);
  };

  const handleBackToCustomer = () => {
    setView('detail');
    setSelectedLocationId(null);
  };
  
  // Get customer data for display
  const displayCustomers = searchTerm.trim() ? customers : customers.slice(0, 25);
  const showingRecents = !searchTerm.trim() && recentCustomers.length > 0;
  const allCustomers = [...customers, ...recentCustomers];
  const customerData = selectedCustomerId ? allCustomers.find(c => c.id === selectedCustomerId) : null;
  const locationData = selectedLocationId && customerData ? 
    customerData.locations?.find(l => l.id === selectedLocationId) : null;
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div><p className="ml-4 text-gray-600 dark:text-gray-300">Connecting to database...</p></div>;
  }
  
  if (error) {
    return <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg m-4 dark:bg-red-900/50 dark:text-red-300"><b>Error:</b> {error}</div>;
  }
  
  switch (view) {
    case 'create': 
      return <CreateCustomerForm onCancel={handleBackToList} onCreate={handleCreateCustomer} />;
    
    case 'detail': 
      return customerData ? (
        <CustomerDetailView 
          customer={customerData} 
          onBack={handleBackToList} 
          onUpdate={handleUpdateCustomer} 
          onDelete={handleDeleteCustomer}
          onLocationClick={handleLocationClick}
        />
      ) : (
        <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-slate-900 text-gray-800 dark:text-gray-200">
          Customer not found. Refreshing...
        </div>
      );
    
    case 'location':
      return locationData && customerData ? (
        <LocationDetailView
          location={locationData}
          customer={customerData}
          onBack={handleBackToCustomer}
          onUpdate={handleUpdateCustomer}
          onDelete={async (locationId) => {
            const updatedCustomer = {
              ...customerData,
              locations: customerData.locations.filter(loc => loc.id !== locationId)
            };
            await handleUpdateCustomer(updatedCustomer);
            handleBackToCustomer();
          }}
        />
      ) : (
        <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-slate-900 text-gray-800 dark:text-gray-200">
          Location not found. Refreshing...
        </div>
      );
    
    case 'list': 
    default:
      return (
        <div className="p-6 bg-gray-50 dark:bg-slate-900 min-h-screen">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Customers</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {recentCustomers.length > 0 ? `${recentCustomers.length} recent customers` : `${customers.length} search results`}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Search customers..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600" 
                />
              </div>
              <button className="p-2.5 rounded-lg border hover:bg-gray-100 dark:hover:bg-slate-700 border-gray-300 dark:border-slate-600">
                <Filter size={18} className="text-gray-600 dark:text-gray-300" />
              </button>
              <button onClick={() => setView('create')} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus size={18} className="mr-2" /> Create customer
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-3 mb-4">
            <Menu as="div" className="relative inline-block text-left">
              <Menu.Button className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-800 dark:text-gray-200 flex items-center">
                Import
                <ChevronDown size={16} className="ml-1" />
              </Menu.Button>
              <Menu.Items className="absolute left-0 mt-2 w-64 origin-top-left bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg z-20 focus:outline-none">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={`w-full text-left px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                      onClick={() => setShowCustomerImport(true)}
                    >
                      Import Customers
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={`w-full text-left px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                      onClick={() => {
                        console.log('🔥 Invoice Import button clicked');
                        setShowInvoiceImport(true);
                      }}
                    >
                      Import Invoices
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={`w-full text-left px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                      onClick={() => setShowEstimateImport(true)}
                    >
                      Import Estimates
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={`w-full text-left px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                      onClick={() => setShowJobImport(true)}
                    >
                      Import Jobs
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={`w-full text-left px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                      onClick={() => setShowLocationImport(true)}
                    >
                      Import Locations
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Menu>
          </div>
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-300">Searching...</span>
            </div>
          )}
          {showingRecents && (
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
              <Clock size={16} />
              <span>Recently accessed customers</span>
            </div>
          )}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border overflow-hidden border-gray-200 dark:border-slate-700">
            <div className="overflow-x-auto">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-700 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Display Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mobile</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tags</th>
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {displayCustomers.map(customer => (
                      <tr key={customer.id} onClick={() => handleCustomerClick(customer.id)} className="hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-blue-600 dark:text-blue-400">{customer.name}</div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}>
                            {getCustomerTypeLabel(customer.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {Array.isArray(customer.locations) ? customer.locations.find(l=>l.isPrimary)?.address : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-2">
                            <span>{customer.phone}</span>
                            {customer.phone && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <CallButton
                                  phoneNumber={customer.phone}
                                  customerName={customer.name}
                                  customerId={customer.id}
                                  variant="icon"
                                  size="sm"
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{customer.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {customer.tags?.map(tag => 
                              <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-800 dark:bg-slate-600 dark:text-gray-200">{tag}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={(e) => { e.stopPropagation(); }} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 p-1">
                            <MoreHorizontal size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          {!isSearching && displayCustomers.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchTerm.trim() ? 'No customers found matching your search.' : 'No recent customers. Start by creating or viewing customers.'}
            </div>
          )}
          {showCustomerImport && (
            <CustomerImportModal
              isOpen={showCustomerImport}
              onClose={() => setShowCustomerImport(false)}
              onComplete={() => { loadInitialCustomers(); }}
              userId={userId}
              tenantId={tenantId}
            />
          )}
          {showJobImport && (
            <JobImportModal
              isOpen={showJobImport}
              onClose={() => setShowJobImport(false)}
              onComplete={() => {/* Optionally refresh jobs here */}}
              userId={userId}
              tenantId={tenantId}
            />
          )}
          {showInvoiceImport && (
            <InvoiceImportModal
              isOpen={showInvoiceImport}
              onClose={() => setShowInvoiceImport(false)}
              onComplete={() => {/* Optionally refresh invoices here */}}
              userId={userId}
              tenantId={tenantId}
            />
          )}
          {showEstimateImport && (
            <EstimateImportModal
              isOpen={showEstimateImport}
              onClose={() => setShowEstimateImport(false)}
              onComplete={() => {/* Optionally refresh estimates here */}}
              userId={userId}
              tenantId={tenantId}
            />
          )}
          {showLocationImport && (
            <LocationImportModal
              isOpen={showLocationImport}
              onClose={() => setShowLocationImport(false)}
              onComplete={() => {/* Optionally refresh locations here */}}
              userId={userId}
              tenantId={tenantId}
            />
          )}
        </div>
      );
  }
};

export default Customers;