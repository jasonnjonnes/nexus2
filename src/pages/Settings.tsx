import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Search, Plus, X, User, Mail, Phone, MapPin, Calendar, Shield, Building, Camera, Edit, Palette, Upload, Image } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, 
  query, where, setDoc 
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

interface SettingItem {
  name: string;
  path: string;
}

interface SettingSection {
  name: string;
  items: SettingItem[];
}

const settingsSections: SettingSection[] = [
  {
    name: 'Your Account',
    items: [
      { name: 'Billing', path: 'billing' },
      { name: 'Company Profile', path: 'company-profile' },
      { name: 'Feature Configurations', path: 'feature-configurations' },
      { name: 'Marketing Registration', path: 'marketing-registration' },
      { name: 'Register for Texting', path: 'register-texting' }
    ]
  },
  {
    name: 'People',
    items: [
      { name: 'Office', path: 'office' },
      { name: 'Technicians', path: 'technicians' },
      { name: 'Role Permissions', path: 'role-permissions' },
      { name: 'Payroll', path: 'payroll' }
    ]
  },
  {
    name: 'Integrations',
    items: [
      { name: 'API Application Access', path: 'api-access' },
      { name: 'Booking Providers', path: 'booking-providers' },
      { name: 'Enterprise Hub', path: 'enterprise-hub' },
      { name: 'Financing', path: 'financing' },
      { name: 'GPS', path: 'gps' },
      { name: 'Job Type Mapping', path: 'job-type-mapping' },
      { name: 'Marketing Integrations', path: 'marketing-integrations' },
      { name: 'Mobile', path: 'mobile' },
      { name: 'Payment Processing', path: 'payment-processing' },
      { name: 'QuickBooks Desktop', path: 'quickbooks' }
    ]
  },
  {
    name: 'Dispatch Board',
    items: [
      { name: 'Alerts', path: 'dispatch-alerts' },
      { name: 'Clock In/Out', path: 'clock-in-out' },
      { name: 'Job Confirmations', path: 'job-confirmations' }
    ]
  },
  {
    name: 'Operations',
    items: [
      { name: 'Rescheduled Reason', path: 'rescheduled-reason' },
      { name: 'TitanExchange', path: 'titanexchange' },
      { name: 'Marketing Pro', path: 'marketing-pro' },
      { name: 'Capacity Planning', path: 'capacity-planning' },
      { name: 'Business Unit Groups', path: 'business-unit-groups' },
      { name: 'Configuration', path: 'operations-config' },
      { name: 'Purchasing', path: 'purchasing' },
      { name: 'Phones Pro', path: 'phones-pro' },
      { name: 'Types', path: 'types' },
      { name: 'Recurring Service Types', path: 'recurring-service-types' },
      { name: 'Tax Zones', path: 'tax-zones' }
    ]
  },
  {
    name: 'Accounting',
    items: [
      { name: 'Accounting Periods', path: 'accounting-periods' },
      { name: 'Application For Payment', path: 'payment-application' },
      { name: 'Costing', path: 'costing' },
      { name: 'General Ledger Accounts', path: 'gl-accounts' },
      { name: 'Journal Entries and Auto Batching', path: 'journal-entries' },
      { name: 'Payroll GL Mapping', path: 'payroll-gl-mapping' }
    ]
  },
  {
    name: 'Tools',
    items: [
      { name: 'Titan Intelligence', path: 'titan-intelligence' },
      { name: 'Dispatch Pro', path: 'dispatch-pro' }
    ]
  },
  {
    name: 'Core Data',
    items: [
      { name: 'Business Units', path: 'business-units' },
      { name: 'Call Reasons', path: 'call-reasons' },
      { name: 'Campaign Categories', path: 'campaign-categories' },
      { name: 'Campaigns', path: 'campaigns' },
      { name: 'Cancel and Hold Reasons', path: 'cancel-hold-reasons' },
      { name: 'Content Portal', path: 'content-portal' },
      { name: 'Custom Fields', path: 'custom-fields' },
      { name: 'Custom Follow Up', path: 'custom-follow-up' },
      { name: 'Customer', path: 'customer' },
      { name: 'Dashboards', path: 'dashboards' },
      { name: 'Forms', path: 'forms' },
      { name: 'Job Booking', path: 'job-booking' },
      { name: 'Job Types', path: 'job-types' },
      { name: 'Labor Types', path: 'labor-types' },
      { name: 'Opt Out', path: 'opt-out' },
      { name: 'Payroll Adjustment Codes', path: 'payroll-adjustment-codes' },
      { name: 'Project Settings', path: 'project-settings' },
      { name: 'Project Statuses', path: 'project-statuses' },
      { name: 'Project Types', path: 'project-types' },
      { name: 'Reporting Settings', path: 'reporting-settings' },
      { name: 'Skills', path: 'skills' },
      { name: 'Tag Types', path: 'tag-types' },
      { name: 'Task Management', path: 'task-management' },
      { name: 'Template Pricebook Items', path: 'template-pricebook-items' },
      { name: 'Timesheet Codes', path: 'timesheet-codes' },
      { name: 'Zones', path: 'zones' }
    ]
  },
  {
    name: 'Billing & Invoicing',
    items: [
      { name: 'Automatic Invoicing', path: 'automatic-invoicing' },
      { name: 'Configurable Billing', path: 'configurable-billing' },
      { name: 'Customer Statement', path: 'customer-statement' },
      { name: 'Email', path: 'billing-email' },
      { name: 'Generative Content Rules', path: 'generative-content-rules' },
      { name: 'Invoice Templates', path: 'invoice-templates' },
      { name: 'Membership Types', path: 'membership-types' },
      { name: 'Online Payments', path: 'online-payments' },
      { name: 'Payment Collections', path: 'payment-collections' },
      { name: 'Payment Terms', path: 'payment-terms' }
    ]
  },
  {
    name: 'Communications',
    items: [
      { name: 'Chat', path: 'chat' },
      { name: 'Customer Notifications', path: 'customer-notifications' },
      { name: 'Customer Portal', path: 'customer-portal' },
      { name: 'Web Appointments', path: 'web-appointments' }
    ]
  }
];

