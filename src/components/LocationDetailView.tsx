import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Edit, Save, X, MapPin, Phone, Mail, 
  Building, Home, Briefcase, FileText, Trash2, Plus,
  Calendar, DollarSign, User, Clock, Check, Star, Search,
  Users, Zap, MessageSquare, Camera, Paperclip, Award,
  ClipboardList, TrendingUp, PhoneCall
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  getFirestore, collection, query, where, onSnapshot
} from "firebase/firestore";
import TagInput from './TagInput';

// Helper functions
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
const formatCurrency = (amount) => `$${amount != null ? amount.toFixed(2) : '0.00'}`;

const getLocationTypeIcon = (type) => {
  switch (type) {
    case 'residential': return <Home size={16} className="text-blue-600 dark:text-blue-400" />;
    case 'commercial': return <Briefcase size={16} className="text-purple-600 dark:text-purple-400" />;
    default: return <MapPin size={16} className="text-gray-600 dark:text-gray-400" />;
  }
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

// Side Panel Editor Component for Location
const LocationEditPanel = ({ location, customer, isOpen, onClose, onUpdate }) => {
  const [editedLocation, setEditedLocation] = useState(location);
  const [activeTab, setActiveTab] = useState('details');
  const [newContact, setNewContact] = useState({ type: 'phone', value: '', notes: '', category: 'mobile' });
  const streetInputRef = useRef(null);
  const autocompleteRef = useRef(null);

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
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [activeTab]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedLocation(prev => ({ ...prev, [name]: value }));
  };

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setNewContact(prev => ({ ...prev, [name]: value }));
  };

  const handleLocationTagsChange = (newTags) => {
    setEditedLocation(prev => ({ ...prev, locationTags: newTags }));
  };

  const handleSave = async () => {
    try {
      // Update the location in the customer's locations array
      const updatedCustomer = {
        ...customer,
        locations: customer.locations.map(loc => 
          loc.id === editedLocation.id ? {
            ...editedLocation,
            address: [editedLocation.street, editedLocation.city, editedLocation.state, editedLocation.zip].filter(Boolean).join(', ')
          } : loc
        )
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
      const updatedContacts = [...contacts, { 
        id: `contact_${Date.now()}`, 
        ...newContact 
      }];
      setEditedLocation(prev => ({ ...prev, contacts: updatedContacts }));
      setNewContact({ type: 'phone', value: '', notes: '', category: 'mobile' });
    }
  };

  const removeContact = (contactId) => {
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

// Interactive Notes Component for Location
const InteractiveLocationNotes = ({ location, customer, onUpdate }) => {
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const addNote = async () => {
    if (newNote.trim()) {
      const notes = location.notes || [];
      const updatedNotes = [
        {
          id: `note_${Date.now()}`,
          text: newNote.trim(),
          author: 'Current User',
          timestamp: new Date().toISOString(),
          date: new Date().toLocaleDateString()
        },
        ...notes
      ];
      
      // Update the location in the customer's locations array
      const updatedCustomer = {
        ...customer,
        locations: customer.locations.map(loc => 
          loc.id === location.id ? { ...loc, notes: updatedNotes } : loc
        )
      };
      
      try {
        await onUpdate(updatedCustomer);
        setNewNote('');
        setIsAdding(false);
      } catch (error) {
        console.error('Error adding note:', error);
      }
    }
  };

  const deleteNote = async (noteId) => {
    const updatedNotes = (location.notes || []).filter(note => note.id !== noteId);
    
    // Update the location in the customer's locations array
    const updatedCustomer = {
      ...customer,
      locations: customer.locations.map(loc => 
        loc.id === location.id ? { ...loc, notes: updatedNotes } : loc
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
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 flex items-center">
          <FileText size={20} className="mr-2" />
          Location Notes
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus size={16} className="mr-1 inline" />
          Add Note
        </button>
      </div>

      {isAdding && (
        <div className="mb-4 p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note about this location..."
            className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 min-h-[100px]"
          />
          <div className="flex justify-end space-x-2 mt-3">
            <button
              onClick={() => {
                setIsAdding(false);
                setNewNote('');
              }}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={addNote}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Note
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {(location.notes || []).length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No notes yet. Click "Add Note\" to get started.
          </p>
        ) : (
          (location.notes || []).map(note => (
            <div key={note.id} className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <User size={14} className="mr-1" />
                  <span>{note.author}</span>
                  <span className="mx-2">•</span>
                  <Clock size={14} className="mr-1" />
                  <span>{note.date}</span>
                </div>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-gray-800 dark:text-gray-200">{note.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Empty Section Component
const EmptySection = ({ icon: Icon, title, description }) => (
  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
    <div className="text-center py-8">
      <Icon size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
      <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm">{description}</p>
    </div>
  </div>
);

const LocationDetailView = ({ location, customer, onBack, onUpdate, onDelete }) => {
  const navigate = useNavigate();
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [locationJobs, setLocationJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  // Load jobs for this specific location from Firebase
  useEffect(() => {
    const loadLocationJobs = async () => {
      try {
        const db = getFirestore();
        const jobsQuery = query(
          collection(db, 'jobs'),
          where('locationId', '==', location.id)
        );

        const unsubscribe = onSnapshot(jobsQuery, (querySnapshot) => {
          const jobs = [];
          querySnapshot.forEach((doc) => {
            jobs.push({ id: doc.id, ...doc.data() });
          });
          
          // Sort jobs by date (newest first)
          jobs.sort((a, b) => new Date(b.startDate || b.createdAt) - new Date(a.startDate || a.createdAt));
          
          setLocationJobs(jobs);
          setIsLoadingJobs(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading location jobs:', error);
        setIsLoadingJobs(false);
      }
    };

    if (location.id) {
      loadLocationJobs();
    }
  }, [location.id]);

  const getJobStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'scheduled': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this location? This action cannot be undone.')) {
      onDelete(location.id);
    }
  };

  const handleJobClick = (jobId) => {
    navigate(`/job/${jobId}`);
  };

  // Calculate location stats from actual jobs
  const locationStats = {
    totalJobs: locationJobs.length,
    totalRevenue: locationJobs.reduce((sum, job) => {
      const total = job.total || job.amount || job.price || 0;
      return sum + (typeof total === 'number' ? total : 0);
    }, 0),
    avgJobTotal: locationJobs.length > 0 ? 
      locationJobs.reduce((sum, job) => {
        const total = job.total || job.amount || job.price || 0;
        return sum + (typeof total === 'number' ? total : 0);
      }, 0) / locationJobs.length : 0,
    lastJobDate: locationJobs.length > 0 ? locationJobs[0].startDate || locationJobs[0].createdAt : null
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
                  <Edit size={18} />
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
                Job History ({locationJobs.length})
              </h2>
              
              {isLoadingJobs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading jobs...</span>
                </div>
              ) : locationJobs.length === 0 ? (
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
                      {locationJobs.map(job => (
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
                icon={Users}
                title="Projects"
                description="Track multi-phase projects at this location"
              />

              {/* Estimates */}
              <EmptySection 
                icon={DollarSign}
                title="Estimates"
                description="View estimates for this location"
              />

              {/* Leads */}
              <EmptySection 
                icon={TrendingUp}
                title="Leads"
                description="Lead opportunities for this location"
              />

              {/* Calls */}
              <EmptySection 
                icon={PhoneCall}
                title="Calls"
                description="Call history for this location"
              />

              {/* Memberships */}
              <EmptySection 
                icon={Award}
                title="Memberships"
                description="Membership plans for this location"
              />

              {/* Service Agreements */}
              <EmptySection 
                icon={ClipboardList}
                title="Service Agreements"
                description="Service contracts for this location"
              />

              {/* Forms */}
              <EmptySection 
                icon={FileText}
                title="Forms"
                description="Forms and documentation for this location"
              />

              {/* Photos & Videos */}
              <EmptySection 
                icon={Camera}
                title="Photos & Videos"
                description="Visual documentation for this location"
              />

              {/* Attachments */}
              <EmptySection 
                icon={Paperclip}
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
                  <span className="font-medium text-gray-800 dark:text-gray-100">{locationStats.totalJobs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Revenue</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{formatCurrency(locationStats.totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Avg Job Value</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{formatCurrency(locationStats.avgJobTotal)}</span>
                </div>
                {locationStats.lastJobDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Last Service</span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{formatDate(locationStats.lastJobDate)}</span>
                  </div>
                )}
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
                {locationJobs.slice(0, 3).map((job, index) => (
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
                
                {locationJobs.length === 0 && (
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