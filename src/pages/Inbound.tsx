import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, MapPin, Calendar, Plus, Phone, User, Building, Mail } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, onSnapshot, doc, setDoc, query, where, getDocs
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from 'react-router-dom';

// Helper function to generate job numbers
const generateJobNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `JOB-${timestamp}-${random}`;
};

// Google Places API integration
const initializeGooglePlaces = (inputElement, onPlaceSelected) => {
  if (window.google && window.google.maps && window.google.maps.places) {
    const autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
      componentRestrictions: { country: ['us'] },
      fields: ['address_components', 'formatted_address', 'geometry']
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.address_components) {
        const addressComponents = {};
        place.address_components.forEach(component => {
          const types = component.types;
          if (types.includes('street_number')) {
            addressComponents.streetNumber = component.long_name;
          }
          if (types.includes('route')) {
            addressComponents.route = component.long_name;
          }
          if (types.includes('locality')) {
            addressComponents.city = component.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            addressComponents.state = component.short_name;
          }
          if (types.includes('postal_code')) {
            addressComponents.zip = component.long_name;
          }
        });

        const street = [addressComponents.streetNumber, addressComponents.route].filter(Boolean).join(' ');
        onPlaceSelected({
          street,
          city: addressComponents.city || '',
          state: addressComponents.state || '',
          zip: addressComponents.zip || ''
        });
      }
    });

    return autocomplete;
  }
  return null;
};

