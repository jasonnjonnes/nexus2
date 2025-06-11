import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, Home, Briefcase, Phone, Mail, User, Building, 
  Edit2, Trash2, Plus, DollarSign, Users, TrendingUp, 
  PhoneCall, Award, ClipboardList, FileText, LucideIcon,
  X, Search, ArrowLeft, Calendar, Camera, Paperclip,
  Check, Clock
} from 'lucide-react';
import { 
  getFirestore, collection, query, where, onSnapshot 
} from 'firebase/firestore';
import TagInput from './TagInput';

declare global {
  interface Window {
    google?: typeof google;
  }
}

declare namespace google.maps.places {
  class Autocomplete {
    constructor(input: HTMLInputElement, options?: object);
    addListener(event: string, handler: () => void): void;
    getPlace(): any;
  }
}

// Add Job type definition
interface Job {
  id: string;
  customerId: string;
  locationId: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  total: number;
  date: string;
  description: string;
  technician?: string;
  notes?: string;
}

// Utility functions with proper types
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

const getLocationTypeIcon = (type: string): JSX.Element => {
  switch (type) {
    case 'residential': return <Home size={16} className="text-blue-600 dark:text-blue-400" />;
    case 'commercial': return <Briefcase size={16} className="text-purple-600 dark:text-purple-400" />;
    default: return <MapPin size={16} className="text-gray-600 dark:text-gray-400" />;
  }
};

// Google Places API integration
type GooglePlaceAddress = { 
  street: string; 
  city: string; 
  state: string; 
  zip: string 
};

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface Place {
  address_components?: AddressComponent[];
}

