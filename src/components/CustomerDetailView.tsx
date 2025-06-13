import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Edit, X, MapPin, Phone, Mail, 
  Building, Home, Briefcase, FileText, Trash2, Plus,
  Calendar, DollarSign, Clock, Check, Search,
  Users, Camera, Paperclip, Award,
  ClipboardList, TrendingUp, PhoneCall
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, query, where, onSnapshot
} from "firebase/firestore";
import { db } from '../firebase';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import TagInput from './TagInput';

declare global {
  interface Window {
    google?: typeof google;
  }
}

// Add Google Maps types if not present
// (If you already have them in a .d.ts file, you can skip this)
declare namespace google.maps.places {
  class Autocomplete {
    constructor(input: HTMLInputElement, options?: object);
    addListener(event: string, handler: () => void): void;
    getPlace(): google.maps.places.PlaceResult;
  }
}

// Helper functions
const formatDate = (dateString: string | undefined) => dateString ? new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
const formatCurrency = (amount: number | undefined) => `$${amount != null ? amount.toFixed(2) : '0.00'}`;

const getLocationTypeIcon = (type: string | undefined) => {
  switch (type) {
    case 'residential': return <Home size={16} className="text-blue-600 dark:text-blue-400" />;
    case 'commercial': return <Briefcase size={16} className="text-purple-600 dark:text-purple-400" />;
    default: return <MapPin size={16} className="text-gray-600 dark:text-gray-400" />;
  }
};

