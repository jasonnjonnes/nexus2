/// <reference types="vite/client" />

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

declare const __firebase_config: FirebaseConfig;
declare const __app_id: string;
declare const __initial_auth_token: string;