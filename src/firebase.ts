import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Load compile-time injected config (see vite.config.ts)
let cfg: any;

try {
  // Check if the global config is available
  if (typeof __firebase_config !== 'undefined') {
    cfg = typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    console.log('🔥 Firebase: Config loaded from Vite globals');
  } else {
    console.warn('⚠️ Firebase: __firebase_config not found, using fallback config');
    // Fallback configuration
    cfg = {
      apiKey: "AIzaSyDfxYAO3u_RBWZ6a4teD1ReSyFpxCGlN6g",
      authDomain: "servicepro-4c705.firebaseapp.com",
      projectId: "servicepro-4c705",
      storageBucket: "servicepro-4c705.firebasestorage.app",
      messagingSenderId: "541335321876",
      appId: "1:541335321876:web:fe01f54d6a4da2031b9601",
      measurementId: "G-TXHB1Y2JWN"
    };
  }
} catch (error) {
  console.error('❌ Firebase: Error loading config:', error);
  throw new Error('Failed to load Firebase configuration');
}

// Validate required config fields
if (!cfg || !cfg.apiKey || !cfg.projectId) {
  console.error('❌ Firebase: Invalid configuration:', cfg);
  throw new Error('Firebase configuration is missing required fields');
}

console.log('🔥 Firebase: Initializing with project:', cfg.projectId);

// Initialize Firebase app
let app: FirebaseApp;
try {
  // Prevent re-initialisation in hot-reload / multiple imports
  if (getApps().length > 0) {
    app = getApps()[0];
    console.log('🔥 Firebase: Using existing app instance');
  } else {
    app = initializeApp(cfg, '[WEB]');
    console.log('✅ Firebase: App initialized successfully');
  }
} catch (error) {
  console.error('❌ Firebase: Failed to initialize app:', error);
  throw error;
}

// Initialize services
let db: Firestore;
let auth: Auth;

try {
  db = getFirestore(app);
  auth = getAuth(app);
  console.log('✅ Firebase: Services initialized successfully');
} catch (error) {
  console.error('❌ Firebase: Failed to initialize services:', error);
  throw error;
}

export { app, db, auth }; 