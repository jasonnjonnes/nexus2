import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Send, Download, Copy, Edit, Save, X, Plus, Trash2,
  FileText, Pen, Check, DollarSign, Package, Phone, Mail, User,
  Tag, Paperclip, MessageSquare, Eye, Calculator
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, doc, getDoc, onSnapshot, updateDoc, addDoc, collection, query, where
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { db } from '../firebase';

// Helper functions
const formatCurrency = (amount: number | undefined | null): string => `$${amount != null ? amount.toFixed(2) : '0.00'}`;
const formatDate = (dateString: string | undefined | null): string => dateString ? new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

// Default business unit data fallback
const getBusinessUnitFallback = (estimate: any, companyProfile: any) => ({
  displayName: companyProfile?.companyName || estimate?.businessUnitName || 'Your Business',
  businessUnitName: companyProfile?.companyName || estimate?.businessUnitName || 'Your Business',
  logo: companyProfile?.logo || null,
  address: {
    street: companyProfile?.businessAddress || '',
    city: companyProfile?.city || '',
    state: companyProfile?.state || '',
    zip: companyProfile?.zipCode || ''
  },
  phoneNumber: companyProfile?.phoneNumber || '',
  email: companyProfile?.email || '',
  estimateAuthorization: companyProfile?.estimateAuthorization || 'By signing below, you authorize the work described above.',
  estimateMessage: companyProfile?.estimateMessage || 'Thank you for considering our services!'
});

// Send Modal Component
const SendEstimateModal = ({ isOpen, onClose, estimate, onSend }: { isOpen: boolean; onClose: () => void; estimate: any; onSend: () => void }) => {
  const [selectedMethod, setSelectedMethod] = useState('email');
  const [selectedContact, setSelectedContact] = useState('');
  const [customContact, setCustomContact] = useState('');
  const [message, setMessage] = useState('');

  const emailContacts = [
    estimate?.billTo?.email,
    estimate?.serviceLocation?.email,
    estimate?.customerEmail
  ].filter(Boolean);

  const phoneContacts = [
    estimate?.billTo?.phone,
    estimate?.serviceLocation?.phone,
    estimate?.customerPhone
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
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Send Estimate</h3>
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
            Send Estimate
          </button>
        </div>
      </div>
    </div>
  );
};

