import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Send, Download, Copy, Edit, Save, X, Plus, Trash2,
  FileText, Pen, Check, DollarSign, Package, Phone, Mail, User,
  Tag, Paperclip, MessageSquare, Eye, Calculator, CreditCard
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, doc, getDoc, onSnapshot, updateDoc, addDoc, collection, query, where
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// Helper functions
const formatCurrency = (amount) => `$${amount != null ? amount.toFixed(2) : '0.00'}`;
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

// Default business unit data fallback
const getBusinessUnitFallback = (invoice, companyProfile) => ({
  displayName: companyProfile?.companyName || invoice?.businessUnitName || 'Your Business',
  businessUnitName: companyProfile?.companyName || invoice?.businessUnitName || 'Your Business',
  logo: companyProfile?.logo || null,
  address: {
    street: companyProfile?.businessAddress || '',
    city: companyProfile?.city || '',
    state: companyProfile?.state || '',
    zip: companyProfile?.zipCode || ''
  },
  phoneNumber: companyProfile?.phoneNumber || '',
  email: companyProfile?.email || '',
  authorizationParagraph: companyProfile?.authorizationParagraph || 'I authorize the above work to be done and agree to pay the amount stated.',
  invoiceMessage: companyProfile?.invoiceMessage || 'Thank you for your business!'
});

