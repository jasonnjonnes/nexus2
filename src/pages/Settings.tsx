import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Search, Plus, X, User, Mail, Phone, MapPin, Calendar, Shield, Building, Camera, Edit, Palette, Upload, Image, UserPlus } from 'lucide-react';
import { 
  Firestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, 
  query, where, setDoc, getDocs 
} from "firebase/firestore";
import GLAccounts from '../components/GLAccounts';
import StaffInvitationModal from '../components/StaffInvitationModal';
import AuthMethodManager from '../components/AuthMethodManager';
import StripeAccountOnboarding from '../components/StripeAccountOnboarding';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { db } from '../firebase';

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
      { name: 'Authentication Methods', path: 'auth-methods' },
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
    name: 'Dispatch Board',
    items: [
      { name: 'Alerts', path: 'dispatch-alerts' },
      { name: 'Clock In/Out', path: 'clock-in-out' },
      { name: 'Job Confirmations', path: 'job-confirmations' }
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
interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  onClose: () => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ 
  selectedColor,
  onColorChange,
  onClose
}) => {
  const [customColor, setCustomColor] = useState<string>(selectedColor || '#3B82F6');

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
interface LogoUploadProps {
  currentLogo: string;
  onLogoChange: (dataUrl: string) => void;
  label?: string;
}

const LogoUpload = ({ 
  currentLogo, 
  onLogoChange, 
  label = "Logo" 
}: LogoUploadProps): JSX.Element => {
  const [logoPreview, setLogoPreview] = useState<string>(currentLogo || '');
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) { setError('File size must be less than 2MB'); return; }

      // Validate file type
      if (!file.type.match(/^image\/(jpeg|png|svg\+xml)$/)) { setError('File must be JPG, PNG or SVG'); return; }

      setError(null);
      // Moved if (file) block inside try so that the function is closed properly
      if (file) {
         const reader = new FileReader();
         reader.onload = (e) => { 
           const dataUrl = e.target?.result;
           if (dataUrl && typeof dataUrl === 'string') {
             setLogoPreview(dataUrl); 
             onLogoChange(dataUrl); 
           }
         };
         reader.readAsDataURL(file);
      }
    } catch (err) { console.error("Error processing file:", err); setError("An error occurred while processing the file."); }
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
interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
}

