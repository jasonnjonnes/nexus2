import { useEffect, useRef } from 'react';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../firebase';

// Declare the google.accounts.id namespace for TypeScript
declare global {
  interface Window {
    google?: any;
  }
}

export function GoogleOneTapButton() {
  const buttonDiv = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleCredentialResponse(response: any) {
      const credential = GoogleAuthProvider.credential(response.credential);
      signInWithCredential(auth, credential)
        .then(() => {
          // User is signed in to Firebase!
        })
        .catch((error) => {
          console.error('Firebase sign-in error:', error);
        });
    }

    function renderButton() {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: '541335321876-17c70b30o9gujee9bquio61bjknpm4aq.apps.googleusercontent.com',
        callback: handleCredentialResponse,
      });
      window.google.accounts.id.renderButton(
        buttonDiv.current,
        { theme: 'outline', size: 'large' }
      );
    }

    // Load the GIS script if not already loaded
    if (!window.google?.accounts?.id) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = renderButton;
      document.body.appendChild(script);
    } else {
      renderButton();
    }
  }, []);

  return <div ref={buttonDiv}></div>;
} 