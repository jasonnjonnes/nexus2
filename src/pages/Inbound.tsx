import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, MapPin, Calendar, Plus, Phone, User, Building, Mail, MessageSquare, AlertCircle, 
         Inbox, Users, MoreHorizontal, Bell, Settings, Filter, GripVertical, Reply, Forward, Paperclip } from 'lucide-react';
import { db } from '../firebase';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { useCache } from '../contexts/CacheContext';

// Helper function to safely format dates
const formatEmailDate = (dateValue: any): string => {
  if (!dateValue) return 'Unknown';
  
  try {
    let date: Date;
    
    // Handle Firebase Timestamp objects
    if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
      date = new Date(dateValue.seconds * 1000);
    }
    // Handle Firebase Timestamp with toDate method
    else if (dateValue && typeof dateValue.toDate === 'function') {
      date = dateValue.toDate();
    }
    // Handle regular date objects or strings
    else {
      date = new Date(dateValue);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Unknown';
    }
    
    return date.toLocaleString();
  } catch (error) {
    console.warn('Error formatting date:', error);
    return 'Unknown';
  }
};

// Helper function to sanitize and style HTML content
const sanitizeEmailHTML = (htmlContent: string): string => {
  if (!htmlContent) return '';
  
  // Basic HTML sanitization - remove potentially dangerous elements and attributes
  let sanitized = htmlContent
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
    .replace(/javascript:/gi, ''); // Remove javascript: links
  
  // Add responsive styles to images
  sanitized = sanitized.replace(/<img([^>]*?)>/gi, '<img$1 style="max-width: 100%; height: auto; border-radius: 4px;">');
  
  // Style links
  sanitized = sanitized.replace(/<a([^>]*?)>/gi, '<a$1 style="color: #3b82f6; text-decoration: underline;" target="_blank" rel="noopener noreferrer">');
  
  return sanitized;
};
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  setDoc,
  getDocs
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { NotificationProvider } from '../contexts/NotificationContext';
import TopNavigation from '../components/TopNavigation';
import DialpadCTI from '../components/DialpadCTI';
import FirebaseEmailInterface from '../components/FirebaseEmailInterface';

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
        const addressComponents: {
          streetNumber?: string;
          route?: string;
          city?: string;
          state?: string;
          zip?: string;
        } = {};
        
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
        try {
          // @ts-ignore - Google Maps API types may vary
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        } catch (error) {
          // Ignore cleanup errors
        }
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