const TagInput: React.FC<TagInputProps> = ({ tags, onTagsChange, placeholder = "Type and press Enter to add tags" }) => {
  const [currentTag, setCurrentTag] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && currentTag.trim()) {
      e.preventDefault();
      if (!tags.includes(currentTag.trim())) {
        onTagsChange([...tags, currentTag.trim()]);
      }
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
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
interface StaffFormProps {
  onCancel: () => void;
  onSave: (staffData: Omit<StaffMember, 'id'>) => void;
  staffType: 'office' | 'technician';
  editingStaff: StaffMember | null;
}

const StaffForm: React.FC<StaffFormProps> = ({ onCancel, onSave, staffType, editingStaff }) => {
  const [formData, setFormData] = useState<Omit<StaffMember, 'id'>>({
    userId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    homeAddress: '',
    dateOfBirth: '',
    socialSecurityNumber: '',
    role: '',
    businessUnit: '',
    profilePicture: '',
    color: '',
    type: staffType,
    fullName: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active'
  });

  useEffect(() => {
    if (editingStaff) {
      const { id, ...staffData } = editingStaff;
      setFormData(staffData);
    }
  }, [editingStaff]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    onSave({
      ...formData,
      fullName,
      type: staffType,
      updatedAt: new Date().toISOString()
    });
  };

  const [profilePicturePreview, setProfilePicturePreview] = useState(editingStaff?.profilePicture || '');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: String(value)
    }));
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result;
        if (dataUrl && typeof dataUrl === 'string') {
          setProfilePicturePreview(dataUrl);
          setFormData(prev => ({ ...prev, profilePicture: dataUrl }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleColorChange = (color: string) => {
    setFormData(prev => ({ ...prev, color }));
    setShowColorPicker(false);
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

          <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingStaff ? 'Update' : 'Create'} {staffType === 'office' ? 'Office Staff' : 'Technician'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Staff List Component
interface StaffListProps {
  staffType: 'office' | 'technician';
  staff: StaffMember[];
  onEdit: (staff: StaffMember) => void;
  onDelete: (staffId: string) => void;
  onSetEditingStaff: (staff: StaffMember | null) => void;
  onInvite: () => void;
}

const StaffList: React.FC<StaffListProps> = ({
  staffType,
  staff,
  onEdit,
  onDelete,
  onSetEditingStaff,
  onInvite
}) => {
  type RoleColor = {
    [key: string]: string;
  };

  const getRoleColor = (role: string): string => {
    const roleColors: RoleColor = {
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {staffType === 'office' ? 'Office Staff' : 'Technicians'}
        </h3>
        <div className="flex items-center space-x-3">
          <button 
            onClick={onInvite}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <UserPlus size={16} className="mr-2" />
            {staffType === 'office' ? 'Add Office Staff' : 'Add Technician'}
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
            onClick={onInvite}
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
                        onClick={() => {
                          onSetEditingStaff(member);
                          onEdit(member);
                        }}
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
interface BusinessUnitsManagementProps {
  db: Firestore;
  userId: string;
  tenantId: string;
}

interface BusinessUnitFormData extends Omit<BusinessUnit, 'id' | 'userId'> {
  name: string;
  officialName: string;
  email: string;
  bccEmail: string;
  phoneNumber: string;
  trade: string;
  division: string;
  tags: string[];
  defaultWarehouse: string;
  currency: string;
  invoiceHeader: string;
  invoiceMessage: string;
  logo: string;
  isActive: boolean;
}

const BusinessUnitsManagement: React.FC<BusinessUnitsManagementProps> = ({ db, userId, tenantId }) => {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [editingUnit, setEditingUnit] = useState<BusinessUnit | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState<BusinessUnitFormData>({
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
    invoiceHeader: 'I hereby authorize {businessunit_companyname} to proceed with the work described in the attached proposal/estimate dated [Date], including all materials, labor, and services specified therein, for the total amount of ${invoicetotal}. I understand and agree to the terms and conditions outlined in this agreement, including the project timeline, payment schedule, and scope of work. By signing below, I confirm that I have the authority to approve this work and commit to payment upon satisfactory completion.',
    invoiceMessage: 'Thanks for doing business with us!',
    logo: '',
    isActive: true
  });

  useEffect(() => {
    if (!db || !userId) return;

    const businessUnitsQuery = query(
      collection(db, 'tenants', tenantId, 'businessUnits'),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(businessUnitsQuery, (querySnapshot) => {
      const units: BusinessUnit[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        units.push({
          id: doc.id,
          userId,
          name: data.name || '',
          officialName: data.officialName || '',
          email: data.email || '',
          bccEmail: data.bccEmail || '',
          phoneNumber: data.phoneNumber || '',
          trade: data.trade || '',
          division: data.division || '',
          tags: data.tags || [],
          defaultWarehouse: data.defaultWarehouse || '',
          currency: data.currency || 'USD',
          invoiceHeader: data.invoiceHeader || '',
          invoiceMessage: data.invoiceMessage || '',
          logo: data.logo || '',
          isActive: data.isActive ?? true,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });
      setBusinessUnits(units);
      setIsLoading(false);
    }, (error) => {
      console.error("Error loading business units:", error);
      setError("Failed to load business units");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, userId]);

  const handleDelete = async (unitId: string): Promise<void> => {
    if (!db) {
      setError("Database not ready. Please try again.");
      return;
    }

    if (window.confirm("Are you sure you want to delete this business unit?")) {
      try {
        await deleteDoc(doc(db, 'tenants', tenantId, 'businessUnits', unitId));
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Failed to delete business unit";
        console.error("Error deleting business unit:", e);
        setError(errorMessage);
      }
    }
  };

  const handleTagsChange = (newTags: string[]): void => {
    setFormData(prev => ({ ...prev, tags: newTags }));
  };

  const handleLogoChange = (logoData: string): void => {
    setFormData(prev => ({ ...prev, logo: logoData }));
  };

  const handleEdit = (unit: BusinessUnit): void => {
    setEditingUnit(unit);
    setShowForm(true);
    setFormData({
      name: unit.name,
      officialName: unit.officialName,
      email: unit.email,
      bccEmail: unit.bccEmail,
      phoneNumber: unit.phoneNumber,
      trade: unit.trade,
      division: unit.division,
      tags: unit.tags,
      defaultWarehouse: unit.defaultWarehouse,
      currency: unit.currency,
      invoiceHeader: unit.invoiceHeader,
      invoiceMessage: unit.invoiceMessage,
      logo: unit.logo,
      isActive: unit.isActive
    });
  };

  const handleAdd = (): void => {
    setEditingUnit(null);
    setShowForm(true);
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
      invoiceHeader: 'I hereby authorize {businessunit_companyname} to proceed with the work described in the attached proposal/estimate dated [Date], including all materials, labor, and services specified therein, for the total amount of ${invoicetotal}. I understand and agree to the terms and conditions outlined in this agreement, including the project timeline, payment schedule, and scope of work. By signing below, I confirm that I have the authority to approve this work and commit to payment upon satisfactory completion.',
      invoiceMessage: 'Thanks for doing business with us!',
      logo: '',
      isActive: true
    });
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!db || !userId) {
      setError("Database not ready. Please try again.");
      return;
    }

    try {
      const unitData = {
        ...formData,
        userId,
        updatedAt: new Date().toISOString()
      };

      if (editingUnit) {
                  await updateDoc(doc(db, 'tenants', tenantId, 'businessUnits', editingUnit.id), unitData);
      } else {
        unitData.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'tenants', tenantId, 'businessUnits'), unitData);
      }

      setEditingUnit(null);
      setShowForm(false);
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
        invoiceHeader: 'I hereby authorize {businessunit_companyname} to proceed with the work described in the attached proposal/estimate dated [Date], including all materials, labor, and services specified therein, for the total amount of ${invoicetotal}. I understand and agree to the terms and conditions outlined in this agreement, including the project timeline, payment schedule, and scope of work. By signing below, I confirm that I have the authority to approve this work and commit to payment upon satisfactory completion.',
        invoiceMessage: 'Thanks for doing business with us!',
        logo: '',
        isActive: true
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to save business unit";
      console.error("Error saving business unit:", e);
      setError(errorMessage);
    }
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
            onClick={handleAdd}
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
              onClick={handleAdd}
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
                    setEditingUnit(null);
                    setShowForm(false);
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
                      invoiceHeader: 'I hereby authorize {businessunit_companyname} to proceed with the work described in the attached proposal/estimate dated [Date], including all materials, labor, and services specified therein, for the total amount of ${invoicetotal}. I understand and agree to the terms and conditions outlined in this agreement, including the project timeline, payment schedule, and scope of work. By signing below, I confirm that I have the authority to approve this work and commit to payment upon satisfactory completion.',
                      invoiceMessage: 'Thanks for doing business with us!',
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
                      Company Name *
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
                      Business Unit Name *
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

                {/* Authorization Paragraph */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Authorization Paragraph
                  </label>
                  <textarea
                    value={formData.invoiceHeader}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceHeader: e.target.value }))}
                    rows={4}
                    placeholder="I hereby authorize {businessunit_companyname} to proceed with the work described in the attached proposal/estimate dated [Date], including all materials, labor, and services specified therein, for the total amount of ${invoicetotal}. I understand and agree to the terms and conditions outlined in this agreement, including the project timeline, payment schedule, and scope of work. By signing below, I confirm that I have the authority to approve this work and commit to payment upon satisfactory completion."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>

                {/* Company Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company Message
                  </label>
                  <textarea
                    value={formData.invoiceMessage}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceMessage: e.target.value }))}
                    rows={2}
                    placeholder="Thanks for doing business with us!"
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
                      invoiceHeader: 'I hereby authorize {businessunit_companyname} to proceed with the work described in the attached proposal/estimate dated [Date], including all materials, labor, and services specified therein, for the total amount of ${invoicetotal}. I understand and agree to the terms and conditions outlined in this agreement, including the project timeline, payment schedule, and scope of work. By signing below, I confirm that I have the authority to approve this work and commit to payment upon satisfactory completion.',
                      invoiceMessage: 'Thanks for doing business with us!',
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

// Job Types Management Component
interface JobTypesManagementProps {
  db: Firestore;
  userId: string;
  tenantId: string;
}

interface JobType {
  id: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

interface JobTypeFormData extends Omit<JobType, 'id' | 'userId'> {
  name: string;
  description: string;
  category: string;
  isActive: boolean;
}

const JobTypesManagement: React.FC<JobTypesManagementProps> = ({ db, userId, tenantId }) => {
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [editingJobType, setEditingJobType] = useState<JobType | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState<JobTypeFormData>({
    name: '',
    description: '',
    category: '',
    isActive: true
  });

  useEffect(() => {
    if (!db || !userId) return;

    const jobTypesQuery = query(
      collection(db, 'tenants', tenantId, 'jobTypes'),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(jobTypesQuery, (querySnapshot) => {
      const types: JobType[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        types.push({
          id: doc.id,
          userId,
          name: data.name || '',
          description: data.description || '',
          category: data.category || '',
          isActive: data.isActive ?? true,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });
      setJobTypes(types);
      setIsLoading(false);
    }, (error) => {
      console.error("Error loading job types:", error);
      setError("Failed to load job types");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, userId]);

  const handleDelete = async (jobTypeId: string): Promise<void> => {
    if (!db) {
      setError("Database not ready. Please try again.");
      return;
    }

    if (window.confirm("Are you sure you want to delete this job type?")) {
      try {
        await deleteDoc(doc(db, 'tenants', tenantId, 'jobTypes', jobTypeId));
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Failed to delete job type";
        console.error("Error deleting job type:", e);
        setError(errorMessage);
      }
    }
  };

  const handleEdit = (jobType: JobType): void => {
    setEditingJobType(jobType);
    setShowForm(true);
    setFormData({
      name: jobType.name,
      description: jobType.description,
      category: jobType.category,
      isActive: jobType.isActive
    });
  };

  const handleAdd = (): void => {
    setEditingJobType(null);
    setShowForm(true);
    setFormData({
      name: '',
      description: '',
      category: '',
      isActive: true
    });
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!db || !userId) {
      setError("Database not ready. Please try again.");
      return;
    }

    try {
      const jobTypeData = {
        ...formData,
        userId,
        updatedAt: new Date().toISOString()
      };

      if (editingJobType) {
        await updateDoc(doc(db, 'tenants', tenantId, 'jobTypes', editingJobType.id), jobTypeData);
      } else {
        jobTypeData.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'tenants', tenantId, 'jobTypes'), jobTypeData);
      }

      setEditingJobType(null);
      setShowForm(false);
      setFormData({
        name: '',
        description: '',
        category: '',
        isActive: true
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to save job type";
      console.error("Error saving job type:", e);
      setError(errorMessage);
    }
  };

  const categoryOptions = [
    'Service Call',
    'Installation',
    'Maintenance',
    'Repair',
    'Inspection',
    'Emergency',
    'Estimate',
    'Diagnosis'
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Job Types</h1>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus size={16} className="mr-2" />
          Add Job Type
        </button>
      </div>

      {/* Job Types List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
        {jobTypes.length === 0 ? (
          <div className="p-8 text-center">
            <Briefcase size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
              No Job Types Yet
            </h4>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Create job types to categorize different types of work your company performs.
            </p>
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add First Job Type
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Job Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
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
                {jobTypes.map(jobType => (
                  <tr key={jobType.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {jobType.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {jobType.category}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {jobType.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        jobType.isActive 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {jobType.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(jobType)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(jobType.id)}
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

      {/* Job Type Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSave}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
                  {editingJobType ? 'Edit Job Type' : 'Add Job Type'}
                </h3>
                <button 
                  type="button"
                  onClick={() => {
                    setEditingJobType(null);
                    setShowForm(false);
                    setFormData({
                      name: '',
                      description: '',
                      category: '',
                      isActive: true
                    });
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                >
                  <X size={16} className="text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Job Type Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    placeholder="e.g., AC Repair, HVAC Installation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="">Select category...</option>
                    {categoryOptions.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    placeholder="Brief description of this job type..."
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
                    setEditingJobType(null);
                    setShowForm(false);
                    setFormData({
                      name: '',
                      description: '',
                      category: '',
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
                  {editingJobType ? 'Update' : 'Create'} Job Type
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
interface CompanyProfileManagementProps {
  db: Firestore;
  userId: string;
  tenantId: string;
}

interface CompanyProfileFormData extends Omit<CompanyProfile, 'id' | 'userId'> {
  companyName: string;
  phoneNumber: string;
  email: string;
  website: string;
  taxId: string;
  licenseNumber: string;
  businessAddress: string;
  city: string;
  state: string;
  zipCode: string;
  logo: string;
  estimateAutoParagraph: string;
  invoiceAutoParagraph: string;
}

const CompanyProfileManagement: React.FC<CompanyProfileManagementProps> = ({ db, userId, tenantId }) => {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [formData, setFormData] = useState<CompanyProfileFormData>({
    companyName: '',
    phoneNumber: '',
    email: '',
    website: '',
    taxId: '',
    licenseNumber: '',
    businessAddress: '',
    city: '',
    state: '',
    zipCode: '',
    logo: '',
    estimateAutoParagraph: '',
    invoiceAutoParagraph: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!db || !userId || !tenantId) return;

    const profileRef = doc(db, 'tenants', tenantId, 'settings', 'companyProfile');
    const unsubscribe = onSnapshot(profileRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const profileData: CompanyProfile = {
          id: doc.id,
          userId,
          companyName: data.companyName || '',
          phoneNumber: data.phoneNumber || '',
          email: data.email || '',
          website: data.website || '',
          taxId: data.taxId || '',
          licenseNumber: data.licenseNumber || '',
          businessAddress: data.businessAddress || '',
          city: data.city || '',
          state: data.state || '',
          zipCode: data.zipCode || '',
          logo: data.logo || '',
          estimateAutoParagraph: data.estimateAutoParagraph || '',
          invoiceAutoParagraph: data.invoiceAutoParagraph || ''
        };
        setProfile(profileData);
        setFormData({
          companyName: profileData.companyName,
          phoneNumber: profileData.phoneNumber,
          email: profileData.email,
          website: profileData.website,
          taxId: profileData.taxId,
          licenseNumber: profileData.licenseNumber,
          businessAddress: profileData.businessAddress,
          city: profileData.city,
          state: profileData.state,
          zipCode: profileData.zipCode,
          logo: profileData.logo,
          estimateAutoParagraph: profileData.estimateAutoParagraph,
          invoiceAutoParagraph: profileData.invoiceAutoParagraph
        });
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error loading company profile:", error);
      setError("Failed to load company profile");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, userId]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!db || !userId) {
      setError("Database not ready. Please try again.");
      return;
    }

    try {
      setIsSaving(true);
      const profileRef = doc(db, 'tenants', tenantId, 'settings', 'companyProfile');
      await setDoc(profileRef, {
        ...formData,
        userId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to save company profile";
      console.error("Error saving company profile:", e);
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoChange = (logoData: string): void => {
    setFormData(prev => ({ ...prev, logo: logoData }));
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
            currentLogo={formData.logo}
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
                  value={formData.companyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
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
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
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
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
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
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
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
                  value={formData.taxId}
                  onChange={(e) => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
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
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
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
                  value={formData.businessAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessAddress: e.target.value }))}
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
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    placeholder="Enter city"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    State
                  </label>
                  <select 
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
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
                    value={formData.zipCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
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
                  value={formData.estimateAutoParagraph}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimateAutoParagraph: e.target.value }))}
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
                  value={formData.invoiceAutoParagraph}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoiceAutoParagraph: e.target.value }))}
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

// Add type definitions at the top of the file
interface StaffMember {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  homeAddress: string;
  dateOfBirth: string;
  socialSecurityNumber: string;
  role: string;
  businessUnit: string;
  profilePicture: string;
  color: string;
  type: 'office' | 'technician';  // Changed from staffType to type
  fullName: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'inactive';
}

interface BusinessUnit {
  id: string;
  name: string;
  officialName: string;
  email: string;
  bccEmail: string;
  phoneNumber: string;
  trade: string;
  division: string;
  tags: string[];
  defaultWarehouse: string;
  currency: string;
  invoiceHeader: string;
  invoiceMessage: string;
  logo: string;
  isActive: boolean;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CompanyProfile {
  id: string;
  companyName: string;
  phoneNumber: string;
  email: string;
  website: string;
  taxId: string;
  licenseNumber: string;
  businessAddress: string;
  city: string;
  state: string;
  zipCode: string;
  logo: string;
  estimateAutoParagraph: string;
  invoiceAutoParagraph: string;
  userId: string;
}

const Settings: React.FC = () => {
  const { user, tenantId } = useFirebaseAuth();
  const userId = user?.uid;
  const [expandedSections, setExpandedSections] = useState<string[]>(['Staff Management']);
  const [selectedItem, setSelectedItem] = useState<string>('company-profile');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Separate state for office staff and technicians
  const [showOfficeStaffForm, setShowOfficeStaffForm] = useState(false);
  const [showTechnicianForm, setShowTechnicianForm] = useState(false);
  const [editingOfficeStaff, setEditingOfficeStaff] = useState<StaffMember | null>(null);
  const [editingTechnician, setEditingTechnician] = useState<StaffMember | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteStaffType, setInviteStaffType] = useState<'office' | 'technician'>('office');
  
  // Remove old Firebase state - use context instead
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [officeStaff, setOfficeStaff] = useState<StaffMember[]>([]);
  const [technicians, setTechnicians] = useState<StaffMember[]>([]);

  const loadStaff = async () => {
    if (!db || !userId || !tenantId) return;

    try {
      const staffRef = collection(db, 'tenants', tenantId, 'staff');
      const staffSnapshot = await getDocs(staffRef);
      const staffList = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StaffMember[];

      setOfficeStaff(staffList.filter(staff => staff.type === 'office'));
      setTechnicians(staffList.filter(staff => staff.type === 'technician'));
    } catch (err) {
      console.error('Error loading staff:', err);
      setError('Failed to load staff members. Please try again.');
    }
  };

  useEffect(() => {
    if (db && userId && tenantId) {
      setIsLoading(true);
      loadStaff().finally(() => setIsLoading(false));
    }
  }, [db, userId, tenantId]);

  const handleSaveStaff = async (staffData: Omit<StaffMember, 'id'>) => {
    if (!db || !userId || !tenantId) return;

    try {
      const staffRef = collection(db, 'tenants', tenantId, 'staff');
      const staffDataWithUser = {
        ...staffData,
        userId,
        type: staffData.type,
        updatedAt: new Date().toISOString()
      };

      if (staffData.type === 'office' && editingOfficeStaff) {
        await updateDoc(doc(staffRef, editingOfficeStaff.id), staffDataWithUser);
        setShowOfficeStaffForm(false);
        setEditingOfficeStaff(null);
      } else if (staffData.type === 'technician' && editingTechnician) {
        await updateDoc(doc(staffRef, editingTechnician.id), staffDataWithUser);
        setShowTechnicianForm(false);
        setEditingTechnician(null);
      } else {
        // Add new staff
        staffDataWithUser.createdAt = new Date().toISOString();
        await addDoc(staffRef, staffDataWithUser);
        if (staffData.type === 'office') {
          setShowOfficeStaffForm(false);
        } else {
          setShowTechnicianForm(false);
        }
      }
      // Refresh staff list
      await loadStaff();
    } catch (err) {
      console.error('Error saving staff:', err);
      setError('Failed to save staff member. Please try again.');
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!db || !userId || !tenantId) return;

    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        await deleteDoc(doc(db, 'tenants', tenantId, 'staff', staffId));
        // Refresh staff list
        await loadStaff();
      } catch (err) {
        console.error('Error deleting staff:', err);
        setError('Failed to delete staff member. Please try again.');
      }
    }
  };

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

  const handleEditOfficeStaff = (staff: StaffMember) => {
    setEditingOfficeStaff(staff);
    setShowOfficeStaffForm(true);
  };

  const handleEditTechnician = (staff: StaffMember) => {
    setEditingTechnician(staff);
    setShowTechnicianForm(true);
  };

  const handleAddOfficeStaff = () => {
    setEditingOfficeStaff(null);
    setShowOfficeStaffForm(true);
  };

  const handleAddTechnician = () => {
    setEditingTechnician(null);
    setShowTechnicianForm(true);
  };

  const handleInviteOfficeStaff = () => {
    setInviteStaffType('office');
    setShowInviteModal(true);
  };

  const handleInviteTechnician = () => {
    setInviteStaffType('technician');
    setShowInviteModal(true);
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900 p-6">
        {error && (
          <div className="mb-6 p-4 text-center text-red-600 bg-red-50 rounded-lg dark:bg-red-900/50 dark:text-red-300">
            <b>Error:</b> {error}
          </div>
        )}
        
                  {selectedItem === 'auth-methods' && (
                    <div className="max-w-4xl">
                      <AuthMethodManager />
                    </div>
                  )}
                  {selectedItem === 'payment-processing' && (
                    <StripeAccountOnboarding />
                  )}
                  {selectedItem === 'company-profile' && db && userId && tenantId && (
                           <CompanyProfileManagement db={db} userId={userId} tenantId={tenantId} />
          )}
          {selectedItem === 'business-units' && db && userId && tenantId && (
                           <BusinessUnitsManagement db={db} userId={userId} tenantId={tenantId} />
          )}
          {selectedItem === 'job-types' && db && userId && tenantId && (
                           <JobTypesManagement db={db} userId={userId} tenantId={tenantId} />
          )}
        
        {selectedItem === 'office' && db && userId && (
          <div className="space-y-6">
            <StaffList
              staffType="office"
              staff={officeStaff}
              onEdit={handleEditOfficeStaff}
              onDelete={handleDeleteStaff}
              onSetEditingStaff={setEditingOfficeStaff}
              onInvite={handleInviteOfficeStaff}
            />
            {showOfficeStaffForm && (
              <StaffForm
                onCancel={() => {
                  setShowOfficeStaffForm(false);
                  setEditingOfficeStaff(null);
                }}
                onSave={handleSaveStaff}
                staffType="office"
                editingStaff={editingOfficeStaff}
              />
            )}
          </div>
        )}
        
        {selectedItem === 'technicians' && db && userId && (
          <div className="space-y-6">
            <StaffList
              staffType="technician"
              staff={technicians}
              onEdit={handleEditTechnician}
              onDelete={handleDeleteStaff}
              onSetEditingStaff={setEditingTechnician}
              onInvite={handleInviteTechnician}
            />
            {showTechnicianForm && (
              <StaffForm
                onCancel={() => {
                  setShowTechnicianForm(false);
                  setEditingTechnician(null);
                }}
                onSave={handleSaveStaff}
                staffType="technician"
                editingStaff={editingTechnician}
              />
            )}
          </div>
        )}
        {selectedItem === 'gl-accounts' && (
          <GLAccounts />
        )}
      </div>

      {/* Staff Invitation Modal */}
      <StaffInvitationModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        staffType={inviteStaffType}
      />
    </div>
  );
};

export default Settings;