const initializeGooglePlaces = (
  inputElement: HTMLInputElement,
  onPlaceSelected: (address: GooglePlaceAddress) => void
) => {
  if (window.google && window.google.maps && window.google.maps.places) {
    const autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
      types: ['address'],
      componentRestrictions: { country: 'us' }
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.address_components) {
        const addressData: GooglePlaceAddress = {
          street: '',
          city: '',
          state: '',
          zip: ''
        };
        place.address_components.forEach((component: { long_name: string; short_name: string; types: string[] }) => {
          const type = component.types[0];
          switch (type) {
            case 'street_number':
              addressData.street = component.long_name;
              break;
            case 'route':
              addressData.street += ' ' + component.long_name;
              break;
            case 'locality':
              addressData.city = component.long_name;
              break;
            case 'administrative_area_level_1':
              addressData.state = component.short_name;
              break;
            case 'postal_code':
              addressData.zip = component.long_name;
              break;
          }
        });
        onPlaceSelected(addressData);
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
  notes?: Note[];
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

// LocationEditPanel props
interface LocationEditPanelProps {
  location: Location;
  customer: Customer;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (customer: Customer) => Promise<void>;
}

interface Contact {
  id: string;
  type: string;
  value: string;
  notes?: string;
  category?: string;
}

interface NewContact {
  type: string;
  value: string;
  notes: string;
  category: string;
}

const LocationEditPanel: React.FC<LocationEditPanelProps> = ({ location, customer, isOpen, onClose, onUpdate }) => {
  const [editedLocation, setEditedLocation] = useState<Location>(location);
  const [activeTab, setActiveTab] = useState<string>('details');
  const [newContact, setNewContact] = useState<NewContact>({ type: 'phone', value: '', notes: '', category: 'mobile' });
  const streetInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    setEditedLocation(location);
  }, [location]);

  useEffect(() => {
    if (activeTab === 'details' && streetInputRef.current) {
      autocompleteRef.current = initializeGooglePlaces(streetInputRef.current, (addressData) => {
        setEditedLocation(prev => ({
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
        (window.google as any).maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [activeTab]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedLocation(prev => ({ ...prev, [name]: value }));
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewContact(prev => ({ ...prev, [name]: value }));
  };

  const handleLocationTagsChange = (newTags: string[]) => {
    setEditedLocation(prev => ({ ...prev, locationTags: newTags }));
  };

  const handleSave = async () => {
    try {
      if (!customer.locations) return;
      
      const updatedCustomer: Customer = {
        ...customer,
        locations: customer.locations.map((loc: Location) => {
          if (loc.id !== editedLocation.id) return loc;
          
          // Convert legacy notes to new format if needed
          const updatedNotes = editedLocation.notes?.map(note => 
            isLegacyNote(note) ? convertLegacyNote(note) : note
          );
          
          return {
            ...editedLocation,
            notes: updatedNotes,
            address: [editedLocation.street, editedLocation.city, editedLocation.state, editedLocation.zip].filter(Boolean).join(', ')
          };
        })
      };
      await onUpdate(updatedCustomer);
      onClose();
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const addContact = () => {
    if (newContact.value.trim()) {
      const contacts = editedLocation.contacts || [];
      const updatedContacts: Contact[] = [...contacts, { 
        id: `contact_${Date.now()}`, 
        ...newContact 
      }];
      setEditedLocation(prev => ({ ...prev, contacts: updatedContacts }));
      setNewContact({ type: 'phone', value: '', notes: '', category: 'mobile' });
    }
  };

  const removeContact = (contactId: string) => {
    const updatedContacts = (editedLocation.contacts || []).filter(c => c.id !== contactId);
    setEditedLocation(prev => ({ ...prev, contacts: updatedContacts }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-800 h-full shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-6 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Edit Location</h2>
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
              Location Details
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
              onClick={() => setActiveTab('equipment')}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                activeTab === 'equipment' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              Equipment
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Location Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={editedLocation.name || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location Type
                  </label>
                  <select
                    name="type"
                    value={editedLocation.type || 'residential'}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={editedLocation.phone || ''}
                    onChange={handleInputChange}
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
                    value={editedLocation.contactPerson || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
              
              {/* Address Section */}
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
                        value={editedLocation.street || ''}
                        onChange={handleInputChange}
                        placeholder="Street address (Google Places autocomplete)"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      name="city"
                      value={editedLocation.city || ''}
                      onChange={handleInputChange}
                      placeholder="City"
                      className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    />
                    <input
                      type="text"
                      name="state"
                      value={editedLocation.state || ''}
                      onChange={handleInputChange}
                      placeholder="State"
                      className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    />
                    <input
                      type="text"
                      name="zip"
                      value={editedLocation.zip || ''}
                      onChange={handleInputChange}
                      placeholder="ZIP"
                      className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location Tags
                </label>
                <TagInput
                  tags={editedLocation.locationTags || []}
                  onTagsChange={handleLocationTagsChange}
                  placeholder="Type and press Enter to add location tags"
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
                  {(editedLocation.contacts || []).map(contact => (
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

          {/* Equipment Tab */}
          {activeTab === 'equipment' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Equipment & Systems</h3>
                
                <div className="space-y-3 mb-6">
                  <div className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-800 dark:text-gray-100">HVAC Unit #1</h4>
                      <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Carrier 24ABC6</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Installed: Jan 2025</p>
                  </div>
                  
                  <div className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-800 dark:text-gray-100">Water Heater</h4>
                      <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded-full">
                        Needs Service
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Rheem 50gal</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Installed: 2020</p>
                  </div>
                </div>
                
                <button className="w-full py-2 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors">
                  <Plus size={16} className="mr-2 inline" />
                  Add Equipment
                </button>
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

interface LegacyNote {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  date: string;
}

interface LocationNote {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

type Note = LocationNote | LegacyNote;

const isLegacyNote = (note: Note): note is LegacyNote => {
  return (
    typeof note === 'object' &&
    note !== null &&
    'text' in note &&
    'author' in note &&
    'timestamp' in note &&
    'date' in note &&
    typeof note.text === 'string' &&
    typeof note.author === 'string' &&
    typeof note.timestamp === 'string' &&
    typeof note.date === 'string'
  );
};

const convertLegacyNote = (note: LegacyNote): LocationNote => ({
  id: note.id,
  content: note.text,
  createdAt: note.timestamp,
  createdBy: note.author
});

const getNoteContent = (note: Note): string => {
  return isLegacyNote(note) ? note.text : note.content;
};

const getNoteAuthor = (note: Note): string => {
  return isLegacyNote(note) ? note.author : note.createdBy;
};

const getNoteDate = (note: Note): string => {
  return isLegacyNote(note) ? note.date : note.createdAt;
};

interface InteractiveLocationNotesProps {
  location: Location;
  customer: Customer;
  onUpdate: (customer: Customer) => Promise<void>;
}

const InteractiveLocationNotes: React.FC<InteractiveLocationNotesProps> = ({ location, customer, onUpdate }) => {
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const addNote = async () => {
    if (!newNote.trim() || !customer.locations) return;

    const note: LocationNote = {
      id: `note_${Date.now()}`,
      content: newNote.trim(),
      createdAt: new Date().toISOString(),
      createdBy: 'Current User' // TODO: Get actual user
    };

    const updatedCustomer: Customer = {
      ...customer,
      locations: customer.locations.map(loc => 
        loc.id === location.id
          ? { ...loc, notes: [...(loc.notes || []), note] }
          : loc
      )
    };

    try {
      await onUpdate(updatedCustomer);
      setNewNote('');
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!customer.locations) return;

    const updatedCustomer: Customer = {
      ...customer,
      locations: customer.locations.map(loc => 
        loc.id === location.id
          ? { ...loc, notes: (loc.notes || []).filter(note => note.id !== noteId) }
          : loc
      )
    };

    try {
      await onUpdate(updatedCustomer);
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Location Notes</h3>
        <button
          onClick={() => setIsAdding(true)}
          className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus size={16} className="mr-1 inline" />
          Add Note
        </button>
      </div>

      {isAdding && (
        <div className="mb-4">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Type your note here..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
            rows={3}
          />
          <div className="flex justify-end space-x-2 mt-2">
            <button
              onClick={() => {
                setNewNote('');
                setIsAdding(false);
              }}
              className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={addNote}
              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Save Note
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {(location.notes || []).map(note => (
          <div key={note.id} className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-gray-800 dark:text-gray-200">{getNoteContent(note)}</p>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>{getNoteAuthor(note)}</span>
                  <span className="mx-2">•</span>
                  <span>{formatDate(getNoteDate(note))}</span>
                </div>
              </div>
              <button
                onClick={() => deleteNote(note.id)}
                className="ml-4 text-gray-400 hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface EmptySectionProps {
  Icon: LucideIcon;
  title: string;
  description: string;
}

const EmptySection: React.FC<EmptySectionProps> = ({ Icon, title, description }) => (
  <div className="text-center py-8">
    <Icon size={48} className="mx-auto text-gray-400 dark:text-gray-600 mb-4" />
    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
    <p className="text-gray-500 dark:text-gray-400">{description}</p>
  </div>
);

const LocationDetailView: React.FC<{
  location: Location;
  customer: Customer;
  onBack: () => void;
  onUpdate: (customer: Customer) => Promise<void>;
  onDelete: (locationId: string) => Promise<void>;
}> = ({ location, customer, onBack, onUpdate, onDelete }) => {
  const navigate = useNavigate();
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editedLocation, setEditedLocation] = useState<Location>(location);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalJobs: 0,
    totalRevenue: 0,
    avgJobTotal: 0,
    completionRate: 0
  });

  useEffect(() => {
    const loadJobs = async () => {
      if (!location.id || !customer.id) return;

      const db = getFirestore();
      const jobsRef = collection(db, 'jobs');
      const q = query(
        jobsRef,
        where('customerId', '==', customer.id),
        where('locationId', '==', location.id)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const jobsData: Job[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as Job;
          jobsData.push({ ...data, id: doc.id });
        });

        // Sort jobs by date
        jobsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setJobs(jobsData);

        // Calculate stats
        const totalJobs = jobsData.length;
        const totalRevenue = jobsData.reduce((sum, job) => sum + (job.total || 0), 0);
        const avgJobTotal = totalJobs > 0 ? totalRevenue / totalJobs : 0;
        const completedJobs = jobsData.filter(job => job.status === 'completed').length;
        const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

        setStats({
          totalJobs,
          totalRevenue,
          avgJobTotal,
          completionRate
        });

        setLoading(false);
      });

      return () => unsubscribe();
    };

    loadJobs();
  }, [location.id, customer.id]);

  const getStatusColor = (status: Job['status']): string => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const handleJobClick = (jobId: string) => {
    navigate(`/jobs/${jobId}`);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this location? This action cannot be undone.')) {
      onDelete(location.id);
    }
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
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{location.name}</h1>
                <button
                  onClick={() => setShowEditPanel(true)}
                  className="ml-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <Edit2 size={18} />
                </button>
              </div>
              
              {/* Location Info Display */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center">
                  {getLocationTypeIcon(location.type)}
                  <span className="ml-1 capitalize">{location.type}</span>
                  {location.isPrimary && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                      Primary
                    </span>
                  )}
                </div>
                
                {location.phone && (
                  <div className="flex items-center">
                    <Phone size={14} className="mr-1" />
                    <span>{location.phone}</span>
                  </div>
                )}
                
                {location.contactPerson && (
                  <div className="flex items-center">
                    <User size={14} className="mr-1" />
                    <span>{location.contactPerson}</span>
                  </div>
                )}
                
                <div className="flex items-center">
                  <MapPin size={14} className="mr-1" />
                  <span>{[location.street, location.city, location.state, location.zip].filter(Boolean).join(', ')}</span>
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
            {!location.isPrimary && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 size={16} className="mr-2 inline" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job History */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                <Calendar size={20} className="mr-2" />
                Job History ({jobs.length})
              </h2>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading jobs...</span>
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">No Jobs Yet</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">This location doesn't have any jobs yet.</p>
                  <button 
                    onClick={() => navigate('/inbound')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create First Job
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {jobs.map(job => (
                    <div
                      key={job.id}
                      onClick={() => handleJobClick(job.id)}
                      className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">{job.description}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(job.date)}
                            {job.technician && ` • ${job.technician}`}
                          </p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(job.status)}`}>
                            {job.status.replace('_', ' ')}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {formatCurrency(job.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Interactive Location Notes */}
            <InteractiveLocationNotes 
              location={location} 
              customer={customer} 
              onUpdate={onUpdate} 
            />

            {/* New Sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Projects */}
              <EmptySection 
                Icon={Users}
                title="Projects"
                description="Track multi-phase projects at this location"
              />

              {/* Estimates */}
              <EmptySection 
                Icon={DollarSign}
                title="Estimates"
                description="View estimates for this location"
              />

              {/* Leads */}
              <EmptySection 
                Icon={TrendingUp}
                title="Leads"
                description="Lead opportunities for this location"
              />

              {/* Calls */}
              <EmptySection 
                Icon={PhoneCall}
                title="Calls"
                description="Call history for this location"
              />

              {/* Memberships */}
              <EmptySection 
                Icon={Award}
                title="Memberships"
                description="Membership plans for this location"
              />

              {/* Service Agreements */}
              <EmptySection 
                Icon={ClipboardList}
                title="Service Agreements"
                description="Service contracts for this location"
              />

              {/* Forms */}
              <EmptySection 
                Icon={FileText}
                title="Forms"
                description="Forms and documentation for this location"
              />

              {/* Photos & Videos */}
              <EmptySection 
                Icon={Camera}
                title="Photos & Videos"
                description="Visual documentation for this location"
              />

              {/* Attachments */}
              <EmptySection 
                Icon={Paperclip}
                title="Attachments"
                description="Files related to this location"
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Location Stats */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Location Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Jobs</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{stats.totalJobs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Revenue</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{formatCurrency(stats.totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Avg Job Value</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{formatCurrency(stats.avgJobTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Completion Rate</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{stats.completionRate.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Customer Information</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <User size={16} className="text-gray-400 mr-2" />
                  <span className="text-gray-800 dark:text-gray-200">{customer.name}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center">
                    <Mail size={16} className="text-gray-400 mr-2" />
                    <span className="text-gray-800 dark:text-gray-200">{customer.email}</span>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center">
                    <Phone size={16} className="text-gray-400 mr-2" />
                    <span className="text-gray-800 dark:text-gray-200">{customer.phone}</span>
                  </div>
                )}
                {customer.company && (
                  <div className="flex items-center">
                    <Building size={16} className="text-gray-400 mr-2" />
                    <span className="text-gray-800 dark:text-gray-200">{customer.company}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Location Tags */}
            {location.locationTags && location.locationTags.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Location Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {location.locationTags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded-full text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Equipment */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Equipment</h3>
              <div className="space-y-3">
                <div className="p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-800 dark:text-gray-100">HVAC Unit #1</h4>
                    <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Carrier 24ABC6</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Installed: Jan 2025</p>
                </div>
                
                <div className="p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-800 dark:text-gray-100">Water Heater</h4>
                    <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded-full">
                      Needs Service
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Rheem 50gal</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Installed: 2020</p>
                </div>
              </div>
              
              <button className="mt-4 w-full py-2 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors">
                Manage Equipment
              </button>
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {jobs.slice(0, 3).map((job, index) => (
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
                      <p className="text-sm text-gray-800 dark:text-gray-100">{job.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(job.date)}</p>
                    </div>
                  </div>
                ))}
                
                {jobs.length === 0 && (
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
      <LocationEditPanel
        location={location}
        customer={customer}
        isOpen={showEditPanel}
        onClose={() => setShowEditPanel(false)}
        onUpdate={onUpdate}
      />
    </div>
  );
};

export default LocationDetailView;