// Create Customer Form Component
const CreateCustomerForm = ({ onCancel, onCreate }) => {
  const [formData, setFormData] = useState({
    displayName: '', lastName: '', mobilePhone: '', company: '', email: '', homePhone: '', role: 'homeowner', workPhone: '', street: '', unit: '', city: '', state: '', zip: '', notes: '', tags: [], leadSource: '', referredBy: '',
  });
  
  const streetInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    if (streetInputRef.current) {
      autocompleteRef.current = initializeGooglePlaces(streetInputRef.current, (addressData) => {
        setFormData(prev => ({
          ...prev,
          street: addressData.street,
          city: addressData.city,
          state: addressData.state,
          zip: addressData.zip
        }));
      });
    }

    return () => {
      if (autocompleteRef.current && window.google) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);
  
  const handleChange = (e) => { 
    const { name, value } = e.target; 
    setFormData(prev => ({ ...prev, [name]: value })); 
  };
  
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
        phone: formData.mobilePhone,
        street: formData.street,
        unit: formData.unit,
        city: formData.city,
        state: formData.state,
        zip: formData.zip
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
          <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Add new customer</h2>
            <button type="button" onClick={onCancel} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700">
              <X size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>
          <div className="p-8 space-y-8 overflow-y-auto flex-grow">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input name="displayName" value={formData.displayName} onChange={handleChange} placeholder="Display name (shown on invoices)" required className="col-span-2 p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
              <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Email" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
              <input name="mobilePhone" value={formData.mobilePhone} onChange={handleChange} placeholder="Mobile phone" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
              <input name="company" value={formData.company} onChange={handleChange} placeholder="Company" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
              <input name="homePhone" value={formData.homePhone} onChange={handleChange} placeholder="Home phone" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                <div className="flex items-center space-x-4 mt-2">
                  <label className="flex items-center">
                    <input type="radio" name="role" value="homeowner" checked={formData.role === 'homeowner'} onChange={handleChange} className="form-radio text-blue-600"/>
                    <span className="ml-2 text-gray-800 dark:text-gray-200">Homeowner</span>
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="role" value="business" checked={formData.role === 'business'} onChange={handleChange} className="form-radio text-blue-600"/>
                    <span className="ml-2 text-gray-800 dark:text-gray-200">Business</span>
                  </label>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                <MapPin size={20} className="mr-2"/> Address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input 
                  ref={streetInputRef}
                  name="street" 
                  value={formData.street} 
                  onChange={handleChange} 
                  placeholder="Street (Google Places autocomplete)" 
                  className="col-span-2 p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"
                />
                <input name="unit" value={formData.unit} onChange={handleChange} placeholder="Unit" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
                <input name="city" value={formData.city} onChange={handleChange} placeholder="City" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
                <input name="state" value={formData.state} onChange={handleChange} placeholder="State" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
                <input name="zip" value={formData.zip} onChange={handleChange} placeholder="Zip" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Notes & Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Customer notes" className="col-span-2 p-2 border rounded-md h-24 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"></textarea>
                <input name="leadSource" value={formData.leadSource} onChange={handleChange} placeholder="Lead source" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
                <input name="referredBy" value={formData.referredBy} onChange={handleChange} placeholder="Referred by" className="p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-slate-600"/>
              </div>
            </div>
          </div>
          <div className="flex justify-end p-6 border-t bg-gray-50 dark:bg-slate-800 space-x-3 border-gray-200 dark:border-slate-700">
            <button type="button" onClick={onCancel} className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200">Cancel</button>
            <button type="submit" className="px-6 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Create customer</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Inbound: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('newjob');
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCustomArrival, setShowCustomArrival] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [jobTypes, setJobTypes] = useState([]);
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Job form state
  const [jobForm, setJobForm] = useState({
    jobType: '',
    businessUnit: '',
    marketingCampaign: '',
    priority: 'Normal',
    startDate: '',
    arrivalWindow: '',
    customArrivalStart: '',
    customArrivalEnd: '',
    startTime: '',
    technician: '',
    customerPO: '',
    workOrder: '',
    summary: '',
    tags: '',
    sendConfirmation: true,
    requireSignature: false
  });

  // Initialize Firebase
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        if (typeof __firebase_config === 'undefined' || !__firebase_config) {
          setError("Firebase configuration is missing");
          setIsLoading(false);
          return;
        }
        
        let firebaseConfig;
        if (typeof __firebase_config === 'string') {
          firebaseConfig = JSON.parse(__firebase_config);
        } else {
          firebaseConfig = __firebase_config;
        }

        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const auth = getAuth(app);
        
        setDb(firestore);
        
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setUserId(user.uid);
            setIsLoading(false);
          } else {
            try {
              const userCredential = await signInAnonymously(auth);
              setUserId(userCredential.user.uid);
              setIsLoading(false);
            } catch (authError) {
              setError("Authentication failed");
              setIsLoading(false);
            }
          }
        });
        
        return () => unsubscribeAuth();
      } catch (e) {
        console.error("Error initializing Firebase:", e);
        setError("Firebase initialization failed");
        setIsLoading(false);
      }
    };

    initializeFirebase();
  }, []);

  // Load customers
  useEffect(() => {
    if (!db || !userId) return;

    const q = query(
      collection(db, 'customers'),
      where("userId", "==", userId)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const customersData = [];
      querySnapshot.forEach((doc) => {
        customersData.push({ id: doc.id, ...doc.data() });
      });
      setCustomers(customersData);
    }, (error) => {
      console.error("Error loading customers:", error);
    });
    
    return () => unsubscribe();
  }, [db, userId]);

  // Load business units
  useEffect(() => {
    if (!db || !userId) return;

    const businessUnitsQuery = query(
      collection(db, 'businessUnits'),
      where("userId", "==", userId),
      where("status", "==", "active")
    );
    
    const unsubscribe = onSnapshot(businessUnitsQuery, (querySnapshot) => {
      const businessUnitsData = [];
      querySnapshot.forEach((doc) => {
        businessUnitsData.push({ id: doc.id, ...doc.data() });
      });
      setBusinessUnits(businessUnitsData);
    }, (error) => {
      console.error("Error loading business units:", error);
    });
    
    return () => unsubscribe();
  }, [db, userId]);

  // Load job types
  useEffect(() => {
    if (!db || !userId) return;

    const jobTypesQuery = query(
      collection(db, 'jobTypes'),
      where("userId", "==", userId),
      where("status", "==", "active")
    );
    
    const unsubscribe = onSnapshot(jobTypesQuery, (querySnapshot) => {
      const jobTypesData = [];
      querySnapshot.forEach((doc) => {
        jobTypesData.push({ id: doc.id, ...doc.data() });
      });
      
      // If no job types found, use defaults
      if (jobTypesData.length === 0) {
        setJobTypes([
          { id: 'default-1', name: 'AC Repair' },
          { id: 'default-2', name: 'HVAC Maintenance' },
          { id: 'default-3', name: 'Plumbing Repair' },
          { id: 'default-4', name: 'Electrical Work' },
          { id: 'default-5', name: 'System Installation' }
        ]);
      } else {
        setJobTypes(jobTypesData);
      }
    }, (error) => {
      console.error("Error loading job types:", error);
      // Fallback to default job types
      setJobTypes([
        { id: 'default-1', name: 'AC Repair' },
        { id: 'default-2', name: 'HVAC Maintenance' },
        { id: 'default-3', name: 'Plumbing Repair' },
        { id: 'default-4', name: 'Electrical Work' },
        { id: 'default-5', name: 'System Installation' }
      ]);
    });
    
    return () => unsubscribe();
  }, [db, userId]);

  // Load active technicians
  useEffect(() => {
    if (!db || !userId) return;

    const techQuery = query(
      collection(db, 'staff'),
      where("userId", "==", userId),
      where("staffType", "==", "technician"),
      where("status", "==", "active")
    );
    
    const unsubscribe = onSnapshot(techQuery, (querySnapshot) => {
      const techData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        techData.push({
          id: doc.id,
          name: data.fullName || `${data.firstName} ${data.lastName}`,
          role: data.role,
          businessUnit: data.businessUnit
        });
      });
      setTechnicians(techData);
    }, (error) => {
      console.error("Error loading technicians:", error);
    });
    
    return () => unsubscribe();
  }, [db, userId]);

  // Filter customers based on search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCustomers([]);
      return;
    }

    const filtered = customers.filter(customer => 
      customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm) ||
      customer.locations?.some(location => 
        location.address?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  const handleCreateCustomer = useCallback(async (newCustomerData) => {
    if (db && userId) {
      try {
        const customerDataWithUser = {
          ...newCustomerData,
          userId: userId
        };
        
        const customId = `customer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await setDoc(doc(db, 'customers', customId), customerDataWithUser);
        setShowCreateCustomer(false);
      } catch (e) {
        console.error("Error creating customer:", e);
        setError("Failed to create customer");
      }
    }
  }, [db, userId]);

  const handleJobFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setJobForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Show custom arrival window fields if "Custom arrival window" is selected
    if (name === 'arrivalWindow' && value === 'custom') {
      setShowCustomArrival(true);
    } else if (name === 'arrivalWindow' && value !== 'custom') {
      setShowCustomArrival(false);
    }
  };

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setSearchTerm(customer.name);
    setFilteredCustomers([]);
  };

  const handleBookJob = async () => {
    if (!selectedCustomer || !db || !userId) {
      alert('Please select a customer first');
      return;
    }

    if (!jobForm.jobType || !jobForm.startDate) {
      alert('Please fill in required fields (Job Type and Start Date)');
      return;
    }

    try {
      // Get the primary location for this customer
      const primaryLocation = selectedCustomer.locations?.find(loc => loc.isPrimary) || selectedCustomer.locations?.[0];
      
      if (!primaryLocation) {
        alert('Customer must have at least one location');
        return;
      }

      // Find the selected business unit
      const selectedBusinessUnit = businessUnits.find(bu => bu.businessUnitName === jobForm.businessUnit);

      // Create job data
      const jobNumber = generateJobNumber();
      const jobData = {
        jobNumber,
        customerId: selectedCustomer.id,
        locationId: primaryLocation.id,
        customerName: selectedCustomer.name,
        businessUnitId: selectedBusinessUnit?.id || null,
        businessUnitName: jobForm.businessUnit,
        
        // Service location details
        serviceLocation: {
          name: selectedCustomer.name,
          address: primaryLocation.address,
          phone: primaryLocation.phone || selectedCustomer.phone,
          contactPerson: selectedCustomer.name
        },
        
        // Bill to details
        billTo: {
          name: selectedCustomer.name,
          company: selectedCustomer.company || '',
          address: selectedCustomer.billingAddress || primaryLocation.address,
          phone: selectedCustomer.phone,
          email: selectedCustomer.email
        },
        
        // Job details
        jobType: jobForm.jobType,
        businessUnit: jobForm.businessUnit,
        marketingCampaign: jobForm.marketingCampaign,
        priority: jobForm.priority,
        status: 'scheduled',
        startDate: jobForm.startDate,
        arrivalWindow: jobForm.arrivalWindow === 'custom' 
          ? `${jobForm.customArrivalStart} - ${jobForm.customArrivalEnd}`
          : jobForm.arrivalWindow,
        startTime: jobForm.startTime,
        technician: jobForm.technician,
        customerPO: jobForm.customerPO,
        workOrder: jobForm.workOrder,
        description: jobForm.summary,
        tags: jobForm.tags ? jobForm.tags.split(',').map(tag => tag.trim()) : [],
        
        // Settings
        sendConfirmation: jobForm.sendConfirmation,
        requireSignature: jobForm.requireSignature,
        
        // Metadata
        createdAt: new Date().toISOString(),
        userId: userId,
        
        // Initialize empty arrays for future data
        notes: [],
        history: [{
          id: `history_${Date.now()}`,
          action: 'Job Created',
          description: `Job ${jobNumber} created for ${selectedCustomer.name}`,
          timestamp: new Date().toISOString(),
          user: 'Current User'
        }],
        appointments: jobForm.technician ? [{
          id: `${jobNumber}-1`,
          status: 'Scheduled',
          startDate: jobForm.startDate,
          arrivalWindow: jobForm.arrivalWindow === 'custom' 
            ? `${jobForm.customArrivalStart} - ${jobForm.customArrivalEnd}`
            : jobForm.arrivalWindow,
          startTime: jobForm.startTime || '9:00 AM',
          endTime: '5:00 PM', // Default end time
          duration: '8 HR',
          technician: jobForm.technician
        }] : []
      };

      // Save job to Firebase
      const jobDocRef = await addDoc(collection(db, 'jobs'), jobData);
      
      // Navigate to the job detail page
      navigate(`/job/${jobDocRef.id}`);
      
    } catch (error) {
      console.error('Error creating job:', error);
      alert('Failed to create job. Please try again.');
    }
  };

  const handleSaveAsLead = async () => {
    if (!selectedCustomer || !db || !userId) {
      alert('Please select a customer first');
      return;
    }

    try {
      // Create lead data (similar to job but with different status)
      const leadNumber = generateJobNumber().replace('JOB-', 'LEAD-');
      const leadData = {
        leadNumber,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        type: 'lead',
        status: 'new',
        jobType: jobForm.jobType,
        businessUnit: jobForm.businessUnit,
        priority: jobForm.priority,
        description: jobForm.summary,
        createdAt: new Date().toISOString(),
        userId: userId
      };

      await addDoc(collection(db, 'leads'), leadData);
      
      // Reset form
      setJobForm({
        jobType: '',
        businessUnit: '',
        marketingCampaign: '',
        priority: 'Normal',
        startDate: '',
        arrivalWindow: '',
        customArrivalStart: '',
        customArrivalEnd: '',
        startTime: '',
        technician: '',
        customerPO: '',
        workOrder: '',
        summary: '',
        tags: '',
        sendConfirmation: true,
        requireSignature: false
      });
      setSelectedCustomer(null);
      setSearchTerm('');
      
      alert('Lead saved successfully!');
    } catch (error) {
      console.error('Error saving lead:', error);
      alert('Failed to save lead. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600 dark:text-gray-300">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg m-4 dark:bg-red-900/50 dark:text-red-300">
        <b>Error:</b> {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top Navigation Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="flex">
          <button
            onClick={() => setActiveTab('newjob')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'newjob'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            New Job
          </button>
          <button
            onClick={() => setActiveTab('calls')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors relative ${
              activeTab === 'calls'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Calls
            <span className="ml-2 bg-red-500 text-white text-xs px-1.5 rounded-full">1</span>
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors relative ${
              activeTab === 'inbox'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Inbox
            <span className="ml-2 bg-red-500 text-white text-xs px-1.5 rounded-full">31</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white dark:bg-slate-900 overflow-y-auto">
        {activeTab === 'newjob' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-medium text-gray-800 dark:text-gray-100">New Job</h1>
            </div>

            <div className="space-y-4">
              <button className="w-full text-left p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">
                <div className="flex items-center text-gray-700 dark:text-gray-300">
                  <Plus size={16} className="mr-2" />
                  Manual job
                </div>
              </button>

              <button className="w-full text-left p-4 border-2 border-blue-200 dark:border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                <div className="flex items-center text-blue-600 dark:text-blue-400">
                  <Phone size={16} className="mr-2" />
                  Manual Call
                </div>
              </button>

              <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">Search for service location</h2>
                    <button 
                      onClick={() => setShowCreateCustomer(true)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      New Customer
                    </button>
                  </div>

                  <div className="relative mb-4">
                    <input 
                      type="text" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by customer name, email, phone, or address..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200" 
                    />
                    
                    {/* Search Results Dropdown */}
                    {filteredCustomers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredCustomers.map(customer => (
                          <div
                            key={customer.id}
                            onClick={() => handleCustomerSelect(customer)}
                            className="p-3 hover:bg-gray-50 dark:hover:bg-slate-600 cursor-pointer border-b border-gray-100 dark:border-slate-600 last:border-b-0"
                          >
                            <div className="flex items-center">
                              <User size={16} className="text-gray-400 mr-2" />
                              <div>
                                <div className="font-medium text-gray-800 dark:text-gray-200">{customer.name}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {customer.email} • {customer.phone}
                                </div>
                                {customer.locations?.[0] && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {customer.locations[0].address}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected Customer Display */}
                  {selectedCustomer && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <User size={16} className="text-blue-600 dark:text-blue-400 mr-2" />
                          <div>
                            <div className="font-medium text-blue-800 dark:text-blue-200">{selectedCustomer.name}</div>
                            <div className="text-sm text-blue-600 dark:text-blue-400">
                              {selectedCustomer.email} • {selectedCustomer.phone}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCustomer(null);
                            setSearchTerm('');
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center mb-4">
                    <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">Job Details</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Job Type *</label>
                      <select 
                        name="jobType"
                        value={jobForm.jobType}
                        onChange={handleJobFormChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                      >
                        <option value="">Select job type...</option>
                        {jobTypes.map(jobType => (
                          <option key={jobType.id} value={jobType.name}>
                            {jobType.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Business Unit</label>
                      <select 
                        name="businessUnit"
                        value={jobForm.businessUnit}
                        onChange={handleJobFormChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                      >
                        <option value="">Select business unit...</option>
                        {businessUnits.map(unit => (
                          <option key={unit.id} value={unit.businessUnitName}>
                            {unit.businessUnitName}
                          </option>
                        ))}
                      </select>
                      {businessUnits.length === 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          No business units found. Add business units in Settings → Business Units.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Marketing Campaign</label>
                      <select 
                        name="marketingCampaign"
                        value={jobForm.marketingCampaign}
                        onChange={handleJobFormChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                      >
                        <option value="">Select campaign...</option>
                        <option value="Summer Special">Summer Special</option>
                        <option value="Emergency Service">Emergency Service</option>
                        <option value="Maintenance Plan">Maintenance Plan</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Priority</label>
                      <select 
                        name="priority"
                        value={jobForm.priority}
                        onChange={handleJobFormChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                      >
                        <option value="Normal">Normal</option>
                        <option value="High">High</option>
                        <option value="Emergency">Emergency</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Start Date *</label>
                      <div className="relative">
                        <input 
                          type="date"
                          name="startDate"
                          value={jobForm.startDate}
                          onChange={handleJobFormChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Arrival Window</label>
                      <div className="flex items-center">
                        <select 
                          name="arrivalWindow"
                          value={jobForm.arrivalWindow}
                          onChange={handleJobFormChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                        >
                          <option value="">Select window...</option>
                          <option value="8am-12pm">8am-12pm</option>
                          <option value="12pm-5pm">12pm-5pm</option>
                          <option value="5pm-8pm">5pm-8pm</option>
                          <option value="custom">Custom arrival window</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Start Time</label>
                      <input 
                        type="time"
                        name="startTime"
                        value={jobForm.startTime}
                        onChange={handleJobFormChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200" 
                      />
                    </div>
                  </div>

                  {/* Custom Arrival Window Fields */}
                  {showCustomArrival && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Arrival Window Start</label>
                        <input 
                          type="datetime-local"
                          name="customArrivalStart"
                          value={jobForm.customArrivalStart}
                          onChange={handleJobFormChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Arrival Window End</label>
                        <input 
                          type="datetime-local"
                          name="customArrivalEnd"
                          value={jobForm.customArrivalEnd}
                          onChange={handleJobFormChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200" 
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Technician (optional)</label>
                      <select 
                        name="technician"
                        value={jobForm.technician}
                        onChange={handleJobFormChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                      >
                        <option value="">Select technician...</option>
                        {technicians.map(tech => (
                          <option key={tech.id} value={tech.name}>
                            {tech.name} ({tech.role})
                          </option>
                        ))}
                      </select>
                      {technicians.length === 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          No active technicians found. Add technicians in Settings.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Customer PO # (optional)</label>
                      <input 
                        type="text" 
                        name="customerPO"
                        value={jobForm.customerPO}
                        onChange={handleJobFormChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Work Order (optional)</label>
                      <input 
                        type="text" 
                        name="workOrder"
                        value={jobForm.workOrder}
                        onChange={handleJobFormChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="col-span-3">
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Summary</label>
                      <textarea 
                        name="summary"
                        value={jobForm.summary}
                        onChange={handleJobFormChange}
                        className="w-full p-3 min-h-[100px] border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Tags (optional)</label>
                      <input 
                        type="text" 
                        name="tags"
                        value={jobForm.tags}
                        onChange={handleJobFormChange}
                        placeholder="Comma separated"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200" 
                      />
                    </div>
                  </div>

                  <div className="flex items-center mb-4 space-x-4">
                    <label className="flex items-center text-gray-700 dark:text-gray-300">
                      <input 
                        type="checkbox" 
                        name="sendConfirmation"
                        checked={jobForm.sendConfirmation}
                        onChange={handleJobFormChange}
                        className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 mr-2" 
                      />
                      Send booking confirmation
                    </label>
                    <label className="flex items-center text-gray-700 dark:text-gray-300">
                      <input 
                        type="checkbox" 
                        name="requireSignature"
                        checked={jobForm.requireSignature}
                        onChange={handleJobFormChange}
                        className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 mr-2" 
                      />
                      Require customer signature on invoices for this job
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <button className="px-4 py-2 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/50">
                      Attach Equipment
                    </button>
                    <div className="space-x-3">
                      <button 
                        onClick={handleSaveAsLead}
                        className="px-4 py-2 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/50"
                      >
                        Save as Lead
                      </button>
                      <button className="px-4 py-2 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/50">
                        Build estimate
                      </button>
                      <button 
                        onClick={handleBookJob}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Book job
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'calls' && (
          <div className="p-6">
            <h1 className="text-xl font-medium text-gray-800 dark:text-gray-100 mb-6">Calls</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Recent Calls</h3>
                <div className="space-y-3">
                  <div className="flex items-center p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                    <Phone size={16} className="text-green-600 mr-3" />
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">John Smith</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">2:30 PM - 3 min</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Missed Calls</h3>
                <div className="space-y-3">
                  <div className="flex items-center p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                    <Phone size={16} className="text-red-600 mr-3" />
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">Sarah Johnson</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">1:15 PM</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Voicemail</h3>
                <div className="space-y-3">
                  <div className="flex items-center p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                    <MessageSquare size={16} className="text-blue-600 mr-3" />
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">Mike Wilson</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">11:45 AM - 1 min</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inbox' && (
          <div className="p-6">
            <h1 className="text-xl font-medium text-gray-800 dark:text-gray-100 mb-6">Inbox</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">My Chats</h3>
                <div className="space-y-3">
                  <div className="flex items-center p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                    <User size={16} className="text-blue-600 mr-3" />
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">Direct Message</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Private conversation</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Company Chats</h3>
                <div className="space-y-3">
                  <div className="flex items-center p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                    <Building size={16} className="text-green-600 mr-3" />
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">Customer Inquiry</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">From website chat</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Internal</h3>
                <div className="space-y-3">
                  <div className="flex items-center p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                    <MessageSquare size={16} className="text-purple-600 mr-3" />
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">Team Discussion</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Internal team chat</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Customer Modal */}
      {showCreateCustomer && (
        <CreateCustomerForm
          onCancel={() => setShowCreateCustomer(false)}
          onCreate={handleCreateCustomer}
        />
      )}
    </div>
  );
};

export default Inbound;