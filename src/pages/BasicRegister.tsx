import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { GoogleOneTapButton } from '../components/GoogleOneTapButton';
import { Eye, EyeOff, User, Mail, Lock, ArrowRight } from 'lucide-react';

export function BasicRegister() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    password: false,
    confirmPassword: false
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { user, register, error, loading, signInWithGoogle } = useFirebaseAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to onboarding
  useEffect(() => {
    if (user && !loading) {
      navigate('/onboarding', { replace: true });
    }
  }, [user, loading, navigate]);

  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.email) {
      errors.push('Email is required');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.push('Please enter a valid email address');
    }
    
    if (!formData.password) {
      errors.push('Password is required');
    } else if (formData.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }
    
    if (!formData.confirmPassword) {
      errors.push('Please confirm your password');
    } else if (formData.password !== formData.confirmPassword) {
      errors.push('Passwords do not match');
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await register(formData.email, formData.password);
      // User will be redirected to onboarding by useEffect
    } catch (err) {
      console.error('Registration failed:', err);
      // Error is handled by the auth context
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      await signInWithGoogle();
      // User will be redirected to onboarding by useEffect
    } catch (err) {
      console.error('Google sign-up failed:', err);
    }
  };

  const togglePasswordVisibility = (field: 'password' | 'confirmPassword') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f7f8fa' }}>
      {/* Logo in top left */}
      <img src="/Nexus.svg" alt="Nexus Logo" style={{ position: 'fixed', top: 32, left: 48, width: 160, zIndex: 10 }} />
      
      {/* Left side: Signup form */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#fff' }}>
        {/* Spacer for logo */}
        <div style={{ height: 120 }} />
        
        <form onSubmit={handleSubmit} style={{ width: 320, margin: '24px 0 0 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <User size={48} style={{ color: '#1a237e', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: '#1a237e' }}>Create Your Account</h2>
            <p style={{ color: '#666', fontSize: 14 }}>Join thousands of service professionals</p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleInputChange}
                style={{ 
                  width: '100%',
                  paddingLeft: 40, 
                  paddingRight: 12,
                  paddingTop: 12,
                  paddingBottom: 12,
                  borderRadius: 6, 
                  border: '1px solid #d1d5db', 
                  fontSize: 16,
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type={showPasswords.password ? 'text' : 'password'}
                name="password"
                placeholder="Create a password"
                value={formData.password}
                onChange={handleInputChange}
                style={{ 
                  width: '100%',
                  paddingLeft: 40, 
                  paddingRight: 40,
                  paddingTop: 12,
                  paddingBottom: 12,
                  borderRadius: 6, 
                  border: '1px solid #d1d5db', 
                  fontSize: 16,
                  boxSizing: 'border-box'
                }}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('password')}
                style={{ 
                  position: 'absolute', 
                  right: 12, 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  background: 'none', 
                  border: 'none', 
                  color: '#9ca3af',
                  cursor: 'pointer'
                }}
              >
                {showPasswords.password ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Confirm Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type={showPasswords.confirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                style={{ 
                  width: '100%',
                  paddingLeft: 40, 
                  paddingRight: 40,
                  paddingTop: 12,
                  paddingBottom: 12,
                  borderRadius: 6, 
                  border: '1px solid #d1d5db', 
                  fontSize: 16,
                  boxSizing: 'border-box'
                }}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirmPassword')}
                style={{ 
                  position: 'absolute', 
                  right: 12, 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  background: 'none', 
                  border: 'none', 
                  color: '#9ca3af',
                  cursor: 'pointer'
                }}
              >
                {showPasswords.confirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div style={{ 
              padding: 12, 
              borderRadius: 6, 
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca'
            }}>
              {validationErrors.map((error, index) => (
                <p key={index} style={{ color: '#dc2626', fontSize: 14, margin: '4px 0' }}>
                  • {error}
                </p>
              ))}
            </div>
          )}

          {/* Firebase Auth Error */}
          {error && (
            <div style={{ 
              padding: 12, 
              borderRadius: 6, 
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: 14,
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ 
              background: '#1a237e', 
              color: 'white', 
              padding: '14px 0', 
              borderRadius: 6, 
              fontWeight: 600, 
              fontSize: 16, 
              border: 'none', 
              marginTop: 8,
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            {loading ? (
              <>
                <div style={{ 
                  width: 16, 
                  height: 16, 
                  border: '2px solid transparent', 
                  borderTop: '2px solid white', 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite' 
                }} />
                Creating Account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ width: 320, margin: '24px 0 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
            <span style={{ padding: '0 16px', color: '#6b7280', fontSize: 14 }}>or</span>
            <div style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
          </div>
          <GoogleOneTapButton />
        </div>

        <div style={{ width: 320, marginTop: 24, textAlign: 'center' }}>
          <p style={{ color: '#666', fontSize: 14 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#1a237e', textDecoration: 'none', fontWeight: 500 }}>
              Sign in here
            </Link>
          </p>
        </div>

        <div style={{ width: 320, marginTop: 32, fontSize: 13, color: '#888', textAlign: 'center' }}>
          <p>
            By creating an account, you agree to our{' '}
            <a href="/terms" style={{ color: '#888', textDecoration: 'underline' }}>Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy-policy" style={{ color: '#888', textDecoration: 'underline' }}>Privacy Policy</a>
          </p>
        </div>
      </div>

      {/* Right side: Benefits */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a237e 60%, #1976d2 100%)' }}>
        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 8px 32px rgba(26,35,126,0.12)', padding: 40, maxWidth: 420 }}>
          <h3 style={{ color: '#1a237e', fontWeight: 700, fontSize: 24, marginBottom: 20, textAlign: 'center' }}>Why Choose Nexus?</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ 
                width: 24, 
                height: 24, 
                borderRadius: '50%', 
                backgroundColor: '#1a237e', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2
              }}>
                <span style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>✓</span>
              </div>
              <div>
                <h4 style={{ color: '#1a237e', fontWeight: 600, fontSize: 16, margin: '0 0 4px 0' }}>Streamlined Operations</h4>
                <p style={{ color: '#666', fontSize: 14, margin: 0 }}>Manage jobs, customers, and invoicing all in one place</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ 
                width: 24, 
                height: 24, 
                borderRadius: '50%', 
                backgroundColor: '#1a237e', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2
              }}>
                <span style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>✓</span>
              </div>
              <div>
                <h4 style={{ color: '#1a237e', fontWeight: 600, fontSize: 16, margin: '0 0 4px 0' }}>Real-time Communication</h4>
                <p style={{ color: '#666', fontSize: 14, margin: 0 }}>Stay connected with your team and customers</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ 
                width: 24, 
                height: 24, 
                borderRadius: '50%', 
                backgroundColor: '#1a237e', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2
              }}>
                <span style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>✓</span>
              </div>
              <div>
                <h4 style={{ color: '#1a237e', fontWeight: 600, fontSize: 16, margin: '0 0 4px 0' }}>Business Growth</h4>
                <p style={{ color: '#666', fontSize: 14, margin: 0 }}>Analytics and insights to help you scale</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
} 