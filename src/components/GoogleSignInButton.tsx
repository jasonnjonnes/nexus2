import React, { useEffect, useRef } from 'react';

interface GoogleSignInButtonProps {
  onSuccess: (credential: any) => void;
  onError: (error: any) => void;
  clientId: string;
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
}

declare global {
  interface Window {
    google: any;
    handleCredentialResponse: (response: any) => void;
  }
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  clientId,
  text = 'signin_with',
  theme = 'outline',
  size = 'large',
  shape = 'rectangular'
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    // Define the callback function globally
    window.handleCredentialResponse = (response: any) => {
      try {
        // Decode the JWT token to get user info
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        console.log('Google Sign-In Success:', payload);
        
        // Call the success callback with user info
        onSuccess({
          credential: response.credential,
          user: {
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            sub: payload.sub
          }
        });
      } catch (error) {
        console.error('Error processing Google Sign-In:', error);
        onError(error);
      }
    };

    const loadGoogleScript = () => {
      if (scriptLoaded.current || window.google) {
        initializeGoogleSignIn();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        scriptLoaded.current = true;
        initializeGoogleSignIn();
      };
      script.onerror = () => {
        onError(new Error('Failed to load Google Sign-In script'));
      };
      document.head.appendChild(script);
    };

    const initializeGoogleSignIn = () => {
      if (window.google && buttonRef.current) {
        try {
          // Initialize Google Sign-In
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: window.handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
          });

          // Render the button
          window.google.accounts.id.renderButton(buttonRef.current, {
            type: 'standard',
            theme: theme,
            size: size,
            text: text,
            shape: shape,
            logo_alignment: 'left'
          });

          console.log('Google Sign-In button initialized');
        } catch (error) {
          console.error('Error initializing Google Sign-In:', error);
          onError(error);
        }
      }
    };

    loadGoogleScript();

    // Cleanup
    return () => {
      if (window.handleCredentialResponse) {
        delete window.handleCredentialResponse;
      }
    };
  }, [clientId, onSuccess, onError, text, theme, size, shape]);

  return (
    <div className="google-signin-container">
      <div ref={buttonRef} className="google-signin-button"></div>
    </div>
  );
};

export default GoogleSignInButton; 