// Professional Estimate Template Component
const EstimateTemplate = ({ estimate, businessUnit, companyProfile }: { estimate: any; businessUnit: any; companyProfile: any }) => {
  if (!estimate) return <div className="p-8 text-center text-gray-500">Loading estimate...</div>;

  // Use fallback business unit data if not available
  const businessData = businessUnit || getBusinessUnitFallback(estimate, companyProfile);

  const totals = {
    subtotal: (estimate.services || []).reduce((sum: any, service: any) => sum + ((service.quantity || 0) * (service.unitPrice || 0)), 0) +
              (estimate.materials || []).reduce((sum: any, material: any) => sum + ((material.quantity || 0) * (material.unitPrice || 0)), 0),
    taxAmount: 0,
    total: 0
  };
  
  totals.taxAmount = totals.subtotal * ((estimate.taxRate || 0) / 100);
  totals.total = totals.subtotal + totals.taxAmount;

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-white p-8 border-b border-gray-200">
        <div className="flex justify-between items-start">
          <div className="flex items-center">
            {businessData.logo && (
              <img 
                src={businessData.logo} 
                alt={businessData.displayName}
                className="h-16 w-auto mr-6"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{businessData.displayName}</h1>
              {businessData.address && (businessData.address.street || businessData.address.city) && (
                <div className="text-sm text-gray-600 mt-1">
                  {businessData.address.street && <div>{businessData.address.street}</div>}
                  {(businessData.address.city || businessData.address.state || businessData.address.zip) && (
                    <div>{businessData.address.city}{businessData.address.state ? `, ${businessData.address.state}` : ''} {businessData.address.zip}</div>
                  )}
                  {businessData.phoneNumber && <div>{businessData.phoneNumber}</div>}
                  {businessData.email && <div>{businessData.email}</div>}
                </div>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className="bg-blue-600 text-white px-4 py-2 rounded-lg mb-3">
              <div className="text-lg font-bold">ESTIMATE</div>
              <div className="text-sm">{estimate.estimateNumber}</div>
            </div>
            <div className="text-sm text-gray-600">
              <div><strong>Estimate Date:</strong> {formatDate(estimate.createdAt)}</div>
              <div><strong>Valid Until:</strong> {formatDate(estimate.validUntil)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bill To and Job Address */}
      <div className="p-8 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Estimate For</h3>
            <div className="text-gray-900">
              <div className="font-semibold">{estimate.customerName}</div>
              {estimate.billTo?.company && <div>{estimate.billTo.company}</div>}
              {estimate.billTo?.address && (
                <div className="text-sm text-gray-600 mt-1">
                  {estimate.billTo.address.split(',').map((line: any, index: any) => (
                    <div key={index}>{line.trim()}</div>
                  ))}
                </div>
              )}
              {estimate.billTo?.phone && <div className="text-sm text-gray-600 mt-1">{estimate.billTo.phone}</div>}
              {estimate.billTo?.email && <div className="text-sm text-gray-600">{estimate.billTo.email}</div>}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Job Address</h3>
            <div className="text-gray-900">
              <div className="font-semibold">{estimate.serviceLocation?.name || estimate.customerName}</div>
              {estimate.serviceLocation?.address && (
                <div className="text-sm text-gray-600 mt-1">
                  {estimate.serviceLocation.address.split(',').map((line: any, index: any) => (
                    <div key={index}>{line.trim()}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description of Work */}
      {(estimate.description || estimate.summary) && (
        <div className="p-8 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3 text-center">
            Description of Work
          </h3>
          <div className="text-gray-800 text-center">
            <div dangerouslySetInnerHTML={{ __html: estimate.description || estimate.summary }} />
          </div>
        </div>
      )}

      {/* Line Items */}
      <div className="p-8 border-b border-gray-200">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-3 text-sm font-semibold text-blue-600 uppercase tracking-wider">Item</th>
              <th className="text-left py-3 text-sm font-semibold text-blue-600 uppercase tracking-wider">Description</th>
              <th className="text-center py-3 text-sm font-semibold text-blue-600 uppercase tracking-wider">QTY</th>
              <th className="text-right py-3 text-sm font-semibold text-blue-600 uppercase tracking-wider">Price</th>
              <th className="text-right py-3 text-sm font-semibold text-blue-600 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            {(estimate.services || []).map((service: any, index: any) => (
              <tr key={`service-${index}`} className="border-b border-gray-200">
                <td className="py-3 text-sm text-gray-900">{service.name}</td>
                <td className="py-3 text-sm text-gray-600">
                  <div dangerouslySetInnerHTML={{ __html: service.description || '' }} />
                </td>
                <td className="py-3 text-sm text-center text-gray-900">{service.quantity}</td>
                <td className="py-3 text-sm text-right text-gray-900">{formatCurrency(service.unitPrice)}</td>
                <td className="py-3 text-sm text-right text-gray-900 font-semibold">{formatCurrency((service.quantity || 0) * (service.unitPrice || 0))}</td>
              </tr>
            ))}
            {(estimate.materials || []).map((material: any, index: any) => (
              <tr key={`material-${index}`} className="border-b border-gray-200">
                <td className="py-3 text-sm text-gray-900">{material.name}</td>
                <td className="py-3 text-sm text-gray-600">
                  <div dangerouslySetInnerHTML={{ __html: material.description || '' }} />
                </td>
                <td className="py-3 text-sm text-center text-gray-900">{material.quantity}</td>
                <td className="py-3 text-sm text-right text-gray-900">{formatCurrency(material.unitPrice)}</td>
                <td className="py-3 text-sm text-right text-gray-900 font-semibold">{formatCurrency((material.quantity || 0) * (material.unitPrice || 0))}</td>
              </tr>
            ))}
            
            {/* Show placeholder rows if no items */}
            {(estimate.services || []).length === 0 && (estimate.materials || []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  No items added yet. Switch to Edit mode to add services and materials.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="p-8 border-b border-gray-200">
        <div className="flex justify-end">
          <div className="w-80">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Sub-Total</span>
                <span className="text-gray-900 font-semibold">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span className="text-gray-900">{formatCurrency(totals.taxAmount)}</span>
              </div>
              <div className="border-t border-gray-300 pt-2">
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-blue-600">Total</span>
                  <span className="text-blue-600">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Authorization Paragraph */}
      {businessData.estimateAuthorization && (
        <div className="p-8 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Authorization</h3>
          <div className="text-sm text-gray-600">
            {businessData.estimateAuthorization}
          </div>
          <div className="mt-6 border-t border-gray-300 pt-4">
            <div className="text-sm text-gray-500">Customer Signature: _________________________ Date: ___________</div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-8 bg-gray-50">
        <div className="text-sm text-gray-600 text-center">
          <div className="font-semibold text-gray-900">{businessData.displayName}</div>
          {businessData.estimateMessage && (
            <div className="mt-2">{businessData.estimateMessage}</div>
          )}
          {businessData.address && (businessData.address.street || businessData.address.city) && (
            <div className="mt-2">
              {businessData.address.street}{businessData.address.city ? `, ${businessData.address.city}` : ''}{businessData.address.state ? `, ${businessData.address.state}` : ''} {businessData.address.zip}
            </div>
          )}
          {businessData.phoneNumber && <div>{businessData.phoneNumber}</div>}
        </div>
        
        <div className="text-center mt-4 text-xs text-gray-500">
          Estimate #{estimate.estimateNumber} - Page 1 of 1
        </div>
      </div>
    </div>
  );
};

const EstimateDetail = () => {
  const { estimateId } = useParams();
  const navigate = useNavigate();
  const { user, tenantId } = useFirebaseAuth();
  const userId = user?.uid;
  const [estimate, setEstimate] = useState(null);
  const [businessUnit, setBusinessUnit] = useState(null);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('edit');
  const [showSendModal, setShowSendModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit state
  const [editData, setEditData] = useState({
    summary: '',
    description: '',
    services: [],
    materials: [],
    notes: '',
    tags: [],
    attachments: [],
    taxRate: 0
  });

  // Only fetch data if db and userId are present
  useEffect(() => {
    if (!db || !userId) return;
    // ... fetch company profile, estimate, etc. as before ...
  }, [db, userId, estimateId]);

  // Save estimate
  const saveEstimate = useCallback(async () => {
    if (!estimate || !db) return;

    setIsSaving(true);
    try {
      const updatedData = {
        ...editData,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'tenants', tenantId, 'estimates', estimate.id), updatedData);
    } catch (error) {
      console.error('Error saving estimate:', error);
      alert('Failed to save estimate. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [estimate, editData, db]);

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

  // Update service
  const updateService = (index: any, field: any, value: any) => {
    setEditData(prev => ({
      ...prev,
      services: prev.services.map((service: any, i: any) => 
        i === index ? { ...service, [field]: value } : service
      )
    }));
  };

  // Update material
  const updateMaterial = (index: any, field: any, value: any) => {
    setEditData(prev => ({
      ...prev,
      materials: prev.materials.map((material: any, i: any) => 
        i === index ? { ...material, [field]: value } : material
      )
    }));
  };

  // Remove service
  const removeService = (index: any) => {
    setEditData(prev => ({
      ...prev,
      services: prev.services.filter((_, i: any) => i !== index)
    }));
  };

  // Remove material
  const removeMaterial = (index: any) => {
    setEditData(prev => ({
      ...prev,
      materials: prev.materials.filter((_, i: any) => i !== index)
    }));
  };

  const handleSendToCustomer = useCallback(async (method: any, contact: any, message: any) => {
    if (!estimate) return;
    
    try {
      // Create email/SMS notification record
      const notificationData = {
        type: 'estimate',
        method: method,
        estimateId: estimate.id,
        recipientContact: contact,
        subject: `Estimate ${estimate.estimateNumber} from ${businessUnit?.displayName || companyProfile?.companyName || 'Your Business'}`,
        message: message,
        status: 'sent',
        sentAt: new Date().toISOString(),
        userId: userId
      };
      
      await addDoc(collection(db, 'tenants', tenantId, 'notifications'), notificationData);
      
      // Update estimate status
      await updateDoc(doc(db, 'tenants', tenantId, 'estimates', estimate.id), {
        status: 'sent',
        sentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      alert(`Estimate sent via ${method} successfully!`);
    } catch (error) {
      console.error('Error sending estimate:', error);
      alert('Failed to send estimate. Please try again.');
    }
  }, [estimate, businessUnit, companyProfile, db, userId]);

  const handleDownloadPDF = useCallback(async () => {
    if (!estimate) return;
    
    try {
      // Import jsPDF dynamically
      const { jsPDF } = await import('jspdf');
      const html2canvas = await import('html2canvas');
      
      // Get the preview content
      const element = document.querySelector('.estimate-preview');
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

      pdf.save(`Estimate_${estimate.estimateNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Using print fallback.');
      window.print();
    }
  }, [estimate]);

  const handleDuplicate = useCallback(async () => {
    if (!estimate || !db || !userId || !tenantId) return;
    
    try {
      const duplicatedEstimate = {
        ...estimate,
        ...editData,
        estimateNumber: `${estimate.estimateNumber}-COPY`,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sentAt: null
      };
      
      delete duplicatedEstimate.id;
      
      const docRef = await addDoc(collection(db, 'tenants', tenantId, 'estimates'), duplicatedEstimate);
      navigate(`/estimate/${docRef.id}`);
    } catch (error) {
      console.error('Error duplicating estimate:', error);
      alert('Failed to duplicate estimate. Please try again.');
    }
  }, [estimate, editData, db, userId, tenantId, navigate]);

  // Calculate totals
  const totals = {
    subtotal: (editData.services || []).reduce((sum: any, service: any) => sum + ((service.quantity || 0) * (service.unitPrice || 0)), 0) +
              (editData.materials || []).reduce((sum: any, material: any) => sum + ((material.quantity || 0) * (material.unitPrice || 0)), 0),
    taxAmount: 0,
    total: 0
  };
  
  totals.taxAmount = totals.subtotal * ((editData.taxRate || 0) / 100);
  totals.total = totals.subtotal + totals.taxAmount;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600 dark:text-gray-300">Loading estimate...</p>
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

  if (!estimate) {
    return (
      <div className="p-6 text-center text-gray-600 dark:text-gray-400">
        Estimate not found
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
                Estimate {estimate.estimateNumber}
              </h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                <span>{estimate.customerName}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  estimate.status === 'draft' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' :
                  estimate.status === 'sent' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                  estimate.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}>
                  {estimate.status}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  Total: {formatCurrency(totals.total)}
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
            {/* Estimate Summary */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Estimate Summary</h3>
                <button
                  onClick={saveEstimate}
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
                  placeholder="Detailed description of work to be performed"
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
                {editData.services.map((service: any, index: any) => (
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
                {editData.materials.map((material: any, index: any) => (
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

            {/* Totals Summary */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Estimate Totals</h3>
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
                      <span className="text-blue-600 dark:text-blue-400">Total</span>
                      <span className="text-blue-600 dark:text-blue-400">{formatCurrency(totals.total)}</span>
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
                  {editData.tags.map((tag: any) => (
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
            <div className="estimate-preview">
              <EstimateTemplate
                estimate={{...estimate, ...editData}}
                businessUnit={businessUnit}
                companyProfile={companyProfile}
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
      <SendEstimateModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        estimate={estimate}
        onSend={handleSendToCustomer}
      />
    </div>
  );
};

export default EstimateDetail;