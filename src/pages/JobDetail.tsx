import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Save, X, MapPin, Phone, Mail, User, Calendar, 
  FileText, Trash2, Plus, Clock, CheckCircle, Target, Activity,
  Package, Wrench, Truck, MessageSquare, DollarSign, Download,
  Send, Copy, AlertCircle, Building, Star, PaperclipIcon
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, doc, getDoc, onSnapshot, updateDoc, addDoc, collection, query, where
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// Helper functions
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
const formatCurrency = (amount) => `$${amount != null ? amount.toFixed(2) : '0.00'}`;

// Generate invoice/estimate numbers
const generateInvoiceNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `INV-${timestamp}-${random}`;
};

const generateEstimateNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `EST-${timestamp}-${random}`;
};

const JobDetail = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [businessUnit, setBusinessUnit] = useState(null);
  const [serviceLocation, setServiceLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isCreatingEstimate, setIsCreatingEstimate] = useState(false);

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

  // Load job data
  useEffect(() => {
    if (!db || !jobId || !userId) return;

    const jobDocRef = doc(db, 'jobs', jobId);
    const unsubscribe = onSnapshot(jobDocRef, async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const jobData = { id: docSnapshot.id, ...docSnapshot.data() };
        setJob(jobData);
        
        // Load customer data
        if (jobData.customerId) {
          try {
            const customerDoc = await getDoc(doc(db, 'customers', jobData.customerId));
            if (customerDoc.exists()) {
              const customerData = { id: customerDoc.id, ...customerDoc.data() };
              setCustomer(customerData);
              
              // Find the service location from customer's locations
              if (jobData.locationId && customerData.locations) {
                const location = customerData.locations.find(loc => loc.id === jobData.locationId);
                if (location) {
                  setServiceLocation(location);
                } else {
                  // Fallback to primary location
                  const primaryLocation = customerData.locations.find(loc => loc.isPrimary) || customerData.locations[0];
                  setServiceLocation(primaryLocation);
                }
              }
            }
          } catch (error) {
            console.error("Error loading customer:", error);
          }
        }

        // Load business unit data
        if (jobData.businessUnitId) {
          try {
            const businessUnitDoc = await getDoc(doc(db, 'businessUnits', jobData.businessUnitId));
            if (businessUnitDoc.exists()) {
              setBusinessUnit({ id: businessUnitDoc.id, ...businessUnitDoc.data() });
            }
          } catch (error) {
            console.error("Error loading business unit:", error);
          }
        }
      } else {
        setError("Job not found");
      }
    }, (error) => {
      console.error("Error loading job:", error);
      setError("Failed to load job data");
    });

    return () => unsubscribe();
  }, [db, jobId, userId]);

  // Load invoices for this job
  useEffect(() => {
    if (!db || !jobId || !userId) return;

    const invoicesQuery = query(
      collection(db, 'invoices'),
      where("jobId", "==", jobId),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(invoicesQuery, (querySnapshot) => {
      const invoicesData = [];
      querySnapshot.forEach((doc) => {
        invoicesData.push({ id: doc.id, ...doc.data() });
      });
      setInvoices(invoicesData);
    });

    return () => unsubscribe();
  }, [db, jobId, userId]);

  // Load estimates for this job
  useEffect(() => {
    if (!db || !jobId || !userId) return;

    const estimatesQuery = query(
      collection(db, 'estimates'),
      where("jobId", "==", jobId),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(estimatesQuery, (querySnapshot) => {
      const estimatesData = [];
      querySnapshot.forEach((doc) => {
        estimatesData.push({ id: doc.id, ...doc.data() });
      });
      setEstimates(estimatesData);
    });

    return () => unsubscribe();
  }, [db, jobId, userId]);

  // Create Invoice
  const handleCreateInvoice = useCallback(async () => {
    if (!job || !customer || !db || !userId) {
      alert('Missing required data to create invoice');
      return;
    }

    setIsCreatingInvoice(true);

    try {
      const invoiceNumber = generateInvoiceNumber();
      const now = new Date().toISOString();
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now

      // Get service location address
      const locationAddress = serviceLocation ? 
        [serviceLocation.street, serviceLocation.city, serviceLocation.state, serviceLocation.zip].filter(Boolean).join(', ') :
        job.serviceLocation?.address || '';

      const invoiceData = {
        invoiceNumber,
        jobId: job.id,
        jobNumber: job.jobNumber,
        customerId: customer.id,
        customerName: customer.name,
        businessUnitId: businessUnit?.id || null,
        businessUnitName: businessUnit?.businessUnitName || '',
        
        // Bill to information (CUSTOMER INFORMATION)
        billTo: {
          name: customer.name,
          company: customer.company || '',
          address: customer.billingAddress || customer.locations?.find(loc => loc.isPrimary)?.address || '',
          phone: customer.phone || '',
          email: customer.email || ''
        },
        
        // Service location (FROM CUSTOMER'S LOCATIONS) - Include individual address components
        serviceLocation: {
          name: serviceLocation?.name || customer.name,
          address: locationAddress,
          street: serviceLocation?.street || '',
          city: serviceLocation?.city || '',
          state: serviceLocation?.state || '',
          zip: serviceLocation?.zip || '',
          phone: serviceLocation?.phone || customer.phone || '',
          contactPerson: serviceLocation?.contactPerson || customer.name
        },
        
        // Default line items (empty - user will add them)
        services: [],
        materials: [],
        
        // Totals
        subtotal: 0,
        taxRate: 0,
        taxAmount: 0,
        total: 0,
        
        // Status and dates
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        dueDate: dueDate,
        
        // Additional fields
        description: job.description || '', // This is separate from the internal job summary
        summary: '', // This will be the invoice summary for scope of work
        notes: '',
        payments: [],
        
        // Metadata
        userId: userId
      };

      const docRef = await addDoc(collection(db, 'invoices'), invoiceData);
      
      // Navigate to invoice detail page
      navigate(`/invoice/${docRef.id}`);
      
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Failed to create invoice. Please try again.');
    } finally {
      setIsCreatingInvoice(false);
    }
  }, [job, customer, serviceLocation, businessUnit, db, userId, navigate]);

  // Create Estimate
  const handleCreateEstimate = useCallback(async () => {
    if (!job || !customer || !db || !userId) {
      alert('Missing required data to create estimate');
      return;
    }

    setIsCreatingEstimate(true);

    try {
      const estimateNumber = generateEstimateNumber();
      const now = new Date().toISOString();
      const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now

      // Get service location address
      const locationAddress = serviceLocation ? 
        [serviceLocation.street, serviceLocation.city, serviceLocation.state, serviceLocation.zip].filter(Boolean).join(', ') :
        job.serviceLocation?.address || '';

      const estimateData = {
        estimateNumber,
        jobId: job.id,
        jobNumber: job.jobNumber,
        customerId: customer.id,
        customerName: customer.name,
        businessUnitId: businessUnit?.id || null,
        businessUnitName: businessUnit?.businessUnitName || '',
        
        // Bill to information (CUSTOMER INFORMATION)
        billTo: {
          name: customer.name,
          company: customer.company || '',
          address: customer.billingAddress || customer.locations?.find(loc => loc.isPrimary)?.address || '',
          phone: customer.phone || '',
          email: customer.email || ''
        },
        
        // Service location (FROM CUSTOMER'S LOCATIONS) - Include individual address components
        serviceLocation: {
          name: serviceLocation?.name || customer.name,
          address: locationAddress,
          street: serviceLocation?.street || '',
          city: serviceLocation?.city || '',
          state: serviceLocation?.state || '',
          zip: serviceLocation?.zip || '',
          phone: serviceLocation?.phone || customer.phone || '',
          contactPerson: serviceLocation?.contactPerson || customer.name
        },
        
        // Default line items (empty - user will add them)
        services: [],
        materials: [],
        
        // Totals
        subtotal: 0,
        taxRate: 0,
        taxAmount: 0,
        total: 0,
        
        // Status and dates
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        validUntil: validUntil,
        
        // Additional fields
        description: job.description || '', // This is separate from the internal job summary
        summary: '', // This will be the estimate summary for scope of work
        notes: '',
        tags: [],
        privateNotes: [],
        attachments: [],
        
        // Metadata
        userId: userId
      };

      const docRef = await addDoc(collection(db, 'estimates'), estimateData);
      
      // Navigate to estimate detail page
      navigate(`/estimate/${docRef.id}`);
      
    } catch (error) {
      console.error('Error creating estimate:', error);
      alert('Failed to create estimate. Please try again.');
    } finally {
      setIsCreatingEstimate(false);
    }
  }, [job, customer, serviceLocation, businessUnit, db, userId, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600 dark:text-gray-300">Loading job...</p>
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

  if (!job) {
    return (
      <div className="p-6 text-center text-gray-600 dark:text-gray-400">
        Job not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="mr-4 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                Job {job.jobNumber}
              </h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                <span>{job.jobType}</span>
                <span>•</span>
                <span>{job.customerName}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  job.status === 'scheduled' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                  job.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                  job.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}>
                  {job.status}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleCreateEstimate}
              disabled={isCreatingEstimate}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingEstimate ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Creating...
                </div>
              ) : (
                <>
                  <FileText size={16} className="mr-2 inline" />
                  Create Estimate
                </>
              )}
            </button>
            <button
              onClick={handleCreateInvoice}
              disabled={isCreatingInvoice}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingInvoice ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </div>
              ) : (
                <>
                  <DollarSign size={16} className="mr-2 inline" />
                  Create Invoice
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Information */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Job Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="font-medium text-gray-800 dark:text-gray-200">{job.jobType}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Job Type</div>
                </div>
                <div>
                  <div className="font-medium text-gray-800 dark:text-gray-200">{job.businessUnit || 'Not assigned'}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Business Unit</div>
                </div>
                <div>
                  <div className="font-medium text-gray-800 dark:text-gray-200">{formatDate(job.startDate)}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Start Date</div>
                </div>
                <div>
                  <div className="font-medium text-gray-800 dark:text-gray-200">{job.priority || 'Normal'}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Priority</div>
                </div>
              </div>
              
              {/* Internal Job Summary - For CSR Use Only */}
              {job.summary && (
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-center mb-2">
                    <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400 mr-2" />
                    <div className="font-medium text-yellow-800 dark:text-yellow-200">Internal Job Summary (CSR Use Only)</div>
                  </div>
                  <div className="text-yellow-700 dark:text-yellow-300 text-sm">{job.summary}</div>
                </div>
              )}
            </div>

            {/* Customer Information - Bill To Section */}
            {customer && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
                  <User size={20} className="inline mr-2" />
                  Bill To - Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-200">{customer.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Customer Name</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-200">{customer.phone}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Phone</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-200">{customer.email}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Email</div>
                  </div>
                  {customer.company && (
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-200">{customer.company}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Company</div>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <div className="font-medium text-gray-800 dark:text-gray-200">
                      {customer.billingAddress || customer.locations?.find(loc => loc.isPrimary)?.address || 'No billing address'}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Billing Address</div>
                  </div>
                </div>
              </div>
            )}

            {/* Service Location - From Customer's Locations */}
            {serviceLocation && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
                  <MapPin size={20} className="inline mr-2" />
                  Service Location
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-200">{serviceLocation.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Location Name</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-200">{serviceLocation.phone || customer?.phone}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Phone</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="font-medium text-gray-800 dark:text-gray-200">
                      {[serviceLocation.street, serviceLocation.city, serviceLocation.state, serviceLocation.zip].filter(Boolean).join(', ')}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Service Address</div>
                  </div>
                  {serviceLocation.contactPerson && (
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-200">{serviceLocation.contactPerson}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Contact Person</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Invoices Section */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Invoices ({invoices.length})</h3>
                <button
                  onClick={handleCreateInvoice}
                  disabled={isCreatingInvoice}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
              
              {invoices.length > 0 ? (
                <div className="space-y-3">
                  {invoices.map(invoice => (
                    <div 
                      key={invoice.id} 
                      onClick={() => navigate(`/invoice/${invoice.id}`)}
                      className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-200">{invoice.invoiceNumber}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Created {formatDate(invoice.createdAt)} • {formatCurrency(invoice.total)}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          invoice.status === 'draft' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' :
                          invoice.status === 'sent' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          invoice.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <DollarSign size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                  <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">No Invoices Yet</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">Create an invoice to bill your customer for this job.</p>
                  <button
                    onClick={handleCreateInvoice}
                    disabled={isCreatingInvoice}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingInvoice ? 'Creating...' : 'Create First Invoice'}
                  </button>
                </div>
              )}
            </div>

            {/* Estimates Section */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Estimates ({estimates.length})</h3>
                <button
                  onClick={handleCreateEstimate}
                  disabled={isCreatingEstimate}
                  className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isCreatingEstimate ? 'Creating...' : 'Create Estimate'}
                </button>
              </div>
              
              {estimates.length > 0 ? (
                <div className="space-y-3">
                  {estimates.map(estimate => (
                    <div 
                      key={estimate.id} 
                      onClick={() => navigate(`/estimate/${estimate.id}`)}
                      className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-200">{estimate.estimateNumber}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Created {formatDate(estimate.createdAt)} • {formatCurrency(estimate.total)}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          estimate.status === 'draft' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' :
                          estimate.status === 'sent' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          estimate.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {estimate.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                  <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">No Estimates Yet</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">Create an estimate to provide pricing for this job.</p>
                  <button
                    onClick={handleCreateEstimate}
                    disabled={isCreatingEstimate}
                    className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingEstimate ? 'Creating...' : 'Create First Estimate'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Job Status */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Job Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Current Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    job.status === 'scheduled' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                    job.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                    job.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Priority</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{job.priority}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Technician</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{job.technician || 'Unassigned'}</span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Invoices</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{invoices.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Estimates</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{estimates.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Billed</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">
                    {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.total || 0), 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={handleCreateEstimate}
                  disabled={isCreatingEstimate}
                  className="w-full px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isCreatingEstimate ? 'Creating...' : 'Create Estimate'}
                </button>
                <button
                  onClick={handleCreateInvoice}
                  disabled={isCreatingInvoice}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
                </button>
                <button className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-800 dark:text-gray-200 text-sm">
                  Add Photos
                </button>
                <button className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-800 dark:text-gray-200 text-sm">
                  Add Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetail;