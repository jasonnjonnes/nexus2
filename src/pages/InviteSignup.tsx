import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, Building, Shield, Check, AlertCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';

interface InvitationData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  businessUnit: string;
  staffType: 'office' | 'technician';
  tenantId: string;
  invitedBy: string;
  invitedByEmail: string;
  token: string;
  status: string;
  expiresAt: string;
  used: boolean;
  message?: string;
}

interface SignupFormData {
  password: string;
  confirmPassword: string;
  phone: string;
  homeAddress: string;
  dateOfBirth: string;
  acceptTerms: boolean;
}

const InviteSignup: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { register } = useFirebaseAuth();
  
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState<SignupFormData>({
    password: '',
    confirmPassword: '',
    phone: '',
    homeAddress: '',
    dateOfBirth: '',
    acceptTerms: false
  });

  useEffect(() => {
    if (token) {
      loadInvitation(token);
    }
  }, [token]);

  const loadInvitation = async (invitationToken: string) => {
    try {
      setLoading(true);
      setError('');

      // Search for invitation across all tenants
      // Note: In a real implementation, you might want to optimize this
      const tenantsSnapshot = await getDocs(collection(db, 'tenants'));
      let foundInvitation: InvitationData | null = null;

      for (const tenantDoc of tenantsSnapshot.docs) {
        const invitationsQuery = query(
          collection(db, 'tenants', tenantDoc.id, 'invitations'),
          where('token', '==', invitationToken)
        );
        
        const invitationsSnapshot = await getDocs(invitationsQuery);
        
        if (!invitationsSnapshot.empty) {
          const invitationDoc = invitationsSnapshot.docs[0];
          foundInvitation = {
            id: invitationDoc.id,
            ...invitationDoc.data()
          } as InvitationData;
          break;
        }
      }

      if (!foundInvitation) {
        setError('Invalid or expired invitation link.');
        return;
      }

      // Check if invitation is expired
      const expirationDate = new Date(foundInvitation.expiresAt);
      if (expirationDate < new Date()) {
        setError('This invitation has expired. Please request a new invitation.');
        return;
      }

      // Check if invitation is already used
      if (foundInvitation.used) {
        setError('This invitation has already been used.');
        return;
      }

      setInvitation(foundInvitation);
    } catch (err) {
      console.error('Error loading invitation:', err);
      setError('Failed to load invitation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateForm = (): boolean => {
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }

    if (!formData.acceptTerms) {
      setError('You must accept the terms and conditions.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !validateForm()) return;

    try {
      setLoading(true);
      setError('');

      // Create Firebase user account
      await register(invitation.email, formData.password);

      // Create staff record in Firestore
      const staffData = {
        userId: '', // This will be updated after auth
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        fullName: `${invitation.firstName} ${invitation.lastName}`,
        email: invitation.email,
        phone: formData.phone,
        homeAddress: formData.homeAddress,
        dateOfBirth: formData.dateOfBirth,
        role: invitation.role,
        businessUnit: invitation.businessUnit,
        staffType: invitation.staffType,
        type: invitation.staffType, // For compatibility
        status: 'active',
        profilePicture: '',
        color: '#3B82F6', // Default color
        socialSecurityNumber: '', // To be filled later
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'tenants', invitation.tenantId, 'staff'), staffData);

      // Mark invitation as used
      await updateDoc(
        doc(db, 'tenants', invitation.tenantId, 'invitations', invitation.id),
        {
          used: true,
          usedAt: serverTimestamp(),
          status: 'completed'
        }
      );

      setSuccess(true);
      
      // Redirect to login after a delay
      setTimeout(() => {
        navigate('/login', { 
          state: { 
            message: 'Account created successfully! Please log in with your credentials.',
            email: invitation.email 
          }
        });
      }, 3000);

    } catch (err: any) {
      console.error('Error creating account:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Invalid Invitation
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Account Created Successfully!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Welcome to the team! You'll be redirected to the login page shortly.
            </p>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <User size={32} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              Join the Team
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Complete your account setup
            </p>
          </div>

          {invitation && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-3">
                <Building size={20} className="text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {invitation.firstName} {invitation.lastName}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300">
                    {invitation.role} • {invitation.businessUnit}
                  </p>
                </div>
              </div>
              {invitation.message && (
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-3 italic">
                  "{invitation.message}"
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-md">
                <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={invitation?.email || ''}
                  disabled
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100"
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Home Address
              </label>
              <input
                type="text"
                name="homeAddress"
                value={formData.homeAddress}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100"
                placeholder="123 Main St, City, State 12345"
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100"
              />
            </div>

            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                name="acceptTerms"
                checked={formData.acceptTerms}
                onChange={handleChange}
                className="mt-1 rounded border-gray-300 dark:border-slate-600"
              />
              <label className="text-sm text-gray-600 dark:text-gray-400">
                I accept the{' '}
                <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Terms and Conditions
                </a>{' '}
                and{' '}
                <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Privacy Policy
                </a>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <User size={16} />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Sign in here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteSignup; 