// Predefined color options
const predefinedColors = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#84CC16', // Lime
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#F43F5E', // Rose
  '#A855F7', // Violet
  '#22C55E', // Emerald
  '#EAB308'  // Amber
];

// Color Picker Component
const ColorPicker = ({ selectedColor, onColorChange, onClose }) => {
  const [customColor, setCustomColor] = useState(selectedColor || '#3B82F6');

  return (
    <div className="absolute top-full left-0 mt-2 p-4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg z-50 w-64">
      <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-3">Choose Color</h4>
      
      {/* Predefined Colors */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {predefinedColors.map(color => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              selectedColor === color 
                ? 'border-gray-800 dark:border-gray-200 scale-110' 
                : 'border-gray-300 dark:border-slate-600 hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      
      {/* Custom Color Picker */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Custom Color
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="w-8 h-8 rounded border border-gray-300 dark:border-slate-600"
          />
          <input
            type="text"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
          />
          <button
            onClick={() => onColorChange(customColor)}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>
      
      <div className="flex justify-end space-x-2">
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// Logo Upload Component
const LogoUpload = ({ currentLogo, onLogoChange, label = "Logo" }) => {
  const [logoPreview, setLogoPreview] = useState(currentLogo || '');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        setLogoPreview(dataUrl);
        onLogoChange(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="flex items-center space-x-4">
        <div className="relative">
          <div className="h-20 w-20 rounded-lg bg-gray-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-gray-300 dark:border-slate-600">
            {logoPreview ? (
              <img 
                src={logoPreview} 
                alt={label} 
                className="h-full w-full object-contain"
              />
            ) : (
              <Image size={32} className="text-gray-400 dark:text-gray-500" />
            )}
          </div>
          <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-1 rounded-full cursor-pointer hover:bg-blue-700">
            <Camera size={12} />
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Upload a {label.toLowerCase()} for your {label.toLowerCase() === 'logo' ? 'company' : 'business unit'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            JPG, PNG or SVG. Max size 2MB. Recommended 200x200px.
          </p>
        </div>
      </div>
    </div>
  );
};

// Tag Input Component
const TagInput = ({ tags, onTagsChange, placeholder = "Type and press Enter to add tags" }) => {
  const [currentTag, setCurrentTag] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && currentTag.trim()) {
      e.preventDefault();
      if (!tags.includes(currentTag.trim())) {
        onTagsChange([...tags, currentTag.trim()]);
      }
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="flex flex-wrap items-center w-full border rounded-lg p-2 min-h-[42px] bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600">
      {tags.map(tag => (
        <span 
          key={tag} 
          className="flex items-center bg-blue-100 text-blue-800 text-sm font-medium mr-2 mb-1 px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-200"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-2 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-100 transition-colors"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={currentTag}
        onChange={(e) => setCurrentTag(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-grow bg-transparent outline-none text-gray-800 dark:text-gray-200 min-w-[120px]"
      />
    </div>
  );
};

// Create/Edit Staff Member Form Component
const StaffForm = ({ onCancel, onSave, staffType, editingStaff = null }) => {
  const [formData, setFormData] = useState({
    firstName: editingStaff?.firstName || '',
    lastName: editingStaff?.lastName || '',
    email: editingStaff?.email || '',
    phone: editingStaff?.phone || '',
    homeAddress: editingStaff?.homeAddress || '',
    dateOfBirth: editingStaff?.dateOfBirth || '',
    socialSecurityNumber: editingStaff?.socialSecurityNumber || '',
    role: editingStaff?.role || (staffType === 'office' ? 'CSR' : 'Helper'),
    businessUnit: editingStaff?.businessUnit || '',
    profilePicture: editingStaff?.profilePicture || '',
    color: editingStaff?.color || '#3B82F6'
  });

  const [profilePicturePreview, setProfilePicturePreview] = useState(editingStaff?.profilePicture || '');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        setProfilePicturePreview(dataUrl);
        setFormData(prev => ({ ...prev, profilePicture: dataUrl }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleColorChange = (color) => {
    setFormData(prev => ({ ...prev, color }));
    setShowColorPicker(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      alert('Please fill in all required fields');
      return;
    }

    const staffData = {
      ...formData,
      staffType,
      fullName: `${formData.firstName} ${formData.lastName}`,
      updatedAt: new Date().toISOString(),
      status: editingStaff?.status || 'active'
    };

    if (!editingStaff) {
      staffData.createdAt = new Date().toISOString();
    }

    onSave(staffData, editingStaff?.id);
  };

  const officeRoles = ['CSR', 'Admin', 'Accounting', 'Inventory', 'Manager'];
  const technicianRoles = ['Helper', 'Field Tech', 'Lead Tech'];
  const businessUnits = ['Residential', 'Commercial'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end" onClick={onCancel}>
      <div className="w-full max-w-2xl bg-white dark:bg-slate-800 h-full shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              {editingStaff ? 'Edit' : 'Add New'} {staffType === 'office' ? 'Office Staff' : 'Technician'}
            </h2>
            <button type="button" onClick={onCancel} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700">
              <X size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto flex-grow">
            {/* Profile Picture */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                <Camera size={20} className="mr-2" />
                Profile Picture
              </h3>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                    {profilePicturePreview ? (
                      <img 
                        src={profilePicturePreview} 
                        alt="Profile" 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User size={32} className="text-gray-400 dark:text-gray-500" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-1 rounded-full cursor-pointer hover:bg-blue-700">
                    <Camera size={12} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Upload a profile picture for this staff member
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    JPG, PNG or GIF. Max size 2MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Color Selection for Technicians */}
            {staffType === 'technician' && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                  <Palette size={20} className="mr-2" />
                  Technician Color
                </h3>
                <div className="relative">
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      className="flex items-center space-x-2 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      <div 
                        className="w-6 h-6 rounded-full border border-gray-300 dark:border-slate-600"
                        style={{ backgroundColor: formData.color }}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Choose Color</span>
                    </button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      This color will be used for job cards on the dispatch board
                    </span>
                  </div>
                  
                  {showColorPicker && (
                    <ColorPicker
                      selectedColor={formData.color}
                      onColorChange={handleColorChange}
                      onClose={() => setShowColorPicker(false)}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                <User size={20} className="mr-2" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
            </div>

            {/* Role and Business Unit */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                <Shield size={20} className="mr-2" />
                Role & Assignment
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role *
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  >
                    {(staffType === 'office' ? officeRoles : technicianRoles).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                {staffType === 'technician' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Business Unit
                    </label>
                    <select
                      name="businessUnit"
                      value={formData.businessUnit}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    >
                      <option value="">Select business unit...</option>
                      {businessUnits.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Optional Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                <MapPin size={20} className="mr-2" />
                Additional Information (Optional)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Home Address
                  </label>
                  <input
                    type="text"
                    name="homeAddress"
                    value={formData.homeAddress}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Social Security Number
                  </label>
                  <input
                    type="password"
                    name="socialSecurityNumber"
                    value={formData.socialSecurityNumber}
                    onChange={handleChange}
                    placeholder="XXX-XX-XXXX"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end p-6 border-t bg-gray-50 dark:bg-slate-800 space-x-3 border-gray-200 dark:border-slate-700">
            <button type="button" onClick={onCancel} className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200">
              Cancel
            </button>
            <button type="submit" className="px-6 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
              {editingStaff ? 'Update' : 'Create'} {staffType === 'office' ? 'Office Staff' : 'Technician'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Staff List Component
const StaffList = ({ staffType, staff, onAdd, onEdit, onDelete }) => {
  const getRoleColor = (role) => {
    const roleColors = {
      'CSR': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Admin': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'Accounting': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Inventory': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Manager': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'Helper': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      'Field Tech': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Lead Tech': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    };
    return roleColors[role] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
      <div className="p-6 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 capitalize">
            {staffType} ({staff.length})
          </h3>
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Plus size={16} className="mr-2" />
            Add {staffType === 'office' ? 'Office Staff' : 'Technician'}
          </button>
        </div>
      </div>

      {staff.length === 0 ? (
        <div className="p-8 text-center">
          <User size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
            No {staffType} members yet
          </h4>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Get started by adding your first {staffType === 'office' ? 'office staff member' : 'technician'}.
          </p>
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add {staffType === 'office' ? 'Office Staff' : 'Technician'}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                {staffType === 'technician' && (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Business Unit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Color
                    </th>
                  </>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {staff.map(member => (
                <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white overflow-hidden">
                        {member.profilePicture ? (
                          <img 
                            src={member.profilePicture} 
                            alt={member.fullName} 
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium">
                            {member.firstName?.[0]}{member.lastName?.[0]}
                          </span>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {member.fullName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex items-center">
                      <Phone size={14} className="mr-1" />
                      {member.phone}
                    </div>
                  </td>
                  {staffType === 'technician' && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {member.businessUnit || 'Unassigned'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div 
                            className="w-6 h-6 rounded-full border border-gray-300 dark:border-slate-600"
                            style={{ backgroundColor: member.color || '#3B82F6' }}
                          />
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            {member.color || '#3B82F6'}
                          </span>
                        </div>
                      </td>
                    </>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      member.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {member.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onEdit(member)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors flex items-center"
                      >
                        <Edit size={14} className="mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(member.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Business Units Management Component
const BusinessUnitsManagement = ({ db, userId }) => {
  const [businessUnits, setBusinessUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    officialName: '',
    email: '',
    bccEmail: '',
    phoneNumber: '',
    trade: '',
    division: '',
    tags: [],
    defaultWarehouse: '',
    currency: 'USD',
    invoiceHeader: '',
    invoiceMessage: '',
    logo: '',
    isActive: true
  });

  // Load business units
  useEffect(() => {
    if (!db || !userId) return;

    const businessUnitsQuery = query(
      collection(db, 'businessUnits'),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(businessUnitsQuery, (querySnapshot) => {
      const unitsData = [];
      querySnapshot.forEach((doc) => {
        unitsData.push({ id: doc.id, ...doc.data() });
      });
      setBusinessUnits(unitsData);
    });

    return () => unsubscribe();
  }, [db, userId]);

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.officialName) {
      alert('Please fill in required fields');
      return;
    }

    try {
      const unitData = {
        ...formData,
        userId: userId,
        updatedAt: new Date().toISOString()
      };

      if (editingUnit) {
        await updateDoc(doc(db, 'businessUnits', editingUnit.id), unitData);
      } else {
        unitData.createdAt = new Date().toISOString();
        const customId = `bu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await setDoc(doc(db, 'businessUnits', customId), unitData);
      }

      setShowForm(false);
      setEditingUnit(null);
      setFormData({
        name: '',
        officialName: '',
        email: '',
        bccEmail: '',
        phoneNumber: '',
        trade: '',
        division: '',
        tags: [],
        defaultWarehouse: '',
        currency: 'USD',
        invoiceHeader: '',
        invoiceMessage: '',
        logo: '',
        isActive: true
      });
    } catch (error) {
      console.error('Error saving business unit:', error);
      alert('Failed to save business unit');
    }
  };

  const handleEdit = (unit) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name || '',
      officialName: unit.officialName || '',
      email: unit.email || '',
      bccEmail: unit.bccEmail || '',
      phoneNumber: unit.phoneNumber || '',
      trade: unit.trade || '',
      division: unit.division || '',
      tags: unit.tags || [],
      defaultWarehouse: unit.defaultWarehouse || '',
      currency: unit.currency || 'USD',
      invoiceHeader: unit.invoiceHeader || '',
      invoiceMessage: unit.invoiceMessage || '',
      logo: unit.logo || '',
      isActive: unit.isActive !== false
    });
    setShowForm(true);
  };

  const handleDelete = async (unitId) => {
    if (window.confirm('Are you sure you want to delete this business unit?')) {
      try {
        await deleteDoc(doc(db, 'businessUnits', unitId));
      } catch (error) {
        console.error('Error deleting business unit:', error);
        alert('Failed to delete business unit');
      }
    }
  };

  const handleTagsChange = (newTags) => {
    setFormData(prev => ({ ...prev, tags: newTags }));
  };

  const handleLogoChange = (logoData) => {
    setFormData(prev => ({ ...prev, logo: logoData }));
  };

  const tradeOptions = [
    'Plumbing', 'HVAC', 'Electrical', 'General Contractor', 'Appliance Repair',
    'Carpet Cleaning', 'Pest Control', 'Landscaping', 'Pool Service', 'Roofing'
  ];

  const divisionOptions = [
    'Plumbing - Service', 'Plumbing - Installation', 'HVAC - Service', 'HVAC - Installation',
    'Electrical - Service', 'Electrical - Installation', 'Commercial', 'Residential'
  ];

  const warehouseOptions = [
    'Main Warehouse', 'North Location', 'South Location', 'East Location', 'West Location'
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Business Units</h1>
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors">
            Bulk Update
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Plus size={16} className="mr-2" />
            Add Business Unit
          </button>
        </div>
      </div>

      {/* Business Units List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
        {businessUnits.length === 0 ? (
          <div className="p-8 text-center">
            <Building size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
              No Business Units Yet
            </h4>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Create business units to organize your operations by location or service type.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add First Business Unit
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Business Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Contact Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trade & Division
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {businessUnits.map(unit => (
                  <tr key={unit.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {unit.logo && (
                          <img 
                            src={unit.logo} 
                            alt={unit.officialName} 
                            className="h-10 w-10 rounded-lg object-cover mr-3"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {unit.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {unit.officialName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      <div>
                        {unit.phoneNumber && (
                          <div className="flex items-center">
                            <Phone size={14} className="mr-1" />
                            {unit.phoneNumber}
                          </div>
                        )}
                        {unit.email && (
                          <div className="flex items-center">
                            <Mail size={14} className="mr-1" />
                            {unit.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      <div>
                        {unit.trade && <div>{unit.trade}</div>}
                        {unit.division && <div className="text-xs text-gray-500">{unit.division}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        unit.isActive 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {unit.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(unit)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(unit.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Business Unit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSave}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
                  {editingUnit ? 'Edit Business Unit' : 'Add Business Unit'}
                </h3>
                <button 
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingUnit(null);
                    setFormData({
                      name: '',
                      officialName: '',
                      email: '',
                      bccEmail: '',
                      phoneNumber: '',
                      trade: '',
                      division: '',
                      tags: [],
                      defaultWarehouse: '',
                      currency: 'USD',
                      invoiceHeader: '',
                      invoiceMessage: '',
                      logo: '',
                      isActive: true
                    });
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                >
                  <X size={16} className="text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Logo Upload */}
                <LogoUpload
                  currentLogo={formData.logo}
                  onLogoChange={handleLogoChange}
                  label="Business Unit Logo"
                />

                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Official Name *
                    </label>
                    <input
                      type="text"
                      value={formData.officialName}
                      onChange={(e) => setFormData(prev => ({ ...prev, officialName: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      BCC Email
                    </label>
                    <input
                      type="email"
                      value={formData.bccEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, bccEmail: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Trade
                    </label>
                    <select
                      value={formData.trade}
                      onChange={(e) => setFormData(prev => ({ ...prev, trade: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    >
                      <option value="">Select trade...</option>
                      {tradeOptions.map(trade => (
                        <option key={trade} value={trade}>{trade}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Division
                    </label>
                    <select
                      value={formData.division}
                      onChange={(e) => setFormData(prev => ({ ...prev, division: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    >
                      <option value="">Select division...</option>
                      {divisionOptions.map(division => (
                        <option key={division} value={division}>{division}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Default Warehouse
                    </label>
                    <select
                      value={formData.defaultWarehouse}
                      onChange={(e) => setFormData(prev => ({ ...prev, defaultWarehouse: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    >
                      <option value="">Select warehouse...</option>
                      {warehouseOptions.map(warehouse => (
                        <option key={warehouse} value={warehouse}>{warehouse}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    >
                      <option value="USD">USD</option>
                      <option value="CAD">CAD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tags
                  </label>
                  <TagInput
                    tags={formData.tags}
                    onTagsChange={handleTagsChange}
                    placeholder="Type and press Enter to add tags"
                  />
                </div>

                {/* Invoice Header */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Invoice Header
                  </label>
                  <textarea
                    value={formData.invoiceHeader}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceHeader: e.target.value }))}
                    rows={3}
                    placeholder="Company Name&#10;Address Line 1&#10;Address Line 2"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>

                {/* Invoice Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Invoice Message
                  </label>
                  <textarea
                    value={formData.invoiceMessage}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceMessage: e.target.value }))}
                    rows={3}
                    placeholder="Company Name&#10;License #M-44821, Technician Name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="mr-2"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                    Active
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingUnit(null);
                    setFormData({
                      name: '',
                      officialName: '',
                      email: '',
                      bccEmail: '',
                      phoneNumber: '',
                      trade: '',
                      division: '',
                      tags: [],
                      defaultWarehouse: '',
                      currency: 'USD',
                      invoiceHeader: '',
                      invoiceMessage: '',
                      logo: '',
                      isActive: true
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingUnit ? 'Update' : 'Create'} Business Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced Company Profile Component
const CompanyProfileManagement = ({ db, userId }) => {
  const [companyProfile, setCompanyProfile] = useState({
    companyName: '',
    businessAddress: '',
    city: '',
    state: '',
    zipCode: '',
    phoneNumber: '',
    email: '',
    website: '',
    logo: '',
    estimateAutoParagraph: '',
    invoiceAutoParagraph: '',
    taxId: '',
    licenseNumber: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load company profile
  useEffect(() => {
    if (!db || !userId) return;

    const companyProfileQuery = query(
      collection(db, 'companyProfiles'),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(companyProfileQuery, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const profileData = querySnapshot.docs[0].data();
        setCompanyProfile(profileData);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, userId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const profileData = {
        ...companyProfile,
        userId: userId,
        updatedAt: new Date().toISOString()
      };

      // Check if profile exists
      const companyProfileQuery = query(
        collection(db, 'companyProfiles'),
        where("userId", "==", userId)
      );
      
      const querySnapshot = await getDocs(companyProfileQuery);
      
      if (!querySnapshot.empty) {
        // Update existing profile
        const docId = querySnapshot.docs[0].id;
        await updateDoc(doc(db, 'companyProfiles', docId), profileData);
      } else {
        // Create new profile
        profileData.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'companyProfiles'), profileData);
      }

      alert('Company profile saved successfully!');
    } catch (error) {
      console.error('Error saving company profile:', error);
      alert('Failed to save company profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoChange = (logoData) => {
    setCompanyProfile(prev => ({ ...prev, logo: logoData }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600 dark:text-gray-300">Loading company profile...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Company Profile</h1>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-gray-100 dark:border-slate-700">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Company Logo */}
          <LogoUpload
            currentLogo={companyProfile.logo}
            onLogoChange={handleLogoChange}
            label="Company Logo"
          />

          {/* Basic Company Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Company Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyProfile.companyName}
                  onChange={(e) => setCompanyProfile(prev => ({ ...prev, companyName: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={companyProfile.phoneNumber}
                  onChange={(e) => setCompanyProfile(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={companyProfile.email}
                  onChange={(e) => setCompanyProfile(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={companyProfile.website}
                  onChange={(e) => setCompanyProfile(prev => ({ ...prev, website: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  placeholder="https://yourwebsite.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tax ID / EIN
                </label>
                <input
                  type="text"
                  value={companyProfile.taxId}
                  onChange={(e) => setCompanyProfile(prev => ({ ...prev, taxId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  placeholder="XX-XXXXXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  License Number
                </label>
                <input
                  type="text"
                  value={companyProfile.licenseNumber}
                  onChange={(e) => setCompanyProfile(prev => ({ ...prev, licenseNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  placeholder="M-44821"
                />
              </div>
            </div>
          </div>

          {/* Business Address */}
          <div>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Business Address</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Business Address
                </label>
                <input
                  type="text"
                  value={companyProfile.businessAddress}
                  onChange={(e) => setCompanyProfile(prev => ({ ...prev, businessAddress: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  placeholder="Enter business address"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={companyProfile.city}
                    onChange={(e) => setCompanyProfile(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    placeholder="Enter city"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    State
                  </label>
                  <select 
                    value={companyProfile.state}
                    onChange={(e) => setCompanyProfile(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="">Select state</option>
                    <option value="TX">Texas</option>
                    <option value="CA">California</option>
                    <option value="FL">Florida</option>
                    <option value="NY">New York</option>
                    {/* Add more states as needed */}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={companyProfile.zipCode}
                    onChange={(e) => setCompanyProfile(prev => ({ ...prev, zipCode: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    placeholder="Enter ZIP code"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Auto Paragraphs for Estimates and Invoices */}
          <div>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Document Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Estimate Auto Paragraph
                </label>
                <textarea
                  value={companyProfile.estimateAutoParagraph}
                  onChange={(e) => setCompanyProfile(prev => ({ ...prev, estimateAutoParagraph: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  placeholder="Enter text that will automatically appear on all estimates..."
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This text will automatically be added to all estimates generated in the system.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Invoice Auto Paragraph
                </label>
                <textarea
                  value={companyProfile.invoiceAutoParagraph}
                  onChange={(e) => setCompanyProfile(prev => ({ ...prev, invoiceAutoParagraph: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  placeholder="Enter text that will automatically appear on all invoices..."
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This text will automatically be added to all invoices generated in the system.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button 
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Settings: React.FC = () => {
  const [expandedSections, setExpandedSections] = useState<string[]>(['Your Account']);
  const [selectedItem, setSelectedItem] = useState<string>('company-profile');
  const [searchTerm, setSearchTerm] = useState('');
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffType, setStaffType] = useState<'office' | 'technician'>('office');
  const [editingStaff, setEditingStaff] = useState(null);
  
  // Firebase state
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [officeStaff, setOfficeStaff] = useState([]);
  const [technicians, setTechnicians] = useState([]);

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

  // Load staff members
  useEffect(() => {
    if (!db || !userId) return;

    // Load office staff
    const officeQuery = query(
      collection(db, 'staff'),
      where("userId", "==", userId),
      where("staffType", "==", "office")
    );
    
    const unsubscribeOffice = onSnapshot(officeQuery, (querySnapshot) => {
      const officeData = [];
      querySnapshot.forEach((doc) => {
        officeData.push({ id: doc.id, ...doc.data() });
      });
      setOfficeStaff(officeData);
    });

    // Load technicians
    const techQuery = query(
      collection(db, 'staff'),
      where("userId", "==", userId),
      where("staffType", "==", "technician")
    );
    
    const unsubscribeTech = onSnapshot(techQuery, (querySnapshot) => {
      const techData = [];
      querySnapshot.forEach((doc) => {
        techData.push({ id: doc.id, ...doc.data() });
      });
      setTechnicians(techData);
    });
    
    return () => {
      unsubscribeOffice();
      unsubscribeTech();
    };
  }, [db, userId]);

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionName)
        ? prev.filter(name => name !== sectionName)
        : [...prev, sectionName]
    );
  };

  const handleItemClick = (path: string) => {
    setSelectedItem(path);
  };

  const handleSaveStaff = useCallback(async (staffData, staffId = null) => {
    if (db && userId) {
      try {
        const staffDataWithUser = {
          ...staffData,
          userId: userId
        };
        
        if (staffId) {
          // Update existing staff member
          await updateDoc(doc(db, 'staff', staffId), staffDataWithUser);
        } else {
          // Create new staff member
          const customId = `staff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          await setDoc(doc(db, 'staff', customId), staffDataWithUser);
        }
        
        setShowStaffForm(false);
        setEditingStaff(null);
      } catch (e) {
        console.error("Error saving staff member:", e);
        setError("Failed to save staff member");
      }
    }
  }, [db, userId]);

  const handleDeleteStaff = useCallback(async (staffId) => {
    if (db && window.confirm("Are you sure you want to delete this staff member?")) {
      try {
        await deleteDoc(doc(db, 'staff', staffId));
      } catch (e) {
        console.error("Error deleting staff member:", e);
        setError("Failed to delete staff member");
      }
    }
  }, [db]);

  const handleEditStaff = (staffMember) => {
    setEditingStaff(staffMember);
    setStaffType(staffMember.staffType);
    setShowStaffForm(true);
  };

  const handleAddStaff = (type) => {
    setEditingStaff(null);
    setStaffType(type);
    setShowStaffForm(true);
  };

  const filteredSections = settingsSections.map(section => ({
      ...section,
      items: section.items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
  })).filter(section => section.items.length > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600 dark:text-gray-300">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Settings Navigation Sidebar */}
      <div className="w-64 border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Search settings..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-y-auto flex-1">
          {filteredSections.map(section => (
            <div key={section.name} className="border-b border-gray-200 dark:border-slate-700">
              <button
                onClick={() => toggleSection(section.name)}
                className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{section.name}</span>
                {expandedSections.includes(section.name) ? (
                  <ChevronDown size={16} className="text-gray-400" />
                ) : (
                  <ChevronRight size={16} className="text-gray-400" />
                )}
              </button>
              
              {expandedSections.includes(section.name) && (
                <div className="bg-gray-50 dark:bg-slate-800/50">
                  {section.items.map(item => (
                    <button
                      key={item.path}
                      onClick={() => handleItemClick(item.path)}
                      className={`w-full px-8 py-2 text-left text-sm transition-colors ${
                        selectedItem === item.path
                          ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/50'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Settings Content Area */}
      <div className="flex-1 bg-gray-50 dark:bg-slate-900 overflow-y-auto p-6">
        {error && (
          <div className="mb-6 p-4 text-center text-red-600 bg-red-50 rounded-lg dark:bg-red-900/50 dark:text-red-300">
            <b>Error:</b> {error}
          </div>
        )}

        {/* Office Staff Management */}
        {selectedItem === 'office' && (
          <div>
            <div className="flex items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Office Staff</h1>
            </div>
            
            <StaffList
              staffType="office"
              staff={officeStaff}
              onAdd={() => handleAddStaff('office')}
              onEdit={handleEditStaff}
              onDelete={handleDeleteStaff}
            />
          </div>
        )}

        {/* Technicians Management */}
        {selectedItem === 'technicians' && (
          <div>
            <div className="flex items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Technicians</h1>
            </div>
            
            <StaffList
              staffType="technician"
              staff={technicians}
              onAdd={() => handleAddStaff('technician')}
              onEdit={handleEditStaff}
              onDelete={handleDeleteStaff}
            />
          </div>
        )}

        {/* Business Units Management */}
        {selectedItem === 'business-units' && (
          <BusinessUnitsManagement db={db} userId={userId} />
        )}

        {/* Enhanced Company Profile */}
        {selectedItem === 'company-profile' && (
          <CompanyProfileManagement db={db} userId={userId} />
        )}
        
        {/* Placeholder for other settings pages */}
        {selectedItem !== 'company-profile' && selectedItem !== 'office' && selectedItem !== 'technicians' && selectedItem !== 'business-units' && (
           <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-gray-100 dark:border-slate-700">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 capitalize">{selectedItem.replace(/-/g, ' ')}</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Settings for this section will appear here.</p>
           </div>
        )}
      </div>

      {/* Staff Form Modal */}
      {showStaffForm && (
        <StaffForm
          onCancel={() => {
            setShowStaffForm(false);
            setEditingStaff(null);
          }}
          onSave={handleSaveStaff}
          staffType={staffType}
          editingStaff={editingStaff}
        />
      )}
    </div>
  );
};

export default Settings;