import * as admin from 'firebase-admin';

const CACHE_COLLECTION = 'cache';

export async function getCache<T = any>(key: string): Promise<T | null> {
  const doc = await admin.firestore().collection(CACHE_COLLECTION).doc(key).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data) return null;
  const now = Date.now();
  if (data.expiresAt && now > data.expiresAt) {
    // Cache expired, delete it
    await admin.firestore().collection(CACHE_COLLECTION).doc(key).delete();
    return null;
  }
  return data.value as T;
}

export async function setCache<T = any>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  await admin.firestore().collection(CACHE_COLLECTION).doc(key).set({
    value,
    expiresAt,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
} 