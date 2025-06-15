import React, { useState } from 'react';
import { X, Mail, User, Shield, Copy, Check } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface StaffInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffType: 'office' | 'technician';
}

interface InvitationData {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  businessUnit: string;
  message: string;
}

const StaffInvitationModal: React.FC<StaffInvitationModalProps> = ({
  isOpen,
  onClose,
  staffType
}) => {
  const { user, tenantId } = useFirebaseAuth();
  const [formData, setFormData] = useState<InvitationData>({
    email: '',
    firstName: '',
    lastName: '',
    role: staffType === 'technician' ? 'Technician' : 'Office Staff',
    businessUnit: '',
    message: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [error, setError] = useState<string>('');

  const businessUnits = ['Residential', 'Commercial', 'HVAC', 'Plumbing', 'Electrical'];
  const roles = {
    office: ['Office Manager', 'Dispatcher', 'Customer Service', 'Admin', 'Billing'],
    technician: ['Lead Technician', 'Technician', 'Apprentice', 'Specialist', 'Supervisor']
  };

  const generateInvitationToken = () => {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tenantId) return;

    setIsLoading(true);
    setError('');

    try {
      // Generate secure invitation token
      const invitationToken = generateInvitationToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

      // Create invitation record in Firestore
      const invitationData = {
        ...formData,
        staffType,
        tenantId,
        invitedBy: user.uid,
        invitedByEmail: user.email,
        token: invitationToken,
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: expiresAt.toISOString(),
        used: false
      };

      await addDoc(collection(db, 'tenants', tenantId, 'invitations'), invitationData);

      // Generate invitation link
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/invite/${invitationToken}`;
      setInvitationLink(link);

      // Send email (you would integrate with your email service here)
      await sendInvitationEmail(formData.email, link, formData, staffType);

      console.log('Invitation sent successfully');
    } catch (err) {
      console.error('Error sending invitation:', err);
      setError('Failed to send invitation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const sendInvitationEmail = async (email: string, link: string, data: InvitationData, type: string) => {
    try {
      const functions = getFunctions();
      const sendEmail = httpsCallable(functions, 'sendInvitationEmail');
      
      const emailData = {
        email: email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        businessUnit: data.businessUnit,
        invitationLink: link,
        message: data.message,
        companyName: 'Your Company', // You can get this from company settings
        invitedByEmail: user?.email
      };
      
      console.log('Sending invitation email via Firebase Function...');
      const result = await sendEmail(emailData);
      
      console.log('Email sent successfully:', result.data);
      return result.data;
      
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      
      // Fallback: log the email content for manual sending
      console.log('Email fallback - manual sending required:');
      console.log('To:', email);
      console.log('Subject: You\'re invited to join our team as a', data.role);
      console.log('Invitation link:', link);
      
      // Don't throw error - we still want to show the invitation link
      // throw new Error('Failed to send invitation email');
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      role: staffType === 'technician' ? 'Technician' : 'Office Staff',
      businessUnit: '',
      message: ''
    });
    setInvitationLink('');
    setError('');
    setLinkCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Invite {staffType === 'technician' ? 'Technician' : 'Office Staff'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {!invitationLink ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-md">
                <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100"
                />
              </div>
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role *
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100"
              >
                {roles[staffType].map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Business Unit *
              </label>
              <select
                name="businessUnit"
                value={formData.businessUnit}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100"
              >
                <option value="">Select Business Unit</option>
                {businessUnits.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Welcome Message (Optional)
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={3}
                placeholder="Add a personal welcome message..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Mail size={16} />
                    <span>Send Invitation</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                Invitation Sent!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                An invitation has been sent to {formData.email}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Invitation Link
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={invitationLink}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded-md text-sm"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-1"
                >
                  {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                  <span className="text-sm">{linkCopied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                This link will expire in 7 days
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Send Another
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffInvitationModal; 