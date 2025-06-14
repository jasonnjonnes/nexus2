import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { GoogleOneTapButton } from '../components/GoogleOneTapButton';
import { AuthMethodService } from '../services/AuthMethodService';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export function BasicLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [smartError, setSmartError] = useState<{
    message: string;
    needsGoogleAuth?: boolean;
    availableMethods?: string[];
  } | null>(null);
  const { user, login, error, loading, signInWithGoogle } = useFirebaseAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get redirect path from location state or default to home
  const from = (location.state as any)?.from?.pathname || '/';

  // Redirect authenticated users - let BasicProtectedRoute handle onboarding logic
  useEffect(() => {
    if (user && !loading) {
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, from]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmartError(null);
    
    // Use smart sign-in to detect auth method issues
    const smartResult = await AuthMethodService.smartSignIn(email, password);
    
    if (smartResult.success) {
      // Don't navigate here - let useEffect handle it
      console.log('Email/password sign-in successful');
    } else if (smartResult.needsGoogleAuth) {
      setSmartError({
        message: smartResult.error || 'Please use Google sign-in',
        needsGoogleAuth: true,
        availableMethods: smartResult.availableMethods
      });
    } else {
      // Fall back to regular login for other errors
      try {
        await login(email, password);
        // Don't navigate here - let useEffect handle it
        console.log('Login successful');
      } catch (err) {
        // Error is already handled by the auth context
        console.error('Login failed');
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // Let BasicProtectedRoute handle navigation based on onboarding status
      console.log('Google sign-in successful');
    } catch (err) {
      console.error('Google sign-in failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f7f8fa' }}>
      {/* Logo in top left */}
      <img src="/Nexus.svg" alt="Nexus Logo" style={{ position: 'fixed', top: 32, left: 48, width: 160, zIndex: 10 }} />
      {/* Left side: Login form */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#fff' }}>
        {/* Spacer for logo */}
        <div style={{ height: 120 }} />
        <form onSubmit={handleLogin} style={{ width: 320, margin: '24px 0 0 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, textAlign: 'left' }}>Sign in</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ padding: 12, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 16 }}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ padding: 12, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 16 }}
            required
          />
          <button
            type="submit"
            disabled={loading}
            style={{ background: '#1a237e', color: 'white', padding: '12px 0', borderRadius: 6, fontWeight: 600, fontSize: 16, border: 'none', marginTop: 8 }}
          >
            Sign In
          </button>
        </form>
        <div style={{ width: 320, margin: '24px 0 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <GoogleOneTapButton />
        </div>
        <div style={{ width: 320, marginTop: 16, textAlign: 'right' }}>
          <a href="/forgot-password" style={{ color: '#1a237e', textDecoration: 'none', fontSize: 14 }}>Forgot password?</a>
        </div>
        
        {/* Smart Error Display for Google-only accounts */}
        {smartError && smartError.needsGoogleAuth && (
          <div style={{ 
            width: 320, 
            marginTop: 16, 
            padding: 16, 
            backgroundColor: '#fef3c7', 
            border: '1px solid #f59e0b', 
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
              <span style={{ fontWeight: 600, color: '#92400e', fontSize: 14 }}>
                Account found with Google sign-in
              </span>
            </div>
            <p style={{ color: '#92400e', fontSize: 13, margin: 0 }}>
              This email was registered using Google. Please use the Google sign-in button below instead.
            </p>
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={{
                background: '#fff',
                color: '#374151',
                border: '1px solid #d1d5db',
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer'
              }}
            >
              🔍 Sign in with Google
              <ArrowRight size={16} />
            </button>
          </div>
        )}
        
        {/* Regular error display */}
        {error && !smartError && <div style={{ color: 'red', marginTop: 16 }}>{error}</div>}
        <div style={{ width: 320, marginTop: 32, fontSize: 13, color: '#888' }}>
          <a href="/privacy-policy" style={{ color: '#888', textDecoration: 'underline' }}>Privacy Policy</a>
        </div>
      </div>
      {/* Right side: Promo card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a237e 60%, #1976d2 100%)' }}>
        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 8px 32px rgba(26,35,126,0.12)', padding: 40, maxWidth: 420, textAlign: 'center' }}>
          <h3 style={{ color: '#1a237e', fontWeight: 700, fontSize: 24, marginBottom: 12 }}>Elevate Your Business</h3>
          <p style={{ color: '#333', fontSize: 16, marginBottom: 24 }}>
            Discover strategies, forge partnerships &amp; gain the edge to grow. Join the best in the trades at the next Nexus Summit.
          </p>
          <a href="#" style={{ color: '#fff', background: '#1a237e', padding: '10px 28px', borderRadius: 6, fontWeight: 600, textDecoration: 'none', fontSize: 16 }}>Register Now</a>
        </div>
      </div>
    </div>
  );
} 