import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Load compile-time injected config (see vite.config.ts)
const cfg: any = typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;

// Prevent re-initialisation in hot-reload / multiple imports
export const app = getApps().length ? getApps()[0] : initializeApp(cfg, '[WEB]');

export const db = getFirestore(app);
export const auth = getAuth(app); 