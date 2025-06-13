import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { GoogleOneTapButton } from '../components/GoogleOneTapButton';

export function BasicLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, error, loading, signInWithGoogle } = useFirebaseAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get redirect path from location state or default to home
  const from = (location.state as any)?.from?.pathname || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      // Error is already handled by the auth context
      console.error('Login failed');
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
        {error && <div style={{ color: 'red', marginTop: 16 }}>{error}</div>}
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