// Send Modal Component
const SendInvoiceModal = ({ isOpen, onClose, invoice, onSend }) => {
  const [selectedMethod, setSelectedMethod] = useState('email');
  const [selectedContact, setSelectedContact] = useState('');
  const [customContact, setCustomContact] = useState('');
  const [message, setMessage] = useState('');

  const emailContacts = [
    invoice?.billTo?.email,
    invoice?.serviceLocation?.email,
    invoice?.customerEmail
  ].filter(Boolean);

  const phoneContacts = [
    invoice?.billTo?.phone,
    invoice?.serviceLocation?.phone,
    invoice?.customerPhone
  ].filter(Boolean);

  useEffect(() => {
    if (selectedMethod === 'email' && emailContacts.length > 0) {
      setSelectedContact(emailContacts[0]);
    } else if (selectedMethod === 'sms' && phoneContacts.length > 0) {
      setSelectedContact(phoneContacts[0]);
    }
  }, [selectedMethod, emailContacts, phoneContacts]);

  const handleSend = () => {
    const contact = selectedContact || customContact;
    if (!contact) {
      alert('Please select or enter a contact method');
      return;
    }
    onSend(selectedMethod, contact, message);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Send Invoice</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Send Method
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="email"
                  checked={selectedMethod === 'email'}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="mr-2"
                />
                <Mail size={16} className="mr-1" />
                Email
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="sms"
                  checked={selectedMethod === 'sms'}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="mr-2"
                />
                <Phone size={16} className="mr-1" />
                SMS
              </label>
            </div>
          </div>

          {/* Contact Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {selectedMethod === 'email' ? 'Email Address' : 'Phone Number'}
            </label>
            {selectedMethod === 'email' ? (
              emailContacts.length > 0 ? (
                <select
                  value={selectedContact}
                  onChange={(e) => setSelectedContact(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                >
                  {emailContacts.map(email => (
                    <option key={email} value={email}>{email}</option>
                  ))}
                  <option value="">Enter custom email...</option>
                </select>
              ) : (
                <input
                  type="email"
                  value={customContact}
                  onChange={(e) => setCustomContact(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                />
              )
            ) : (
              phoneContacts.length > 0 ? (
                <select
                  value={selectedContact}
                  onChange={(e) => setSelectedContact(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                >
                  {phoneContacts.map(phone => (
                    <option key={phone} value={phone}>{phone}</option>
                  ))}
                  <option value="">Enter custom phone...</option>
                </select>
              ) : (
                <input
                  type="tel"
                  value={customContact}
                  onChange={(e) => setCustomContact(e.target.value)}
                  placeholder="Enter phone number"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                />
              )
            )}
            
            {selectedContact === '' && (selectedMethod === 'email' ? emailContacts.length > 0 : phoneContacts.length > 0) && (
              <input
                type={selectedMethod === 'email' ? 'email' : 'tel'}
                value={customContact}
                onChange={(e) => setCustomContact(e.target.value)}
                placeholder={`Enter custom ${selectedMethod === 'email' ? 'email' : 'phone number'}`}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 mt-2"
              />
            )}
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Message (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Add a personal message with your ${selectedMethod === 'email' ? 'email' : 'text message'}...`}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 min-h-[80px]"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Send Invoice
          </button>
        </div>
      </div>
    </div>
  );
};

// Updated Professional Invoice Template Component
const InvoiceTemplate = ({ invoice, businessUnit, companyProfile, customer }) => {
  if (!invoice) return <div className="p-8 text-center text-gray-500">Loading invoice...</div>;

  // Use business unit data for company info, customer data for bill-to info
  const companyData = businessUnit ? {
    ...businessUnit,
    // Ensure address is always an object
    address: businessUnit.address || {
      street: businessUnit.street || companyProfile?.businessAddress || '6600 Chase Oaks Blvd',
      city: businessUnit.city || companyProfile?.city || 'Plano',
      state: businessUnit.state || companyProfile?.state || 'Texas',
      zip: businessUnit.zip || companyProfile?.zipCode || '75023'
    },
    displayName: businessUnit.displayName || companyProfile?.companyName || 'Evolution Home Services',
    officialName: businessUnit.officialName || companyProfile?.companyName || 'Evolution Home Services',
    logo: businessUnit.logo || companyProfile?.logo,
    phoneNumber: businessUnit.phoneNumber || companyProfile?.phoneNumber || '(972) 597-2489',
    email: businessUnit.email || companyProfile?.email || '',
    authorizationParagraph: businessUnit.authorizationParagraph || companyProfile?.authorizationParagraph || 'I authorize the above work to be done and agree to pay the amount stated.',
    invoiceMessage: businessUnit.invoiceMessage || companyProfile?.invoiceMessage || 'Thank you for your business!'
  } : {
    displayName: companyProfile?.companyName || 'Evolution Home Services',
    officialName: companyProfile?.companyName || 'Evolution Home Services',
    logo: companyProfile?.logo || null,
    address: {
      street: companyProfile?.businessAddress || '6600 Chase Oaks Blvd',
      city: companyProfile?.city || 'Plano',
      state: companyProfile?.state || 'Texas',
      zip: companyProfile?.zipCode || '75023'
    },
    phoneNumber: companyProfile?.phoneNumber || '(972) 597-2489',
    email: companyProfile?.email || '',
    authorizationParagraph: companyProfile?.authorizationParagraph || 'I authorize the above work to be done and agree to pay the amount stated.',
    invoiceMessage: companyProfile?.invoiceMessage || 'Thank you for your business!'
  };

  // Get customer billing information
  const getCustomerBillTo = () => {
    if (customer) {
      // Use primary location for billing if available
      const primaryLocation = customer.locations?.find(loc => loc.isPrimary) || customer.locations?.[0];
      return {
        name: customer.name || 'Customer Name',
        company: customer.company || '',
        address: primaryLocation?.address || customer.billingAddress || '',
        phone: customer.phone || '',
        email: customer.email || ''
      };
    }
    
    // Fallback to invoice data
    return {
      name: invoice.customerName || 'Customer Name',
      company: invoice.billTo?.company || '',
      address: invoice.billTo?.address || '',
      phone: invoice.billTo?.phone || invoice.customerPhone || '',
      email: invoice.billTo?.email || invoice.customerEmail || ''
    };
  };

  // Get service location (job address)
  const getServiceLocation = () => {
    if (customer) {
      // Find non-primary location or use invoice service location
      const serviceLocation = customer.locations?.find(loc => !loc.isPrimary) || customer.locations?.[0];
      return {
        name: serviceLocation?.name || customer.name || 'Service Location',
        address: serviceLocation?.address || invoice.serviceLocation?.address || ''
      };
    }
    
    return {
      name: invoice.serviceLocation?.name || invoice.customerName || 'Service Location',
      address: invoice.serviceLocation?.address || ''
    };
  };

  const billTo = getCustomerBillTo();
  const serviceLocation = getServiceLocation();

  const totals = {
    subtotal: (invoice.services || []).reduce((sum, service) => sum + ((service.quantity || 0) * (service.unitPrice || 0)), 0) +
              (invoice.materials || []).reduce((sum, material) => sum + ((material.quantity || 0) * (material.unitPrice || 0)), 0),
    taxAmount: 0,
    total: 0
  };
  
  totals.taxAmount = totals.subtotal * ((invoice.taxRate || 0) / 100);
  totals.total = totals.subtotal + totals.taxAmount;

  const payments = invoice.payments || [];
  const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  const balanceDue = totals.total - totalPaid;

  return (
    <div className="bg-white shadow-lg max-w-4xl mx-auto">
      {/* Header Section */}
      <div className="bg-white p-8 border-b-2 border-blue-600">
        <div className="flex justify-between items-start">
          {/* Company Info with Logo */}
          <div className="flex items-start space-x-4">
            {companyData.logo && (
              <div className="flex-shrink-0">
                <img 
                  src={companyData.logo} 
                  alt={companyData.displayName}
                  className="h-20 w-auto object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{companyData.displayName}</h1>
              <div className="text-sm text-gray-600 leading-relaxed">
                {companyData.address?.street && <div>{companyData.address.street}</div>}
                {(companyData.address?.city || companyData.address?.state || companyData.address?.zip) && (
                  <div>
                    {companyData.address?.city}
                    {companyData.address?.state && `, ${companyData.address.state}`} 
                    {companyData.address?.zip && ` ${companyData.address.zip}`}
                  </div>
                )}
                {companyData.phoneNumber && <div>{companyData.phoneNumber}</div>}
                {companyData.email && <div>{companyData.email}</div>}
              </div>
            </div>
          </div>
          
          {/* Invoice Info - Removed blue box */}
          <div className="text-right">
            <div className="mb-4">
              <div className="text-3xl font-bold text-gray-900">INVOICE</div>
              <div className="text-xl text-gray-700">{invoice.invoiceNumber}</div>
            </div>
            <div className="text-sm text-gray-700 space-y-1">
              <div><strong>Invoice Date:</strong> {formatDate(invoice.createdAt)}</div>
              <div><strong>Due Date:</strong> {formatDate(invoice.dueDate)}</div>
              {invoice.completedDate && (
                <div><strong>Completed Date:</strong> {formatDate(invoice.completedDate)}</div>
              )}
              <div><strong>Payment Terms:</strong> Due Upon Receipt</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bill To and Job Address Section */}
      <div className="p-8 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Bill To */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-3 border-b border-gray-300 pb-1">BILL TO</h3>
            <div className="text-gray-900 leading-relaxed">
              <div className="font-semibold text-lg">{billTo.name}</div>
              {billTo.company && <div className="font-medium">{billTo.company}</div>}
              {billTo.address && (
                <div className="text-sm text-gray-600 mt-2">
                  {billTo.address.split(',').map((line, index) => (
                    <div key={index}>{line.trim()}</div>
                  ))}
                </div>
              )}
              {billTo.phone && <div className="text-sm text-gray-600 mt-1">{billTo.phone}</div>}
              {billTo.email && <div className="text-sm text-gray-600">{billTo.email}</div>}
            </div>
          </div>
          
          {/* Job Address */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-3 border-b border-gray-300 pb-1">JOB ADDRESS</h3>
            <div className="text-gray-900 leading-relaxed">
              <div className="font-semibold text-lg">{serviceLocation.name}</div>
              {serviceLocation.address && (
                <div className="text-sm text-gray-600 mt-2">
                  {serviceLocation.address.split(',').map((line, index) => (
                    <div key={index}>{line.trim()}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description of Work */}
      {(invoice.description || invoice.summary) && (
        <div className="p-8 border-b border-gray-200">
          <h3 className="text-lg font-bold text-blue-600 text-center mb-4">
            DESCRIPTION OF WORK
          </h3>
          <div className="text-gray-800 text-center bg-gray-50 p-4 rounded">
            {invoice.description || invoice.summary}
          </div>
        </div>
      )}

      {/* Line Items Table */}
      <div className="p-8 border-b border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="text-left py-3 px-4 font-semibold">DESCRIPTION</th>
                <th className="text-center py-3 px-4 font-semibold">QTY</th>
                <th className="text-right py-3 px-4 font-semibold">UNIT PRICE</th>
                <th className="text-right py-3 px-4 font-semibold">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.services || []).map((service, index) => (
                <tr key={`service-${index}`} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{service.name}</div>
                    {service.description && (
                      <div className="text-sm text-gray-600 mt-1">{service.description}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-900">{service.quantity}</td>
                  <td className="py-3 px-4 text-right text-gray-900">{formatCurrency(service.unitPrice)}</td>
                  <td className="py-3 px-4 text-right text-gray-900 font-semibold">
                    {formatCurrency((service.quantity || 0) * (service.unitPrice || 0))}
                  </td>
                </tr>
              ))}
              
              {(invoice.materials || []).map((material, index) => (
                <tr key={`material-${index}`} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{material.name}</div>
                    {material.description && (
                      <div className="text-sm text-gray-600 mt-1">{material.description}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-900">{material.quantity}</td>
                  <td className="py-3 px-4 text-right text-gray-900">{formatCurrency(material.unitPrice)}</td>
                  <td className="py-3 px-4 text-right text-gray-900 font-semibold">
                    {formatCurrency((material.quantity || 0) * (material.unitPrice || 0))}
                  </td>
                </tr>
              ))}
              
              {/* Show placeholder if no items */}
              {(invoice.services || []).length === 0 && (invoice.materials || []).length === 0 && (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-gray-500 italic">
                    No line items added yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments Section */}
      {payments.length > 0 && (
        <div className="p-8 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">PAYMENTS RECEIVED</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">Method</th>
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">Memo</th>
                  <th className="text-right py-2 px-4 font-semibold text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-2 px-4 text-sm text-gray-900">{formatDate(payment.date)}</td>
                    <td className="py-2 px-4 text-sm text-gray-900">{payment.method || 'Payment'}</td>
                    <td className="py-2 px-4 text-sm text-gray-600">{payment.memo || ''}</td>
                    <td className="py-2 px-4 text-sm text-right text-gray-900 font-semibold">
                      {formatCurrency(payment.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totals Section */}
      <div className="p-8 border-b border-gray-200">
        <div className="flex justify-end">
          <div className="w-80 bg-gray-50 p-6 rounded-lg">
            <div className="space-y-3">
              <div className="flex justify-between text-base">
                <span className="text-gray-700">SUB-TOTAL</span>
                <span className="font-semibold text-gray-900">{formatCurrency(totals.subtotal)}</span>
              </div>
              
              {totals.taxAmount > 0 && (
                <div className="flex justify-between text-base">
                  <span className="text-gray-700">TAX</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(totals.taxAmount)}</span>
                </div>
              )}
              
              <div className="border-t border-gray-300 pt-3">
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-gray-900">TOTAL DUE</span>
                  <span className="text-gray-900">{formatCurrency(totals.total)}</span>
                </div>
              </div>
              
              {totalPaid > 0 && (
                <>
                  <div className="flex justify-between text-base">
                    <span className="text-gray-700">PAYMENTS</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(totalPaid)}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-3">
                    <div className="flex justify-between text-xl font-bold">
                      <span className="text-red-600">BALANCE DUE</span>
                      <span className="text-red-600">{formatCurrency(balanceDue)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Authorization Section - Updated to use business unit data */}
      <div className="p-8 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-bold text-gray-900 mb-4">CUSTOMER AUTHORIZATION</h3>
        <div className="text-sm text-gray-700 leading-relaxed mb-6">
          {businessUnit?.authorizationParagraph || companyProfile?.authorizationParagraph || 'I authorize the above work to be done and agree to pay the amount stated.'}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="border-b border-gray-400 mb-2 pb-1">
              <span className="text-xs text-gray-500">Sign here</span>
            </div>
          </div>
          <div>
            <div className="border-b border-gray-400 mb-2 pb-1">
              <span className="text-xs text-gray-500">Date</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-8 bg-white">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900 mb-2">{companyData.displayName}</div>
          
          {companyData.invoiceMessage && (
            <div className="text-gray-600 mb-3">{companyData.invoiceMessage}</div>
          )}
          
          <div className="text-sm text-gray-600">
            {companyData.address?.street}
            {companyData.address?.city && `, ${companyData.address.city}`}
            {companyData.address?.state && `, ${companyData.address.state}`}
            {companyData.address?.zip && ` ${companyData.address.zip}`}
          </div>
          
          {companyData.phoneNumber && (
            <div className="text-sm text-gray-600">{companyData.phoneNumber}</div>
          )}
        </div>
        
        <div className="text-center mt-6 text-xs text-gray-500 border-t border-gray-200 pt-4">
          Invoice #{invoice.invoiceNumber} - Page 1 of 1
        </div>
      </div>
    </div>
  );
};

const InvoiceDetail = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [businessUnit, setBusinessUnit] = useState(null);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [activeTab, setActiveTab] = useState('edit');
  const [showSendModal, setShowSendModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit state
  const [editData, setEditData] = useState({
    summary: '',
    description: '',
    services: [],
    materials: [],
    payments: [],
    notes: '',
    tags: [],
    attachments: [],
    taxRate: 0
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

  // Load company profile data
  useEffect(() => {
    if (!db || !userId) return;

    const companyProfileQuery = query(
      collection(db, 'companyProfile'),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(companyProfileQuery, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const profileDoc = querySnapshot.docs[0];
        setCompanyProfile({ id: profileDoc.id, ...profileDoc.data() });
      } else {
        // Create default company profile if none exists
        const defaultProfile = {
          userId: userId,
          companyName: 'Your Business',
          businessAddress: '',
          city: '',
          state: '',
          zipCode: '',
          phoneNumber: '',
          email: '',
          estimateAuthorization: 'By signing below, you authorize the work described above.',
          invoiceMessage: 'Thank you for your business!',
          authorizationParagraph: 'I authorize the above work to be done and agree to pay the amount stated.',
          logo: null,
          createdAt: new Date().toISOString()
        };
        setCompanyProfile(defaultProfile);
      }
    });

    return () => unsubscribe();
  }, [db, userId]);

  // Load invoice data
  useEffect(() => {
    if (!db || !invoiceId || !userId) return;

    const invoiceDocRef = doc(db, 'invoices', invoiceId);
    const unsubscribe = onSnapshot(invoiceDocRef, async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const invoiceData = { id: docSnapshot.id, ...docSnapshot.data() };
        setInvoice(invoiceData);
        
        // Set edit data
        setEditData({
          summary: invoiceData.summary || '',
          description: invoiceData.description || '',
          services: invoiceData.services || [],
          materials: invoiceData.materials || [],
          payments: invoiceData.payments || [],
          notes: invoiceData.notes || '',
          tags: invoiceData.tags || [],
          attachments: invoiceData.attachments || [],
          taxRate: invoiceData.taxRate || 0
        });
        
        // Load business unit data
        if (invoiceData.businessUnitId) {
          try {
            const businessUnitDoc = await getDoc(doc(db, 'businessUnits', invoiceData.businessUnitId));
            if (businessUnitDoc.exists()) {
              setBusinessUnit({ id: businessUnitDoc.id, ...businessUnitDoc.data() });
            }
          } catch (error) {
            console.error("Error loading business unit:", error);
          }
        }

        // Load customer data
        if (invoiceData.customerId) {
          try {
            const customerDoc = await getDoc(doc(db, 'customers', invoiceData.customerId));
            if (customerDoc.exists()) {
              setCustomer({ id: customerDoc.id, ...customerDoc.data() });
            }
          } catch (error) {
            console.error("Error loading customer:", error);
          }
        }
      } else {
        setError("Invoice not found");
      }
    }, (error) => {
      console.error("Error loading invoice:", error);
      setError("Failed to load invoice data");
    });

    return () => unsubscribe();
  }, [db, invoiceId, userId]);

  // Save invoice
  const saveInvoice = useCallback(async () => {
    if (!invoice || !db) return;

    setIsSaving(true);
    try {
      const updatedData = {
        ...editData,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'invoices', invoice.id), updatedData);
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Failed to save invoice. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [invoice, editData, db]);

  // Add service
  const addService = () => {
    setEditData(prev => ({
      ...prev,
      services: [...prev.services, {
        id: `service_${Date.now()}`,
        name: '',
        description: '',
        quantity: 1,
        unitPrice: 0
      }]
    }));
  };

  // Add material
  const addMaterial = () => {
    setEditData(prev => ({
      ...prev,
      materials: [...prev.materials, {
        id: `material_${Date.now()}`,
        name: '',
        description: '',
        quantity: 1,
        unitPrice: 0
      }]
    }));
  };

  // Add payment
  const addPayment = () => {
    setEditData(prev => ({
      ...prev,
      payments: [...prev.payments, {
        id: `payment_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        method: 'Cash',
        amount: 0,
        memo: ''
      }]
    }));
  };

  // Update service
  const updateService = (index, field, value) => {
    setEditData(prev => ({
      ...prev,
      services: prev.services.map((service, i) => 
        i === index ? { ...service, [field]: value } : service
      )
    }));
  };

  // Update material
  const updateMaterial = (index, field, value) => {
    setEditData(prev => ({
      ...prev,
      materials: prev.materials.map((material, i) => 
        i === index ? { ...material, [field]: value } : material
      )
    }));
  };

  // Update payment
  const updatePayment = (index, field, value) => {
    setEditData(prev => ({
      ...prev,
      payments: prev.payments.map((payment, i) => 
        i === index ? { ...payment, [field]: value } : payment
      )
    }));
  };

  // Remove service
  const removeService = (index) => {
    setEditData(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index)
    }));
  };

  // Remove material
  const removeMaterial = (index) => {
    setEditData(prev => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index)
    }));
  };

  // Remove payment
  const removePayment = (index) => {
    setEditData(prev => ({
      ...prev,
      payments: prev.payments.filter((_, i) => i !== index)
    }));
  };

  const handleSendToCustomer = useCallback(async (method, contact, message) => {
    if (!invoice) return;
    
    try {
      // Create email/SMS notification record
      const notificationData = {
        type: 'invoice',
        method: method,
        invoiceId: invoice.id,
        recipientContact: contact,
        subject: `Invoice ${invoice.invoiceNumber} from ${businessUnit?.displayName || companyProfile?.companyName || 'Your Business'}`,
        message: message,
        status: 'sent',
        sentAt: new Date().toISOString(),
        userId: userId
      };
      
      await addDoc(collection(db, 'notifications'), notificationData);
      
      // Update invoice status
      await updateDoc(doc(db, 'invoices', invoice.id), {
        status: 'sent',
        sentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      alert(`Invoice sent via ${method} successfully!`);
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Failed to send invoice. Please try again.');
    }
  }, [invoice, businessUnit, companyProfile, db, userId]);

  const handleDownloadPDF = useCallback(async () => {
    if (!invoice) return;
    
    try {
      // Import jsPDF dynamically
      const { jsPDF } = await import('jspdf');
      const html2canvas = await import('html2canvas');
      
      // Get the preview content
      const element = document.querySelector('.invoice-preview');
      if (!element) {
        alert('Unable to generate PDF. Please try again.');
        return;
      }

      // Convert to canvas
      const canvas = await html2canvas.default(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Invoice_${invoice.invoiceNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Using print fallback.');
      window.print();
    }
  }, [invoice]);

  const handleDuplicate = useCallback(async () => {
    if (!invoice || !db || !userId) return;
    
    try {
      const duplicatedInvoice = {
        ...invoice,
        ...editData,
        invoiceNumber: `${invoice.invoiceNumber}-COPY`,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sentAt: null,
        payments: []
      };
      
      delete duplicatedInvoice.id;
      
      const docRef = await addDoc(collection(db, 'invoices'), duplicatedInvoice);
      navigate(`/invoice/${docRef.id}`);
    } catch (error) {
      console.error('Error duplicating invoice:', error);
      alert('Failed to duplicate invoice. Please try again.');
    }
  }, [invoice, editData, db, userId, navigate]);

  // Calculate totals
  const totals = {
    subtotal: (editData.services || []).reduce((sum, service) => sum + ((service.quantity || 0) * (service.unitPrice || 0)), 0) +
              (editData.materials || []).reduce((sum, material) => sum + ((material.quantity || 0) * (material.unitPrice || 0)), 0),
    taxAmount: 0,
    total: 0
  };
  
  totals.taxAmount = totals.subtotal * ((editData.taxRate || 0) / 100);
  totals.total = totals.subtotal + totals.taxAmount;

  const totalPaid = (editData.payments || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
  const balanceDue = totals.total - totalPaid;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600 dark:text-gray-300">Loading invoice...</p>
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

  if (!invoice) {
    return (
      <div className="p-6 text-center text-gray-600 dark:text-gray-400">
        Invoice not found
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
                Invoice {invoice.invoiceNumber}
              </h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                <span>{invoice.customerName}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  invoice.status === 'draft' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' :
                  invoice.status === 'sent' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                  invoice.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}>
                  {invoice.status}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  Balance Due: {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Download size={16} className="mr-2 inline" />
              Export PDF
            </button>
            <button
              onClick={() => setShowSendModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Send size={16} className="mr-2 inline" />
              Send
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mt-4">
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              activeTab === 'edit' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200'
            }`}
          >
            <Edit size={16} className="mr-2 inline" />
            Edit
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              activeTab === 'preview' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200'
            }`}
          >
            <Eye size={16} className="mr-2 inline" />
            Preview
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'edit' && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Invoice Summary */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Invoice Summary</h3>
                <button
                  onClick={saveInvoice}
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Summary
                  </label>
                  <input
                    type="text"
                    value={editData.summary}
                    onChange={(e) => setEditData(prev => ({ ...prev, summary: e.target.value }))}
                    placeholder="Brief summary of work"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editData.taxRate}
                    onChange={(e) => setEditData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed description of work performed"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>

            {/* Services */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Services</h3>
                <button
                  onClick={addService}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={16} className="mr-2 inline" />
                  Add Service
                </button>
              </div>
              
              <div className="space-y-4">
                {editData.services.map((service, index) => (
                  <div key={service.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Service Name
                        </label>
                        <input
                          type="text"
                          value={service.name}
                          onChange={(e) => updateService(index, 'name', e.target.value)}
                          placeholder="Service name"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={service.description}
                          onChange={(e) => updateService(index, 'description', e.target.value)}
                          placeholder="Description"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={service.quantity}
                          onChange={(e) => updateService(index, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Unit Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={service.unitPrice}
                          onChange={(e) => updateService(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                        />
                      </div>
                      
                      <div className="flex items-end">
                        <div className="flex-1 text-right">
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total</div>
                          <div className="font-medium text-gray-800 dark:text-gray-100">
                            {formatCurrency((service.quantity || 0) * (service.unitPrice || 0))}
                          </div>
                        </div>
                        <button
                          onClick={() => removeService(index)}
                          className="ml-2 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {editData.services.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No services added yet. Click "Add Service" to get started.
                  </div>
                )}
              </div>
            </div>

            {/* Materials */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Materials</h3>
                <button
                  onClick={addMaterial}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={16} className="mr-2 inline" />
                  Add Material
                </button>
              </div>
              
              <div className="space-y-4">
                {editData.materials.map((material, index) => (
                  <div key={material.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Material Name
                        </label>
                        <input
                          type="text"
                          value={material.name}
                          onChange={(e) => updateMaterial(index, 'name', e.target.value)}
                          placeholder="Material name"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={material.description}
                          onChange={(e) => updateMaterial(index, 'description', e.target.value)}
                          placeholder="Description"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={material.quantity}
                          onChange={(e) => updateMaterial(index, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Unit Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={material.unitPrice}
                          onChange={(e) => updateMaterial(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                        />
                      </div>
                      
                      <div className="flex items-end">
                        <div className="flex-1 text-right">
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total</div>
                          <div className="font-medium text-gray-800 dark:text-gray-100">
                            {formatCurrency((material.quantity || 0) * (material.unitPrice || 0))}
                          </div>
                        </div>
                        <button
                          onClick={() => removeMaterial(index)}
                          className="ml-2 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {editData.materials.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No materials added yet. Click "Add Material" to get started.
                  </div>
                )}
              </div>
            </div>

            {/* Payments */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Payments</h3>
                <button
                  onClick={addPayment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={16} className="mr-2 inline" />
                  Add Payment
                </button>
              </div>
              
              <div className="space-y-4">
                {editData.payments.map((payment, index) => (
                  <div key={payment.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          value={payment.date}
                          onChange={(e) => updatePayment(index, 'date', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Method
                        </label>
                        <select
                          value={payment.method}
                          onChange={(e) => updatePayment(index, 'method', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                        >
                          <option value="Cash">Cash</option>
                          <option value="Check">Check</option>
                          <option value="Credit Card">Credit Card</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={payment.amount}
                          onChange={(e) => updatePayment(index, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                        />
                      </div>
                      
                      <div className="flex items-end">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Memo
                          </label>
                          <input
                            type="text"
                            value={payment.memo}
                            onChange={(e) => updatePayment(index, 'memo', e.target.value)}
                            placeholder="Payment memo"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                          />
                        </div>
                        <button
                          onClick={() => removePayment(index)}
                          className="ml-2 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {editData.payments.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No payments recorded yet. Click "Add Payment" to get started.
                  </div>
                )}
              </div>
            </div>

            {/* Totals Summary */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Invoice Totals</h3>
              <div className="flex justify-end">
                <div className="w-80 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{formatCurrency(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Tax ({editData.taxRate}%)</span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{formatCurrency(totals.taxAmount)}</span>
                  </div>
                  <div className="border-t border-gray-300 dark:border-slate-600 pt-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-gray-900 dark:text-gray-100">Total</span>
                      <span className="text-gray-900 dark:text-gray-100">{formatCurrency(totals.total)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-gray-900 dark:text-gray-100">Payments</span>
                      <span className="text-gray-900 dark:text-gray-100">{formatCurrency(totalPaid)}</span>
                    </div>
                    <div className="border-t border-gray-300 dark:border-slate-600 pt-2 mt-2">
                      <div className="flex justify-between text-lg font-bold">
                        <span className="text-blue-600 dark:text-blue-400">Balance Due</span>
                        <span className="text-blue-600 dark:text-blue-400">{formatCurrency(balanceDue)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Internal Notes */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Internal Notes</h3>
              <textarea
                value={editData.notes}
                onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Internal notes (not visible to customer)"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
            </div>

            {/* Tags */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Tags</h3>
              <input
                type="text"
                value={editData.tags.join(', ')}
                onChange={(e) => setEditData(prev => ({ ...prev, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) }))}
                placeholder="Add tags separated by commas"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
              {editData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {editData.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Attachments */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Attachments</h3>
              <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center">
                <Paperclip size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Drag and drop files here, or click to browse</p>
                <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Choose Files
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="max-w-4xl mx-auto">
            <div className="invoice-preview">
              <InvoiceTemplate
                invoice={{...invoice, ...editData}}
                businessUnit={businessUnit}
                companyProfile={companyProfile}
                customer={customer}
              />
            </div>
            
            <div className="flex justify-center space-x-4 mt-6">
              <button
                onClick={() => setShowSendModal(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <Send size={16} className="mr-2" />
                Send to Customer
              </button>
              <button
                onClick={handleDownloadPDF}
                className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors flex items-center"
              >
                <Download size={16} className="mr-2" />
                Export PDF
              </button>
              <button
                onClick={handleDuplicate}
                className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center"
              >
                <Copy size={16} className="mr-2" />
                Duplicate
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Send Modal */}
      <SendInvoiceModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        invoice={invoice}
        onSend={handleSendToCustomer}
      />
    </div>
  );
};

export default InvoiceDetail;