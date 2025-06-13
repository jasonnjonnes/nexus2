import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, Phone, Mail, MapPin, FileText, Plus, Search, Filter, Calendar, 
  MessageSquare, Star, MoreHorizontal, Clock, CheckCircle, FileCheck, X, 
  Tag, Trash2, Edit, Briefcase, Home, ChevronDown, ArrowLeft
} from 'lucide-react';
import { auth as sharedAuth, db as sharedDb } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, setDoc, doc, updateDoc, deleteDoc, getFirestore } from 'firebase/firestore';
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
  const [view, setView] = useState('list');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [db, setDb] = useState(sharedDb);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCustomerImport, setShowCustomerImport] = useState(false);
  const [showJobImport, setShowJobImport] = useState(false);
  const [showInvoiceImport, setShowInvoiceImport] = useState(false);
  const [showEstimateImport, setShowEstimateImport] = useState(false);
  const [showLocationImport, setShowLocationImport] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const customersPerPage = 25;
  const [unsubscribeCustomers, setUnsubscribeCustomers] = useState(null);
  const { tenantId } = useFirebaseAuth();

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

  // Set up Firestore listener for customers
  useEffect(() => {
    if (!db || !userId || !tenantId) {
      return;
    }
    const customerCollectionPath = `tenants/${tenantId}/customers`;
    const q = query(
      collection(db, customerCollectionPath),
      where("userId", "==", userId)
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const customersData = [];
      querySnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        customersData.push(data);
      });
      setCustomers(customersData);
    }, (firestoreError) => {
      setError("Could not fetch customer data from Firestore: " + firestoreError.message);
    });
    setUnsubscribeCustomers(() => unsubscribe);
    return () => unsubscribe();
  }, [db, userId, tenantId]);

  // Helper to pause/resume listener
  const pauseCustomerListener = () => {
    if (unsubscribeCustomers) unsubscribeCustomers();
  };
  const resumeCustomerListener = () => {
    // Just trigger the useEffect by updating userId (or force re-mount if needed)
    setUnsubscribeCustomers(null);
    // The useEffect will re-subscribe automatically on next render
  };

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

  const handleCustomerClick = (customerId) => { 
    setSelectedCustomerId(customerId); 
    setSelectedLocationId(null);
    setView('detail'); 
  };

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
  
  // Filter customers by current user
  const userCustomers = customers.filter(customer => customer.userId === userId);
  const customerData = selectedCustomerId ? userCustomers.find(c => c.id === selectedCustomerId) : null;
  const locationData = selectedLocationId && customerData ? 
    customerData.locations?.find(l => l.id === selectedLocationId) : null;
  
  // Pagination logic
  const totalPages = Math.ceil(userCustomers.length / customersPerPage);
  const paginatedCustomers = userCustomers.slice((currentPage - 1) * customersPerPage, currentPage * customersPerPage);
  
  // Pagination window logic (show max 20 pages at a time)
  const maxPageButtons = 20;
  let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
  let endPage = startPage + maxPageButtons - 1;
  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxPageButtons + 1);
  }
  const pageNumbers = [];
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }
  
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
          onDelete={(locationId) => {
            const updatedCustomer = {
              ...customerData,
              locations: customerData.locations.filter(loc => loc.id !== locationId)
            };
            handleUpdateCustomer(updatedCustomer);
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
              <p className="text-gray-600 dark:text-gray-400 mt-1">{userCustomers.length} records</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                <input type="text" placeholder="Search customers..." className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600" />
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
                      onClick={() => setShowInvoiceImport(true)}
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
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border overflow-hidden border-gray-200 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-700">
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
                  {paginatedCustomers.map(customer => (
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{customer.phone}</td>
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
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center mt-6 space-x-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - maxPageButtons))}
                disabled={startPage === 1}
                className="px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 disabled:opacity-50"
                aria-label="Previous page range"
              >
                &#8592;
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 disabled:opacity-50"
                aria-label="Previous page"
              >
                &lt;
              </button>
              {pageNumbers.map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded border border-gray-300 dark:border-slate-600 ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200'}`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 disabled:opacity-50"
                aria-label="Next page"
              >
                &gt;
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + maxPageButtons))}
                disabled={endPage === totalPages}
                className="px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 disabled:opacity-50"
                aria-label="Next page range"
              >
                &#8594;
              </button>
            </div>
          )}
          {showCustomerImport && (
            <CustomerImportModal
              isOpen={showCustomerImport}
              onClose={() => setShowCustomerImport(false)}
              onComplete={() => { resumeCustomerListener(); }}
              userId={userId}
              tenantId={tenantId}
              pauseListener={pauseCustomerListener}
            />
          )}
          {showJobImport && (
            <JobImportModal
              isOpen={showJobImport}
              onClose={() => setShowJobImport(false)}
              onComplete={() => {/* Optionally refresh jobs here */}}
            />
          )}
          {showInvoiceImport && (
            <InvoiceImportModal
              isOpen={showInvoiceImport}
              onClose={() => setShowInvoiceImport(false)}
              onComplete={() => {/* Optionally refresh invoices here */}}
            />
          )}
          {showEstimateImport && (
            <EstimateImportModal
              isOpen={showEstimateImport}
              onClose={() => setShowEstimateImport(false)}
              onComplete={() => {/* Optionally refresh estimates here */}}
            />
          )}
          {showLocationImport && (
            <LocationImportModal
              isOpen={showLocationImport}
              onClose={() => setShowLocationImport(false)}
              onComplete={() => {/* Optionally refresh locations here */}}
            />
          )}
        </div>
      );
  }
};

export default Customers;