// Draggable Section Component for Inbox
const DraggableSection = ({ 
  id, 
  title, 
  icon: Icon, 
  count, 
  items, 
  color = 'blue',
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  isDropTarget
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300',
    gray: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, id)}
      data-section={id}
      className={`
        bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 
        transition-all duration-200 cursor-move hover:shadow-lg
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${isDropTarget ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
      `}
    >
      {/* Section Header */}
      <div className={`px-4 py-3 rounded-t-xl border-b border-gray-100 dark:border-slate-700 ${colorClasses[color]}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <GripVertical size={16} className="text-gray-400 dark:text-gray-500" />
            <Icon size={18} />
            <h3 className="font-semibold text-sm">{title}</h3>
            {count > 0 && (
              <span className="bg-white dark:bg-slate-700 text-xs font-medium px-2 py-1 rounded-full shadow-sm">
                {count}
              </span>
            )}
          </div>
          <button className="p-1 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded transition-colors">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Section Content */}
      <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
        {/* Show sample email items for preview in the draggable section */}
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Icon size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No {title.toLowerCase()} yet</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={index}
              className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors group"
            >
              <div className="flex-shrink-0 mr-3">
                {item.avatar ? (
                  <img src={item.avatar} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClasses[color]}`}>
                    <Icon size={14} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {item.name}
                  </p>
                  {item.time && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      {item.time}
                    </span>
                  )}
                </div>
                {item.message && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">
                    {item.message}
                  </p>
                )}
                {item.status && (
                  <div className="flex items-center mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.status === 'online' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      item.status === 'busy' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                )}
              </div>
              {item.unread && (
                <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
              )}
            </div>
          ))
        )}
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

  const { user, tenantId } = useFirebaseAuth();
  const userId = user?.uid || null;
  const cache = useCache();

  // Theme handling (previously in Layout)
  const getInitialTheme = () => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleSidebar = () => {
    /* Future implementation: open / close sidebar */
  };

  // Dialpad CTI configuration
  const dialpadClientId = 'q3QPMk5mVP44sraUP7ngse3ER';

  const handleIncomingCall = (callData: any) => {
    console.log('Incoming call:', callData);
  };

  const handleDialpadAuth = (authenticated: boolean, userId: number | null) => {
    console.log('Dialpad authentication changed:', { authenticated, userId });
  };

  // Inbox state for omnichat interface
  const [inboxSearchTerm, setInboxSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [activeInboxTab, setActiveInboxTab] = useState('inbox'); // Add inbox tab state

  // Conversation state for inbox
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [inboxView, setInboxView] = useState('conversations'); // 'conversations', 'team', 'calls', 'emails'
  const [isComposingEmail, setIsComposingEmail] = useState(false);
  const [emailComposeData, setEmailComposeData] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
    attachments: [] as File[]
  });
  const [conversations, setConversations] = useState([
    {
      id: 1,
      customer: 'Winsfrey Salonke',
      email: 'winsfreysalonke@gmail.com',
      lastMessage: 'Hello support! I have gone through your product documentation...',
      timestamp: '2m ago',
      unread: true,
      status: 'Not Verified',
      team: 'Support',
      avatarColor: 'bg-pink-500'
    },
    {
      id: 2,
      customer: 'Sarah Johnson',
      email: 'sarah.johnson@email.com',
      lastMessage: 'Hi, I need help with my recent order...',
      timestamp: '2m ago',
      unread: true,
      status: 'Verified',
      team: 'Sales',
      avatarColor: 'bg-blue-500'
    },
    {
      id: 3,
      customer: 'Mike Wilson',
      email: 'mike.wilson@email.com',
      lastMessage: 'Thanks for the quick response!',
      timestamp: '15m ago',
      unread: false,
      status: 'Verified',
      team: 'Support',
      avatarColor: 'bg-green-500'
    },
    {
      id: 4,
      customer: 'Emma Davis',
      email: 'emma.davis@email.com',
      lastMessage: 'When will my appointment be scheduled?',
      timestamp: '1h ago',
      unread: true,
      status: 'Verified',
      team: 'Scheduling',
      avatarColor: 'bg-purple-500'
    }
  ]);

  // Sample data for inbox sections - replace with real data from your backend
  const [inboxSections, setInboxSections] = useState([
    {
      id: 'inbox',
      title: 'Your Inbox',
      icon: Inbox,
      color: 'blue',
      count: 12,
      items: [
        {
          name: 'Sarah Johnson',
          message: 'Hi, I need help with my recent order...',
          time: '2m ago',
          unread: true,
          avatar: null
        },
        {
          name: 'Mike Wilson',
          message: 'Thanks for the quick response!',
          time: '15m ago',
          unread: false,
          avatar: null
        },
        {
          name: 'Emma Davis',
          message: 'When will my appointment be scheduled?',
          time: '1h ago',
          unread: true,
          avatar: null
        }
      ]
    },
    {
      id: 'customer-chats',
      title: 'Customer Chats',
      icon: MessageSquare,
      color: 'green',
      count: 8,
      items: [
        {
          name: 'John Smith',
          message: 'I have a question about pricing...',
          time: '5m ago',
          unread: true,
          avatar: null
        },
        {
          name: 'Lisa Brown',
          message: 'Perfect, see you tomorrow!',
          time: '30m ago',
          unread: false,
          avatar: null
        }
      ]
    },
    {
      id: 'calls',
      title: 'Calls',
      icon: Phone,
      color: 'purple',
      count: 3,
      items: [
        {
          name: 'David Lee',
          message: 'Missed call',
          time: '10m ago',
          unread: true,
          avatar: null
        },
        {
          name: 'Anna Taylor',
          message: 'Call completed - 5 min',
          time: '45m ago',
          unread: false,
          avatar: null
        }
      ]
    },
    {
      id: 'emails',
      title: 'Emails',
      icon: Mail,
      color: 'orange',
      count: 3,
      items: [
        {
          name: 'Sarah Johnson',
          message: 'HVAC Service Request - Need maintenance',
          time: '2h ago',
          unread: true,
          avatar: null
        },
        {
          name: 'Mike Wilson',
          message: 'Re: Invoice #1234 - Payment processed',
          time: '4h ago',
          unread: true,
          avatar: null
        },
        {
          name: 'Emma Davis',
          message: 'Quote Request - Plumbing installation',
          time: '1d ago',
          unread: false,
          avatar: null
        }
      ]
    },
    {
      id: 'office',
      title: 'Office',
      icon: Building,
      color: 'gray',
      count: 5,
      items: [
        {
          name: 'Office Manager',
          message: 'Team meeting at 3 PM',
          time: '20m ago',
          status: 'online',
          unread: false,
          avatar: null
        },
        {
          name: 'HR Department',
          message: 'Please review the new policy',
          time: '1h ago',
          status: 'busy',
          unread: true,
          avatar: null
        },
        {
          name: 'Accounting',
          message: 'Monthly reports ready',
          time: '2h ago',
          status: 'offline',
          unread: false,
          avatar: null
        }
      ]
    },
    {
      id: 'technicians',
      title: 'Technicians',
      icon: Users,
      color: 'indigo',
      count: 8,
      items: [
        {
          name: 'Tom Rodriguez',
          message: 'Job completed successfully',
          time: '30m ago',
          status: 'online',
          unread: false,
          avatar: null
        },
        {
          name: 'Alex Johnson',
          message: 'Need parts for current job',
          time: '45m ago',
          status: 'busy',
          unread: true,
          avatar: null
        },
        {
          name: 'Maria Garcia',
          message: 'Running late to next appointment',
          time: '1h ago',
          status: 'online',
          unread: true,
          avatar: null
        }
      ]
    }
  ]);

  // Drag and drop handlers for inbox
  const handleDragStart = (e, sectionId) => {
    setDraggedItem(sectionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetSectionId) => {
    e.preventDefault();
    
    if (draggedItem && draggedItem !== targetSectionId) {
      const draggedIndex = inboxSections.findIndex(s => s.id === draggedItem);
      const targetIndex = inboxSections.findIndex(s => s.id === targetSectionId);
      
      const newSections = [...inboxSections];
      const [draggedSection] = newSections.splice(draggedIndex, 1);
      newSections.splice(targetIndex, 0, draggedSection);
      
      setInboxSections(newSections);
    }
    
    setDraggedItem(null);
    setDropTarget(null);
  };

  const handleDragEnter = (e, sectionId) => {
    if (draggedItem && draggedItem !== sectionId) {
      setDropTarget(sectionId);
    }
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const totalUnread = inboxSections.reduce((total, section) => {
    return total + section.items.filter(item => item.unread).length;
  }, 0);

  // Email handlers
  const handleEmailReply = (email) => {
    setEmailComposeData({
      to: email.from,
      cc: '',
      bcc: '',
      subject: email.subject.startsWith('Re: ') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n--- Original Message ---\nFrom: ${email.from}\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.body}`,
      attachments: []
    });
    setIsComposingEmail(true);
  };

  const handleEmailForward = (email) => {
    setEmailComposeData({
      to: '',
      cc: '',
      bcc: '',
      subject: email.subject.startsWith('Fwd: ') ? email.subject : `Fwd: ${email.subject}`,
      body: `\n\n--- Forwarded Message ---\nFrom: ${email.from}\nTo: ${email.to}\nSubject: ${email.subject}\nDate: ${email.receivedAt ? new Date(email.receivedAt.seconds ? email.receivedAt.seconds * 1000 : email.receivedAt).toLocaleString() : 'Unknown'}\n\n${email.body}`,
      attachments: []
    });
    setIsComposingEmail(true);
  };

  // Manage loading state
  useEffect(() => {
    if (db && userId && tenantId) {
      setIsLoading(false);
    }
  }, [db, userId, tenantId]);

  // Load customers with caching
  useEffect(() => {
    if (!db || !userId || !tenantId) return;

    const loadCustomers = async () => {
      const cacheKey = `customers_${tenantId}_${userId}`;
      
      // Try to get from cache first
      const cachedCustomers = cache.get<any[]>(cacheKey);
      if (cachedCustomers) {
        setCustomers(cachedCustomers);
        return;
      }

      // If not in cache, load from Firebase
      try {
        cache.setLoading(cacheKey, true);
        
        const q = query(
          collection(db, 'tenants', tenantId, 'customers'),
          where("userId", "==", userId)
        );
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const customersData = [];
          querySnapshot.forEach((doc) => {
            customersData.push({ id: doc.id, ...doc.data() });
          });
          
          // Update cache and state
          cache.set(cacheKey, customersData, 15); // Cache for 15 minutes
          setCustomers(customersData);
          cache.setLoading(cacheKey, false);
        }, (error) => {
          console.error("Error loading customers:", error);
          cache.setLoading(cacheKey, false);
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error("Error setting up customers listener:", error);
        cache.setLoading(cacheKey, false);
      }
    };

    loadCustomers();
  }, [db, userId, tenantId, cache]);

  // Load business units with caching
  useEffect(() => {
    if (!db || !userId || !tenantId) return;

    const loadBusinessUnits = async () => {
      const cacheKey = `business_units_${tenantId}_${userId}`;
      
      // Try to get from cache first
      const cachedBusinessUnits = cache.get<any[]>(cacheKey);
      if (cachedBusinessUnits) {
        setBusinessUnits(cachedBusinessUnits);
        return;
      }

      // If not in cache, load from Firebase
      try {
        cache.setLoading(cacheKey, true);
        
        const businessUnitsQuery = query(
          collection(db, 'tenants', tenantId, 'businessUnits'),
          where("userId", "==", userId),
          where("status", "==", "active")
        );
        
        const unsubscribe = onSnapshot(businessUnitsQuery, (querySnapshot) => {
          const businessUnitsData = [];
          querySnapshot.forEach((doc) => {
            businessUnitsData.push({ id: doc.id, ...doc.data() });
          });
          
          // Update cache and state
          cache.set(cacheKey, businessUnitsData, 60); // Cache for 1 hour
          setBusinessUnits(businessUnitsData);
          cache.setLoading(cacheKey, false);
        }, (error) => {
          console.error("Error loading business units:", error);
          cache.setLoading(cacheKey, false);
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error("Error setting up business units listener:", error);
        cache.setLoading(cacheKey, false);
      }
    };

    loadBusinessUnits();
  }, [db, userId, tenantId, cache]);

  // Load job types with caching
  useEffect(() => {
    if (!db || !userId || !tenantId) return;

    const loadJobTypes = async () => {
      const cacheKey = `job_types_${tenantId}_${userId}`;
      
      // Try to get from cache first
      const cachedJobTypes = cache.get<any[]>(cacheKey);
      if (cachedJobTypes) {
        setJobTypes(cachedJobTypes);
        return;
      }

      // If not in cache, load from Firebase
      try {
        cache.setLoading(cacheKey, true);
        
        const jobTypesQuery = query(
          collection(db, 'tenants', tenantId, 'jobTypes'),
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
            const defaultJobTypes = [
              { id: 'default-1', name: 'AC Repair' },
              { id: 'default-2', name: 'HVAC Maintenance' },
              { id: 'default-3', name: 'Plumbing Repair' },
              { id: 'default-4', name: 'Electrical Work' },
              { id: 'default-5', name: 'System Installation' }
            ];
            setJobTypes(defaultJobTypes);
            cache.set(cacheKey, defaultJobTypes, 120); // Cache defaults for 2 hours
          } else {
            // Update cache and state
            cache.set(cacheKey, jobTypesData, 120); // Cache for 2 hours
            setJobTypes(jobTypesData);
          }
          cache.setLoading(cacheKey, false);
        }, (error) => {
          console.error("Error loading job types:", error);
          // Fallback to default job types
          const defaultJobTypes = [
            { id: 'default-1', name: 'AC Repair' },
            { id: 'default-2', name: 'HVAC Maintenance' },
            { id: 'default-3', name: 'Plumbing Repair' },
            { id: 'default-4', name: 'Electrical Work' },
            { id: 'default-5', name: 'System Installation' }
          ];
          setJobTypes(defaultJobTypes);
          cache.set(cacheKey, defaultJobTypes, 120);
          cache.setLoading(cacheKey, false);
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error("Error setting up job types listener:", error);
        cache.setLoading(cacheKey, false);
      }
    };

    loadJobTypes();
  }, [db, userId, tenantId, cache]);

  // Load active technicians with caching
  useEffect(() => {
    if (!db || !userId || !tenantId) return;

    const loadTechnicians = async () => {
      const cacheKey = `technicians_${tenantId}_${userId}`;
      
      // Try to get from cache first
      const cachedTechnicians = cache.get<any[]>(cacheKey);
      if (cachedTechnicians) {
        setTechnicians(cachedTechnicians);
        return;
      }

      // If not in cache, load from Firebase
      try {
        cache.setLoading(cacheKey, true);
        
        const techQuery = query(
          collection(db, 'tenants', tenantId, 'staff'),
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
          
          // Update cache and state
          cache.set(cacheKey, techData, 60); // Cache for 1 hour
          setTechnicians(techData);
          cache.setLoading(cacheKey, false);
        }, (error) => {
          console.error("Error loading technicians:", error);
          cache.setLoading(cacheKey, false);
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error("Error setting up technicians listener:", error);
        cache.setLoading(cacheKey, false);
      }
    };

    loadTechnicians();
  }, [db, userId, tenantId, cache]);

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
    if (db && userId && tenantId) {
      try {
        const customerDataWithUser = {
          ...newCustomerData,
          userId: userId
        };
        
        const customId = `customer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await setDoc(doc(db, 'tenants', tenantId, 'customers', customId), customerDataWithUser);
        setShowCreateCustomer(false);
      } catch (e) {
        console.error("Error creating customer:", e);
        setError("Failed to create customer");
      }
    }
  }, [db, userId, tenantId]);

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
    if (!selectedCustomer || !db || !userId || !tenantId) {
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
      const jobDocRef = await addDoc(collection(db, 'tenants', tenantId, 'jobs'), jobData);
      
      // Navigate to the job detail page
      navigate(`/job/${jobDocRef.id}`);
      
    } catch (error) {
      console.error('Error creating job:', error);
      alert('Failed to create job. Please try again.');
    }
  };

  const handleSaveAsLead = async () => {
    if (!selectedCustomer || !db || !userId || !tenantId) {
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

      await addDoc(collection(db, 'tenants', tenantId, 'leads'), leadData);
      
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
    <>
      {/* CSS styles for email content */}
      <style>{`
        .email-content p {
          margin: 0.5em 0;
        }
        .email-content p:first-child {
          margin-top: 0;
        }
        .email-content p:last-child {
          margin-bottom: 0;
        }
        .email-content ul, .email-content ol {
          margin: 0.5em 0;
          padding-left: 1.5em;
        }
        .email-content li {
          margin: 0.25em 0;
        }
        .email-content blockquote {
          margin: 0.5em 0;
          padding-left: 1em;
          border-left: 3px solid #e5e7eb;
          font-style: italic;
          color: #6b7280;
        }
        .dark .email-content blockquote {
          border-left-color: #4b5563;
          color: #9ca3af;
        }
        .email-content h1, .email-content h2, .email-content h3, .email-content h4, .email-content h5, .email-content h6 {
          margin: 0.75em 0 0.25em 0;
          font-weight: 600;
        }
        .email-content h1 { font-size: 1.25em; }
        .email-content h2 { font-size: 1.125em; }
        .email-content h3 { font-size: 1em; }
        .email-content strong, .email-content b {
          font-weight: 600;
        }
        .email-content em, .email-content i {
          font-style: italic;
        }
        .email-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.5em 0;
        }
        .email-content td, .email-content th {
          border: 1px solid #e5e7eb;
          padding: 0.25em 0.5em;
          text-align: left;
        }
        .dark .email-content td, .dark .email-content th {
          border-color: #4b5563;
        }
        .email-content th {
          background-color: #f9fafb;
          font-weight: 600;
        }
        .dark .email-content th {
          background-color: #374151;
        }
      `}</style>
      
      {/* Everything that was previously inside return goes here, including NotificationProvider, main content, floating compose area, etc. */}
      <NotificationProvider>
        <div className="h-screen bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 transition-colors overflow-hidden">
          {/* Top navigation bar */}
          <TopNavigation
            toggleSidebar={toggleSidebar}
            theme={theme}
            toggleTheme={toggleTheme}
          />

          {/* Main Inbound Content - Full Width */}
          <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 dark:bg-slate-900 overflow-hidden">
            {/* Top Navigation Tabs */}
            <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm">
              <div className="px-4 py-3">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('newjob')}
                    className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'newjob'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                    }`}
                  >
                    New Job
                  </button>
                  <button
                    onClick={() => setActiveTab('calls')}
                    className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'calls'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                    }`}
                  >
                    Calls
                    <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-sm">1</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('inbox')}
                    className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'inbox'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                    }`}
                  >
                    Inbox
                    {totalUnread > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-sm">
                        {totalUnread}
                      </span>
                    )}
                  </button>

                </nav>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto w-full">
              {activeTab === 'newjob' && (
                <div className="max-w-7xl mx-auto p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">New Job</h1>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">Create a new job or lead for your customers</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button className="group relative overflow-hidden bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6 hover:shadow-lg hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-200">
                        <div className="flex items-center text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-4">
                            <Plus size={20} className="text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold">Manual Job</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Create a job manually</div>
                          </div>
                        </div>
                      </button>

                      <button className="group relative overflow-hidden bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-2 border-blue-200 dark:border-blue-500/50 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
                        <div className="flex items-center text-blue-700 dark:text-blue-300">
                          <div className="w-12 h-12 bg-blue-200 dark:bg-blue-800/50 rounded-lg flex items-center justify-center mr-4">
                            <Phone size={20} className="text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold">Manual Call</div>
                            <div className="text-sm text-blue-600 dark:text-blue-400">Log a phone call</div>
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Main Job Form */}
                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm">
                      <div className="p-8">
                        {/* Customer Search Section */}
                        <div className="mb-8">
                          <div className="flex items-center justify-between mb-6">
                            <div>
                              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Customer & Location</h2>
                              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Search for existing customer or create new</p>
                            </div>
                            <button 
                              onClick={() => setShowCreateCustomer(true)}
                              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            >
                              <Plus size={16} className="mr-2" />
                              New Customer
                            </button>
                          </div>

                          <div className="relative mb-6">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input 
                              type="text" 
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              placeholder="Search by customer name, email, phone, or address..."
                              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                            />
                            
                            {/* Search Results Dropdown */}
                            {filteredCustomers.length > 0 && (
                              <div className="absolute z-10 w-full mt-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                {filteredCustomers.map(customer => (
                                  <div
                                    key={customer.id}
                                    onClick={() => handleCustomerSelect(customer)}
                                    className="p-4 hover:bg-gray-50 dark:hover:bg-slate-600 cursor-pointer border-b border-gray-100 dark:border-slate-600 last:border-b-0 transition-colors"
                                  >
                                    <div className="flex items-center">
                                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mr-3">
                                        <User size={16} className="text-blue-600 dark:text-blue-400" />
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-medium text-gray-900 dark:text-gray-100">{customer.name}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                          {customer.email} • {customer.phone}
                                        </div>
                                        {customer.locations?.[0] && (
                                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
                            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="w-10 h-10 bg-blue-200 dark:bg-blue-800/50 rounded-full flex items-center justify-center mr-3">
                                    <User size={16} className="text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-blue-900 dark:text-blue-100">{selectedCustomer.name}</div>
                                    <div className="text-sm text-blue-700 dark:text-blue-300">
                                      {selectedCustomer.email} • {selectedCustomer.phone}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedCustomer(null);
                                    setSearchTerm('');
                                  }}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Job Details Section */}
                        <div className="border-t border-gray-200 dark:border-slate-700 pt-8">
                          <div className="mb-6">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Job Details</h2>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Configure the job settings and requirements</p>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job Type *</label>
                              <select 
                                name="jobType"
                                value={jobForm.jobType}
                                onChange={handleJobFormChange}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Business Unit</label>
                              <select 
                                name="businessUnit"
                                value={jobForm.businessUnit}
                                onChange={handleJobFormChange}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                              >
                                <option value="">Select business unit...</option>
                                {businessUnits.map(unit => (
                                  <option key={unit.id} value={unit.businessUnitName}>
                                    {unit.businessUnitName}
                                  </option>
                                ))}
                              </select>
                              {businessUnits.length === 0 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center">
                                  <AlertCircle size={12} className="mr-1" />
                                  No business units found. Add business units in Settings → Business Units.
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Marketing Campaign</label>
                              <select 
                                name="marketingCampaign"
                                value={jobForm.marketingCampaign}
                                onChange={handleJobFormChange}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                              >
                                <option value="">Select campaign...</option>
                                <option value="Summer Special">Summer Special</option>
                                <option value="Emergency Service">Emergency Service</option>
                                <option value="Maintenance Plan">Maintenance Plan</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priority</label>
                              <select 
                                name="priority"
                                value={jobForm.priority}
                                onChange={handleJobFormChange}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                              >
                                <option value="Normal">Normal</option>
                                <option value="High">High</option>
                                <option value="Emergency">Emergency</option>
                              </select>
                            </div>
                          </div>

                          {/* Scheduling Section */}
                          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-6 mb-6">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                              <Calendar size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
                              Scheduling
                            </h3>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date *</label>
                                <input 
                                  type="date"
                                  name="startDate"
                                  value={jobForm.startDate}
                                  onChange={handleJobFormChange}
                                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Arrival Window</label>
                                <select 
                                  name="arrivalWindow"
                                  value={jobForm.arrivalWindow}
                                  onChange={handleJobFormChange}
                                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                >
                                  <option value="">Select window...</option>
                                  <option value="8am-12pm">8am-12pm</option>
                                  <option value="12pm-5pm">12pm-5pm</option>
                                  <option value="5pm-8pm">5pm-8pm</option>
                                  <option value="custom">Custom arrival window</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Time</label>
                                <input 
                                  type="time"
                                  name="startTime"
                                  value={jobForm.startTime}
                                  onChange={handleJobFormChange}
                                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                />
                              </div>
                            </div>

                            {/* Custom Arrival Window Fields */}
                            {showCustomArrival && (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Arrival Window Start</label>
                                  <input 
                                    type="datetime-local"
                                    name="customArrivalStart"
                                    value={jobForm.customArrivalStart}
                                    onChange={handleJobFormChange}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Arrival Window End</label>
                                  <input 
                                    type="datetime-local"
                                    name="customArrivalEnd"
                                    value={jobForm.customArrivalEnd}
                                    onChange={handleJobFormChange}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Additional Details */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Technician (optional)</label>
                              <select 
                                name="technician"
                                value={jobForm.technician}
                                onChange={handleJobFormChange}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                              >
                                <option value="">Select technician...</option>
                                {technicians.map(tech => (
                                  <option key={tech.id} value={tech.name}>
                                    {tech.name} ({tech.role})
                                  </option>
                                ))}
                              </select>
                              {technicians.length === 0 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center">
                                  <AlertCircle size={12} className="mr-1" />
                                  No active technicians found. Add technicians in Settings.
                                </p>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer PO # (optional)</label>
                              <input 
                                type="text" 
                                name="customerPO"
                                value={jobForm.customerPO}
                                onChange={handleJobFormChange}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Work Order (optional)</label>
                              <input 
                                type="text" 
                                name="workOrder"
                                value={jobForm.workOrder}
                                onChange={handleJobFormChange}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                            <div className="lg:col-span-3">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Summary</label>
                              <textarea 
                                name="summary"
                                value={jobForm.summary}
                                onChange={handleJobFormChange}
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none" 
                                placeholder="Describe the job details, customer requirements, or any special instructions..."
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags (optional)</label>
                              <input 
                                type="text" 
                                name="tags"
                                value={jobForm.tags}
                                onChange={handleJobFormChange}
                                placeholder="Comma separated"
                                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                              />
                            </div>
                          </div>

                          {/* Checkboxes */}
                          <div className="flex flex-wrap items-center gap-6 mb-8">
                            <label className="flex items-center text-gray-700 dark:text-gray-300 cursor-pointer">
                              <input 
                                type="checkbox" 
                                name="sendConfirmation"
                                checked={jobForm.sendConfirmation}
                                onChange={handleJobFormChange}
                                className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500 focus:ring-2 mr-3" 
                              />
                              <span className="text-sm font-medium">Send booking confirmation</span>
                            </label>
                            <label className="flex items-center text-gray-700 dark:text-gray-300 cursor-pointer">
                              <input 
                                type="checkbox" 
                                name="requireSignature"
                                checked={jobForm.requireSignature}
                                onChange={handleJobFormChange}
                                className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500 focus:ring-2 mr-3" 
                              />
                              <span className="text-sm font-medium">Require customer signature on invoices for this job</span>
                            </label>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-gray-200 dark:border-slate-700">
                            <button className="inline-flex items-center px-4 py-2 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors font-medium">
                              <Building size={16} className="mr-2" />
                              Attach Equipment
                            </button>
                            <div className="flex flex-wrap gap-3">
                              <button 
                                onClick={handleSaveAsLead}
                                className="inline-flex items-center px-6 py-2.5 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors font-medium"
                              >
                                Save as Lead
                              </button>
                              <button className="inline-flex items-center px-6 py-2.5 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors font-medium">
                                Build Estimate
                              </button>
                              <button 
                                onClick={handleBookJob}
                                className="inline-flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                              >
                                Book Job
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'calls' && (
                <div className="max-w-7xl mx-auto p-8">
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Calls</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your incoming and outgoing calls</p>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Calls</h3>
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                          <Phone size={20} className="text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mr-4">
                            <Phone size={16} className="text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-gray-100">John Smith</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">2:30 PM - 3 min</div>
                          </div>
                          <div className="text-xs text-green-600 dark:text-green-400 font-medium">Completed</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Missed Calls</h3>
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                          <Phone size={20} className="text-red-600 dark:text-red-400" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center p-4 border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer">
                          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mr-4">
                            <Phone size={16} className="text-red-600 dark:text-red-400" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-gray-100">Sarah Johnson</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">1:15 PM</div>
                          </div>
                          <div className="text-xs text-red-600 dark:text-red-400 font-medium">Missed</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Voicemail</h3>
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <MessageSquare size={20} className="text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mr-4">
                            <MessageSquare size={16} className="text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-gray-100">Mike Wilson</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">11:45 AM - 1 min</div>
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">New</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}



              {activeTab === 'inbox' && (
                <div className="flex h-[calc(100vh-140px)] overflow-hidden">
                  {/* Left sidebar with icon navigation */}
                  <div className="w-16 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col items-center py-4 space-y-4 h-full">
                    <div className="relative group">
                      <button 
                        onClick={() => setInboxView('conversations')}
                        className={`p-3 rounded-lg transition-colors ${
                          inboxView === 'conversations' 
                            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Inbox size={20} />
                      </button>
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                        All Conversations
                      </div>
                    </div>
                    <div className="relative group">
                      <button 
                        onClick={() => setInboxView('team')}
                        className={`p-3 rounded-lg transition-colors ${
                          inboxView === 'team' 
                            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Users size={20} />
                      </button>
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                        Team Inbox
                      </div>
                    </div>
                    <div className="relative group">
                      <button 
                        onClick={() => setInboxView('calls')}
                        className={`p-3 rounded-lg transition-colors ${
                          inboxView === 'calls' 
                            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Phone size={20} />
                      </button>
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                        Calls
                      </div>
                    </div>
                    <div className="relative group">
                      <button 
                        onClick={() => setInboxView('emails')}
                        className={`p-3 rounded-lg transition-colors ${
                          inboxView === 'emails' 
                            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Mail size={20} />
                      </button>
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                        Emails
                      </div>
                    </div>
                  </div>

                  {/* Conversation list */}
                  <div className="w-80 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col h-full">
                    <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        {inboxView === 'conversations' && 'All Conversations'}
                        {inboxView === 'team' && 'Team Inbox'}
                        {inboxView === 'calls' && 'Call History'}
                        {inboxView === 'emails' && 'Email Inbox'}
                      </h2>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          placeholder="Search conversations..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      {inboxView === 'conversations' && conversations.map((conversation) => (
                        <div
                          key={conversation.id}
                          onClick={() => setSelectedConversation(conversation)}
                          className={`p-4 border-b border-gray-100 dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                            selectedConversation?.id === conversation.id ? 'bg-blue-50 dark:bg-slate-700 border-l-4 border-l-blue-500' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${conversation.avatarColor}`}>
                              {conversation.customer.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {conversation.customer}
                                </h3>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {conversation.timestamp}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-300 truncate mb-1">
                                {conversation.lastMessage}
                              </p>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {conversation.team}
                                </span>
                                {conversation.unread && (
                                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {inboxView === 'team' && (
                        <div className="p-8 text-center">
                          <Users className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Team Inbox</h3>
                          <p className="text-gray-500 dark:text-gray-400">Shared conversations and team assignments will appear here</p>
                        </div>
                      )}

                      {inboxView === 'calls' && (
                        <div className="space-y-2 p-2">
                          <div className="p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                <Phone size={16} className="text-green-600 dark:text-green-400" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100">Sarah Johnson</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Incoming call • 2m ago</div>
                              </div>
                              <div className="text-xs text-green-600 dark:text-green-400">3 min</div>
                            </div>
                          </div>
                          <div className="p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                                <Phone size={16} className="text-red-600 dark:text-red-400" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100">Mike Wilson</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Missed call • 15m ago</div>
                              </div>
                              <div className="text-xs text-red-600 dark:text-red-400">Missed</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {inboxView === 'emails' && (
                        <FirebaseEmailInterface 
                          selectedEmail={selectedEmail}
                          onEmailSelect={setSelectedEmail}
                        />
                      )}
                    </div>
                  </div>

                  {/* Main conversation area */}
                  <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 h-full overflow-hidden">
                    {(selectedConversation && inboxView !== 'emails') ? (
                      <>
                        {/* Conversation header */}
                        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${selectedConversation.avatarColor}`}>
                                {selectedConversation.customer.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                  {selectedConversation.customer}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {selectedConversation.email} • {selectedConversation.status}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                <Phone size={18} />
                              </button>
                              <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                <Mail size={18} />
                              </button>
                              <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                <MoreHorizontal size={18} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Messages area */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-slate-800">
                          <div className="space-y-4 pb-60">
                            {/* System message */}
                            <div className="flex justify-center">
                              <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-4 py-2 rounded-full text-sm">
                                We're ready to help. Please share your query.
                              </div>
                            </div>

                            {/* Customer message */}
                            <div className="flex items-start space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${selectedConversation.avatarColor}`}>
                                {selectedConversation.customer.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="flex-1">
                                <div className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg p-3 max-w-md">
                                  <p className="text-sm text-gray-900 dark:text-gray-100">
                                    Hello support! I have gone through your product documentation, and I'm excited about purchasing your product as it aligns perfectly with my needs. Could you guide me on how to initiate the process?
                                  </p>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">2:23 PM</p>
                              </div>
                            </div>

                            {/* Agent response */}
                            <div className="flex items-start space-x-3 justify-end">
                              <div className="flex-1 flex justify-end">
                                <div className="bg-blue-600 text-white rounded-lg p-3 max-w-md">
                                  <p className="text-sm">
                                    Hi Riftwire, thank you for reaching out to our support center! To get started with our product, simply follow the steps outlined in the attached article.
                                  </p>
                                  <div className="mt-2">
                                    <a href="#" className="text-blue-200 hover:text-white underline text-sm">
                                      How to Sign Up for a Free Trial
                                    </a>
                                  </div>
                                </div>
                              </div>
                              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                OD
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <p className="text-xs text-gray-500 dark:text-gray-400">2:30 PM</p>
                            </div>

                            {/* Customer reply */}
                            <div className="flex items-start space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${selectedConversation.avatarColor}`}>
                                {selectedConversation.customer.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="flex-1">
                                <div className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg p-3 max-w-md">
                                  <p className="text-sm text-gray-900 dark:text-gray-100">
                                    Thanks for sharing the document! It's helpful. I've signed up for the free trial and will
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : inboxView === 'emails' && selectedEmail ? (
                      <>
                        {/* Email header */}
                        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                <Mail size={16} className="text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                  {selectedEmail.subject || '(No Subject)'}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  From: {selectedEmail.from} • To: {selectedEmail.to}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => handleEmailReply(selectedEmail)}
                                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              >
                                <Reply size={18} />
                              </button>
                              <button 
                                onClick={() => handleEmailForward(selectedEmail)}
                                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              >
                                <Forward size={18} />
                              </button>
                              <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                <MoreHorizontal size={18} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Email content in chat-like format */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-slate-800">
                          <div className="space-y-4 pb-60">
                            {/* Email message bubble - clean chat style */}
                            <div className="flex items-start space-x-3">
                              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                                <Mail size={14} className="text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1">
                                <div className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg p-3 max-w-md">
                                  {/* Email body with proper HTML rendering and styling */}
                                  <div 
                                    className="text-sm text-gray-900 dark:text-gray-100 email-content"
                                    dangerouslySetInnerHTML={{ 
                                      __html: sanitizeEmailHTML(selectedEmail.body || '') 
                                    }}
                                    style={{
                                      lineHeight: '1.5',
                                      wordWrap: 'break-word',
                                      overflowWrap: 'break-word'
                                    }}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {formatEmailDate(selectedEmail.receivedAt)}
                                </p>
                              </div>
                            </div>

                            {/* Show attachments separately if they exist */}
                            {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                              <div className="flex items-start space-x-3">
                                <div className="w-8 h-8"></div> {/* Spacer to align with message */}
                                <div className="flex-1">
                                  <div className="bg-gray-100 dark:bg-slate-600 rounded-lg p-3 max-w-md">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <Paperclip size={14} className="text-gray-500 dark:text-gray-400" />
                                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {selectedEmail.attachments.length} attachment{selectedEmail.attachments.length > 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      {selectedEmail.attachments.map((attachment, index) => (
                                        <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                                          📎 {attachment.filename}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                          {inboxView === 'emails' ? (
                            <>
                              <Mail className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No email selected</h3>
                              <p className="text-gray-500 dark:text-gray-400">Choose an email from the list to view its content</p>
                            </>
                          ) : (
                            <>
                              <MessageSquare className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No conversation selected</h3>
                              <p className="text-gray-500 dark:text-gray-400">Choose a conversation from the list to start messaging</p>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right sidebar - Customer details */}
                  <div className="w-80 bg-gray-50 dark:bg-slate-900 border-l border-gray-200 dark:border-slate-700 p-4 h-full overflow-y-auto">
                    {(selectedConversation && inboxView !== 'emails') && (
                      <div className="space-y-6">
                        {/* Customer Details Section */}
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Customer Details</h3>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                              <select className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                <option>Open</option>
                                <option>Pending</option>
                                <option>Resolved</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Assignee</label>
                              <select className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                <option>Unassigned</option>
                                <option>John Doe</option>
                                <option>Jane Smith</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                              <select className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                <option>Medium</option>
                                <option>Low</option>
                                <option>High</option>
                                <option>Urgent</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                              <select className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                <option>--</option>
                                <option>Technical Support</option>
                                <option>Billing</option>
                                <option>General Inquiry</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
                              <input
                                type="text"
                                placeholder="Add tags..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>

                        {/* User Data Section */}
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">User Data</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Email:</span>
                              <span className="text-gray-900 dark:text-gray-100">{selectedConversation.email}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Status:</span>
                              <span className="text-red-600 dark:text-red-400">Not Verified</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Created:</span>
                              <span className="text-gray-900 dark:text-gray-100">2 days ago</span>
                            </div>
                          </div>
                        </div>

                        {/* Links Section */}
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Links</h3>
                          <div className="space-y-2">
                            <button className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                              Create & Link Ticket
                            </button>
                            <button className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                              Link Ticket
                            </button>
                          </div>
                        </div>

                        {/* Recent Conversations Section */}
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Recent Conversations</h3>
                          <div className="space-y-2">
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                              <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">Product inquiry</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">3 days ago</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {(inboxView === 'emails' && selectedEmail) && (
                      <div className="space-y-6">
                        {/* Email Actions Section */}
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Email Actions</h3>
                          <div className="space-y-2">
                            <button className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center">
                              <Reply size={14} className="mr-2" />
                              Reply
                            </button>
                            <button className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center">
                              <Forward size={14} className="mr-2" />
                              Forward
                            </button>
                            <button className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center">
                              <Building size={14} className="mr-2" />
                              Create Job
                            </button>
                          </div>
                        </div>

                        {/* Email Details Section */}
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Email Details</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Status:</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                selectedEmail.isRead 
                                  ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' 
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              }`}>
                                {selectedEmail.isRead ? 'Read' : 'Unread'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Folder:</span>
                              <span className="text-gray-900 dark:text-gray-100 capitalize">{selectedEmail.folder}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Source:</span>
                              <span className="text-gray-900 dark:text-gray-100 capitalize">{selectedEmail.source || 'Gmail'}</span>
                            </div>
                            {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Attachments:</span>
                                <span className="text-gray-900 dark:text-gray-100">{selectedEmail.attachments.length}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Customer Lookup Section */}
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Customer Lookup</h3>
                          <div className="space-y-2">
                            <div className="text-sm">
                              <span className="text-gray-600 dark:text-gray-400">From:</span>
                              <div className="mt-1 text-gray-900 dark:text-gray-100 break-all">{selectedEmail.from}</div>
                            </div>
                            <button className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                              Search Customers
                            </button>
                            <button className="w-full text-left px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                              Create New Customer
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Floating compose area for conversations */}
            {selectedConversation && activeTab === 'inbox' && inboxView !== 'emails' && (
              <div className="fixed bottom-4 left-[calc(384px+4rem)] right-[calc(320px+4rem)] z-20">
                <div style={{ width: '480px', margin: '0 auto' }}>
                  {/* Reply/Private Note tabs - centered */}
                  <div className="flex justify-center items-center space-x-6 mb-4">
                    <button className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-b-2 border-blue-500">
                      Reply
                    </button>
                    <button className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                      Private Note
                    </button>
                  </div>
                  {/* Floating message box */}
                  <div className="relative bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl shadow-lg">
                    <textarea
                      placeholder="Compose your message"
                      rows={3}
                      className="w-full px-4 py-3 pr-16 border-0 rounded-xl bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-0 focus:outline-none resize-none text-sm"
                    />
                    {/* Floating send button in bottom right */}
                    <button className="absolute bottom-3 right-3 w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-colors shadow-md">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
                      </svg>
                    </button>
                    {/* Toolbar at bottom left */}
                    <div className="absolute bottom-3 left-3 flex items-center space-x-2">
                      <button className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-md transition-colors">
                        <Plus size={16} />
                      </button>
                      <button className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-md transition-colors">
                        <MessageSquare size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Floating compose area for emails */}
            {selectedEmail && activeTab === 'inbox' && inboxView === 'emails' && (
              <div className="fixed bottom-4 left-[calc(384px+4rem)] right-[calc(320px+4rem)] z-20">
                <div style={{ width: '480px', margin: '0 auto' }}>
                  {/* Email compose tabs */}
                  <div className="flex justify-center items-center space-x-6 mb-4">
                    <button 
                      onClick={() => handleEmailReply(selectedEmail)}
                      className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      Reply
                    </button>
                    <button 
                      onClick={() => handleEmailForward(selectedEmail)}
                      className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Forward
                    </button>
                  </div>
                  {/* Quick compose box */}
                  <div className="relative bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl shadow-lg">
                    <textarea
                      placeholder="Quick reply..."
                      rows={3}
                      value={emailComposeData.body}
                      onChange={(e) => setEmailComposeData(prev => ({ ...prev, body: e.target.value }))}
                      className="w-full px-4 py-3 pr-16 border-0 rounded-xl bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-0 focus:outline-none resize-none text-sm"
                    />
                    {/* Floating send button in bottom right */}
                    <button 
                      onClick={() => {
                        if (!emailComposeData.body.trim()) return;
                        handleEmailReply(selectedEmail);
                      }}
                      className="absolute bottom-3 right-3 w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-colors shadow-md disabled:opacity-50"
                      disabled={!emailComposeData.body.trim()}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
                      </svg>
                    </button>
                    {/* Toolbar at bottom left */}
                    <div className="absolute bottom-3 left-3 flex items-center space-x-2">
                      <button className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-md transition-colors">
                        <Paperclip size={16} />
                      </button>
                      <button 
                        onClick={() => handleEmailForward(selectedEmail)}
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-md transition-colors"
                      >
                        <Forward size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dialpad CTI */}
        {dialpadClientId && (
          <DialpadCTI
            clientId={dialpadClientId}
            onIncomingCall={handleIncomingCall}
            onAuthenticationChange={handleDialpadAuth}
          />
        )}

        {/* Create Customer Modal */}
        {showCreateCustomer && (
          <CreateCustomerForm
            onCancel={() => setShowCreateCustomer(false)}
            onCreate={handleCreateCustomer}
          />
        )}
      </NotificationProvider>
    </>
  );
};

export default Inbound;