// Google Places API integration
type GooglePlaceAddress = { street: string; city: string; state: string; zip: string };
const initializeGooglePlaces = (
  inputElement: HTMLInputElement,
  onPlaceSelected: (address: GooglePlaceAddress) => void
) => {
  if (window.google && window.google.maps && window.google.maps.places) {
    const autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
      componentRestrictions: { country: ['us'] },
      fields: ['address_components', 'formatted_address', 'geometry']
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.address_components) {
        const addressComponents: { [key: string]: string } = {};
        place.address_components.forEach((component: { long_name: string; short_name: string; types: string[] }) => {
          const types: string[] = component.types;
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

// Type definitions for Customer and Location
export interface Location {
  id: string;
  name: string;
  address: string;
  type: string;
  isPrimary?: boolean;
  phone?: string;
  contactPerson?: string;
  street?: string;
  unit?: string;
  city?: string;
  state?: string;
  zip?: string;
  locationTags?: string[];
  contacts?: Array<{ id: string; type: string; value: string; notes?: string; category?: string }>;
}

export interface Customer {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: string;
  customerSince?: string;
  tags?: string[];
  leadSource?: string;
  notes?: string;
  locations?: Location[];
  billingAddress?: string;
  lifetimeRevenue?: number;
  avgJobTotal?: number;
  balanceDue?: number;
  currentBalance?: number;
  totalJobs?: number;
  createdAt?: string;
  membershipStatus?: string;
  taxStatus?: string;
  invoiceSignatureRequired?: boolean;
  contacts?: Array<{ id: string; type: string; value: string; notes?: string; category?: string }>;
}

export interface Job {
  id: string;
  customerId: string;
  status: string;
  startDate?: string;
  createdAt?: string;
  total?: number;
  amount?: number;
  price?: number;
  description?: string;
  title?: string;
  [key: string]: any;
}

// AddLocationModal props
interface AddLocationModalProps {
  customer: Customer;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (customer: Customer) => Promise<void>;
}
const AddLocationModal: React.FC<AddLocationModalProps> = ({ customer, isOpen, onClose, onUpdate }) => {
  const [locationData, setLocationData] = useState<{
    name: string;
    type: string;
    street: string;
    unit: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    contactPerson: string;
    locationTags: string[];
    isPrimary: boolean;
  }>({
    name: '',
    type: 'residential',
    street: '',
    unit: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    contactPerson: '',
    locationTags: [],
    isPrimary: false
  });

  const streetInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (isOpen && streetInputRef.current) {
      autocompleteRef.current = initializeGooglePlaces(streetInputRef.current, (addressData) => {
        setLocationData(prev => ({
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
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let checked = false;
    if (type === 'checkbox' && 'checked' in e.target) {
      checked = (e.target as HTMLInputElement).checked;
    }
    setLocationData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleTagsChange = (newTags: string[]) => {
    setLocationData(prev => ({ ...prev, locationTags: newTags }));
  };

  const handleSave = async () => {
    if (!locationData.name.trim() || !locationData.street.trim()) {
      alert('Please fill in required fields (Name and Street)');
      return;
    }

    try {
      const newLocation = {
        id: `loc_${Date.now()}`,
        name: locationData.name,
        type: locationData.type,
        street: locationData.street,
        unit: locationData.unit,
        city: locationData.city,
        state: locationData.state,
        zip: locationData.zip,
        address: `${locationData.street}${locationData.unit ? ', ' + locationData.unit : ''}, ${locationData.city}, ${locationData.state} ${locationData.zip}`,
        phone: locationData.phone || customer.phone,
        contactPerson: locationData.contactPerson || customer.name,
        locationTags: locationData.locationTags,
        isPrimary: locationData.isPrimary && customer.locations?.length === 0 // Only allow primary if no other locations
      };

      const updatedCustomer = {
        ...customer,
        locations: [...(customer.locations || []), newLocation]
      };

      await onUpdate(updatedCustomer);
      
      // Reset form
      setLocationData({
        name: '',
        type: 'residential',
        street: '',
        unit: '',
        city: '',
        state: '',
        zip: '',
        phone: '',
        contactPerson: '',
        locationTags: [],
        isPrimary: false
      });
      
      onClose();
    } catch (error) {
      console.error('Error adding location:', error);
      alert('Failed to add location. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-800 h-full shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-6 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Add New Location</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <X size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location Name *
              </label>
              <input
                type="text"
                name="name"
                value={locationData.name}
                onChange={handleInputChange}
                placeholder="e.g., Main Office, Warehouse, Home"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location Type
              </label>
              <select
                name="type"
                value={locationData.type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              >
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center">
              <MapPin size={20} className="mr-2" />
              Address
            </h3>
            <div className="space-y-3">
              <div className="relative">
                <div className="flex items-center">
                  <Search size={16} className="absolute left-3 text-gray-400" />
                  <input
                    ref={streetInputRef}
                    type="text"
                    name="street"
                    value={locationData.street}
                    onChange={handleInputChange}
                    placeholder="Street address (Google Places autocomplete) *"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <input
                  type="text"
                  name="unit"
                  value={locationData.unit}
                  onChange={handleInputChange}
                  placeholder="Unit/Suite"
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                />
                <input
                  type="text"
                  name="city"
                  value={locationData.city}
                  onChange={handleInputChange}
                  placeholder="City"
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                />
                <input
                  type="text"
                  name="state"
                  value={locationData.state}
                  onChange={handleInputChange}
                  placeholder="State"
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                />
                <input
                  type="text"
                  name="zip"
                  value={locationData.zip}
                  onChange={handleInputChange}
                  placeholder="ZIP"
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={locationData.phone}
                onChange={handleInputChange}
                placeholder={`Default: ${customer.phone || 'No phone on file'}`}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                name="contactPerson"
                value={locationData.contactPerson}
                onChange={handleInputChange}
                placeholder={`Default: ${customer.name}`}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location Tags
            </label>
            <TagInput
              tags={locationData.locationTags}
              onTagsChange={handleTagsChange}
              placeholder="Type and press Enter to add location tags"
            />
          </div>

          {customer.locations?.length === 0 && (
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="isPrimary"
                  checked={locationData.isPrimary}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Set as primary location</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-6">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Add Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// CustomerEditPanel props
interface CustomerEditPanelProps {
  customer: Customer;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (customer: Customer) => Promise<void>;
}
const CustomerEditPanel: React.FC<CustomerEditPanelProps> = ({ customer, isOpen, onClose, onUpdate }) => {
  const [editedCustomer, setEditedCustomer] = useState(customer);
  const [activeTab, setActiveTab] = useState('details');
  const [newContact, setNewContact] = useState({ type: 'phone', value: '', notes: '', category: 'mobile' });
  const streetInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    setEditedCustomer(customer);
  }, [customer]);

  useEffect(() => {
    if (activeTab === 'details' && streetInputRef.current) {
      autocompleteRef.current = initializeGooglePlaces(streetInputRef.current, (addressData) => {
        setEditedCustomer(prev => ({
          ...prev,
          billingAddress: `${addressData.street}, ${addressData.city}, ${addressData.state} ${addressData.zip}`
        }));
      });
    }

    return () => {
      if (autocompleteRef.current && window.google) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [activeTab]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedCustomer(prev => ({ ...prev, [name]: value }));
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewContact(prev => ({ ...prev, [name]: value }));
  };

  const handleTagsChange = (newTags: string[]) => {
    setEditedCustomer(prev => ({ ...prev, tags: newTags }));
  };

  const handleSave = async () => {
    try {
      await onUpdate(editedCustomer);
      onClose();
    } catch (error) {
      console.error('Error updating customer:', error);
    }
  };

  const addContact = () => {
    if (newContact.value.trim()) {
      const contacts = editedCustomer.contacts || [];
      const updatedContacts = [...contacts, { 
        id: `contact_${Date.now()}`, 
        ...newContact 
      }];
      setEditedCustomer(prev => ({ ...prev, contacts: updatedContacts }));
      setNewContact({ type: 'phone', value: '', notes: '', category: 'mobile' });
    }
  };

  const removeContact = (contactId: string) => {
    const updatedContacts = (editedCustomer.contacts || []).filter(c => c.id !== contactId);
    setEditedCustomer(prev => ({ ...prev, contacts: updatedContacts }));
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedCustomer(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedCustomer(prev => ({ ...prev, [name]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-800 h-full shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-6 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Edit Customer</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <X size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex space-x-1 mt-4">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                activeTab === 'details' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              Customer Details
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                activeTab === 'contacts' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              Contact Methods
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                activeTab === 'billing' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              Billing & Settings
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Customer Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={editedCustomer.name || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={editedCustomer.company || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={editedCustomer.email || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={editedCustomer.phone || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Status
                  </label>
                  <select
                    name="status"
                    value={editedCustomer.status || 'active'}
                    onChange={handleSelectChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="lead">Lead</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Lead Source
                  </label>
                  <input
                    type="text"
                    name="leadSource"
                    value={editedCustomer.leadSource || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Customer Tags
                </label>
                <TagInput
                  tags={editedCustomer.tags || []}
                  onTagsChange={handleTagsChange}
                  placeholder="Type and press Enter to add customer tags"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={editedCustomer.notes || ''}
                  onChange={handleTextAreaChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>
          )}

          {/* Contact Methods Tab */}
          {activeTab === 'contacts' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Contact Methods</h3>
                
                {/* Existing Contacts */}
                <div className="space-y-3 mb-6">
                  {(editedCustomer.contacts || []).map(contact => (
                    <div key={contact.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                      <div className="flex items-center">
                        {contact.type === 'phone' ? <Phone size={16} className="mr-2" /> : <Mail size={16} className="mr-2" />}
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-100">
                            {contact.value}
                            {contact.category && contact.type === 'phone' && (
                              <span className="ml-2 text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                {contact.category}
                              </span>
                            )}
                          </div>
                          {contact.notes && (
                            <div className="text-sm text-gray-600 dark:text-gray-400">{contact.notes}</div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeContact(contact.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Add New Contact */}
                <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-3">Add Contact Method</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select
                      name="type"
                      value={newContact.type}
                      onChange={handleContactChange}
                      className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    >
                      <option value="phone">Phone</option>
                      <option value="email">Email</option>
                    </select>
                    
                    {newContact.type === 'phone' && (
                      <select
                        name="category"
                        value={newContact.category}
                        onChange={handleContactChange}
                        className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                      >
                        <option value="mobile">Mobile</option>
                        <option value="home">Home</option>
                        <option value="work">Work</option>
                        <option value="other">Other</option>
                      </select>
                    )}
                    
                    <input
                      type={newContact.type === 'email' ? 'email' : 'tel'}
                      name="value"
                      value={newContact.value}
                      onChange={handleContactChange}
                      placeholder={newContact.type === 'email' ? 'Email address' : 'Phone number'}
                      className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    />
                    
                    <input
                      type="text"
                      name="notes"
                      value={newContact.notes}
                      onChange={handleContactChange}
                      placeholder="Notes (Property Manager, Emergency Contact, etc.)"
                      className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    />
                  </div>
                  <button
                    onClick={addContact}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Contact
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Billing & Settings Tab */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                  <MapPin size={20} className="mr-2" />
                  Billing Address
                </h3>
                <div className="relative">
                  <div className="flex items-center">
                    <Search size={16} className="absolute left-3 text-gray-400" />
                    <input
                      ref={streetInputRef}
                      type="text"
                      name="billingAddress"
                      value={editedCustomer.billingAddress || ''}
                      onChange={handleInputChange}
                      placeholder="Billing address (Google Places autocomplete)"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Membership Status
                  </label>
                  <select
                    name="membershipStatus"
                    value={editedCustomer.membershipStatus || 'Not a Member'}
                    onChange={handleSelectChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="Not a Member">Not a Member</option>
                    <option value="Basic">Basic Member</option>
                    <option value="Premium">Premium Member</option>
                    <option value="VIP">VIP Member</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tax Status
                  </label>
                  <select
                    name="taxStatus"
                    value={editedCustomer.taxStatus || 'Taxable'}
                    onChange={handleSelectChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="Taxable">Taxable</option>
                    <option value="Non-Taxable">Non-Taxable</option>
                    <option value="Tax Exempt">Tax Exempt</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="invoiceSignatureRequired"
                    checked={editedCustomer.invoiceSignatureRequired || false}
                    onChange={(e) => setEditedCustomer(prev => ({ ...prev, invoiceSignatureRequired: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Require customer signature on invoices</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-6">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// CustomerDetailView props
export interface CustomerDetailViewProps {
  customer: Customer;
  onBack: () => void;
  onUpdate: (customer: Customer) => Promise<void>;
  onDelete: (customerId: string) => Promise<void>;
  onLocationClick: (location: Location) => void;
}
const CustomerDetailView: React.FC<CustomerDetailViewProps> = ({ customer, onBack, onUpdate, onDelete, onLocationClick }) => {
  const navigate = useNavigate();
  const { tenantId } = useFirebaseAuth();
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [customerJobs, setCustomerJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  // Load jobs for this customer from Firebase
  useEffect(() => {
    const loadCustomerJobs = async () => {
      try {
        if (!tenantId) {
          console.log('No tenantId available, skipping job loading');
          setIsLoadingJobs(false);
          return;
        }
        
        const jobsQuery = query(
          collection(db, 'tenants', tenantId, 'jobs'),
          where('customerId', '==', customer.id)
        );

        const unsubscribe = onSnapshot(jobsQuery, (querySnapshot) => {
          const jobs: Job[] = [];
          querySnapshot.forEach((doc) => {
            jobs.push({ id: doc.id, ...doc.data() } as Job);
          });
          
          // Sort jobs by date (newest first)
          jobs.sort((a, b) => new Date(b.startDate || b.createdAt) - new Date(a.startDate || a.createdAt));
          
          setCustomerJobs(jobs);
          setIsLoadingJobs(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading customer jobs:', error);
        setIsLoadingJobs(false);
      }
    };

    if (customer.id && tenantId) {
      loadCustomerJobs();
    }
  }, [customer.id, tenantId]);

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'scheduled': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
      onDelete(customer.id);
    }
  };

  const handleJobClick = (jobId: string) => {
    navigate(`/job/${jobId}`);
  };

  // Calculate customer stats from actual jobs
  const customerStats = {
    totalJobs: customerJobs.length,
    lifetimeRevenue: customerJobs.reduce((sum, job) => {
      // Try to get total from different possible fields
      const total = job.total || job.amount || job.price || 0;
      return sum + (typeof total === 'number' ? total : 0);
    }, 0),
    avgJobTotal: customerJobs.length > 0 ? 
      Number(customerJobs.reduce((sum, job) => {
        const total = job.total || job.amount || job.price || 0;
        return sum + (typeof total === 'number' ? total : 0);
      }, 0)) / Number(customerJobs.length) : 0,
    lastJobDate: customerJobs.length > 0 ? customerJobs[0].startDate || customerJobs[0].createdAt : null
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="mr-4 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
            <div>
              <div className="flex items-center mb-2">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{customer.name}</h1>
                <button
                  onClick={() => setShowEditPanel(true)}
                  className="ml-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <Edit size={18} />
                </button>
              </div>
              
              {/* Customer Info Display */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                {customer.company && (
                  <div className="flex items-center">
                    <Building size={14} className="mr-1" />
                    <span>{customer.company}</span>
                  </div>
                )}
                
                {customer.phone && (
                  <div className="flex items-center">
                    <Phone size={14} className="mr-1" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                
                {customer.email && (
                  <div className="flex items-center">
                    <Mail size={14} className="mr-1" />
                    <span>{customer.email}</span>
                  </div>
                )}
                
                <div className="flex items-center">
                  <Calendar size={14} className="mr-1" />
                  <span>Customer since {formatDate(customer.customerSince)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => navigate('/inbound')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} className="mr-2 inline" />
              New Job
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 size={16} className="mr-2 inline" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Locations */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 flex items-center">
                  <MapPin size={20} className="mr-2" />
                  Locations
                </h2>
                <button 
                  onClick={() => setShowAddLocation(true)}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  <Plus size={16} className="mr-1 inline" />
                  Add Location
                </button>
              </div>
              
              <div className="space-y-3">
                {customer.locations?.map(location => (
                  <div 
                    key={location.id} 
                    className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    onClick={() => onLocationClick(location)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {getLocationTypeIcon(location.type)}
                        <div className="ml-3">
                          <div className="flex items-center">
                            <span className="font-medium text-gray-800 dark:text-gray-100">{location.name}</span>
                            {location.isPrimary && (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                                Primary
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{location.address}</div>
                          {location.phone && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">{location.phone}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-gray-400">
                        <span className="text-xs capitalize">{location.type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Job History */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                <Calendar size={20} className="mr-2" />
                Job History ({customerJobs.length})
              </h2>
              
              {isLoadingJobs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading jobs...</span>
                </div>
              ) : customerJobs.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">No Jobs Yet</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">This customer doesn't have any jobs yet.</p>
                  <button 
                    onClick={() => navigate('/inbound')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create First Job
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-800">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Job Number
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Technician
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                      {customerJobs.map(job => (
                        <tr 
                          key={job.id} 
                          className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          onClick={() => handleJobClick(job.id)}
                        >
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                            {job.jobNumber}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                            {job.jobType}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {formatDate(job.startDate || job.createdAt)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {job.serviceLocation?.name || 'Primary Location'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {job.technician || 'Unassigned'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getJobStatusColor(job.status)}`}>
                              {job.status ? job.status.charAt(0).toUpperCase() + job.status.slice(1) : 'Unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">
                            {formatCurrency(job.total || job.amount || job.price || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Interactive Customer Notes */}
            <InteractiveCustomerNotes customer={customer} onUpdate={onUpdate} />

            {/* New Sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Projects */}
              <EmptySection 
                icon={Users}
                title="Projects"
                description="Track multi-phase projects for this customer"
              />

              {/* Estimates */}
              <EmptySection 
                icon={DollarSign}
                title="Estimates"
                description="View estimates for this customer"
              />

              {/* Leads */}
              <EmptySection 
                icon={TrendingUp}
                title="Leads"
                description="Lead opportunities for this customer"
              />

              {/* Calls */}
              <EmptySection 
                icon={PhoneCall}
                title="Calls"
                description="Call history for this customer"
              />

              {/* Memberships */}
              <EmptySection 
                icon={Award}
                title="Memberships"
                description="Membership plans for this customer"
              />

              {/* Service Agreements */}
              <EmptySection 
                icon={ClipboardList}
                title="Service Agreements"
                description="Service contracts for this customer"
              />

              {/* Forms */}
              <EmptySection 
                icon={FileText}
                title="Forms"
                description="Forms and documentation for this customer"
              />

              {/* Photos & Videos */}
              <EmptySection 
                icon={Camera}
                title="Photos & Videos"
                description="Visual documentation for this customer"
              />

              {/* Attachments */}
              <EmptySection 
                icon={Paperclip}
                title="Attachments"
                description="Files related to this customer"
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer Stats */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Customer Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Lifetime Revenue</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{formatCurrency(customerStats.lifetimeRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Jobs</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{customerStats.totalJobs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Avg Job Total</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{formatCurrency(customerStats.avgJobTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Current Balance</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{formatCurrency(customer.currentBalance || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Balance Due</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{formatCurrency(customer.balanceDue || 0)}</span>
                </div>
                {customerStats.lastJobDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Last Job</span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{formatDate(customerStats.lastJobDate)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Tags */}
            {customer.tags && customer.tags.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Customer Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {customer.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Membership & Settings */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Membership & Settings</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Membership</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{customer.membershipStatus || 'Not a Member'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Tax Status</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{customer.taxStatus || 'Taxable'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Invoice Signature</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">
                    {customer.invoiceSignatureRequired ? 'Required' : 'Not Required'}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {customerJobs.slice(0, 3).map((job, index) => (
                  <div key={job.id} className="flex items-start">
                    <div className={`p-1.5 rounded-full mr-3 mt-0.5 ${
                      job.status === 'completed' ? 'bg-green-100 dark:bg-green-900/50' :
                      job.status === 'scheduled' ? 'bg-blue-100 dark:bg-blue-900/50' :
                      'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      {job.status === 'completed' ? (
                        <Check size={12} className="text-green-600 dark:text-green-400" />
                      ) : job.status === 'scheduled' ? (
                        <Calendar size={12} className="text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Clock size={12} className="text-gray-600 dark:text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-800 dark:text-gray-100">{job.jobType}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(job.startDate || job.createdAt)}</p>
                    </div>
                  </div>
                ))}
                
                {customerJobs.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                    No recent activity
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Panel */}
      <CustomerEditPanel
        customer={customer}
        isOpen={showEditPanel}
        onClose={() => setShowEditPanel(false)}
        onUpdate={onUpdate}
      />

      {/* Add Location Modal */}
      <AddLocationModal
        customer={customer}
        isOpen={showAddLocation}
        onClose={() => setShowAddLocation(false)}
        onUpdate={onUpdate}
      />
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const InteractiveCustomerNotes = (props: Record<string, unknown>) => null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const EmptySection = (props: Record<string, unknown>) => null;

export default CustomerDetailView;