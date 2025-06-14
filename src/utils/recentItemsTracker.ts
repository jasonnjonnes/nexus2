import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface RecentItem {
  id: string;
  type: 'customer' | 'job' | 'invoice' | 'estimate' | 'location';
  title: string;
  subtitle?: string;
  details?: string;
  metadata?: string;
  lastAccessed: string;
  accessCount: number;
}

export const trackItemAccess = async (
  userId: string,
  tenantId: string,
  itemId: string,
  itemType: 'customer' | 'job' | 'invoice' | 'estimate' | 'location',
  itemTitle: string,
  itemSubtitle?: string,
  itemDetails?: string,
  itemMetadata?: string
) => {
  if (!userId || !tenantId || !itemId || !itemTitle) return;
  
  try {
    const userPrefsRef = doc(db, `tenants/${tenantId}/userPreferences/${userId}`);
    const userPrefsSnap = await getDoc(userPrefsRef);
    
    let recentItems: RecentItem[] = [];
    if (userPrefsSnap.exists()) {
      recentItems = userPrefsSnap.data().recentItems || [];
    }
    
    // Remove existing entry for this item
    recentItems = recentItems.filter(item => !(item.type === itemType && item.id === itemId));
    
    // Add new entry at the beginning
    recentItems.unshift({
      id: itemId,
      type: itemType,
      title: itemTitle,
      subtitle: itemSubtitle || '',
      details: itemDetails || '',
      metadata: itemMetadata || '',
      lastAccessed: new Date().toISOString(),
      accessCount: (recentItems.find(item => item.id === itemId && item.type === itemType)?.accessCount || 0) + 1
    });
    
    // Keep only the 25 most recent items
    recentItems = recentItems.slice(0, 25);
    
    await setDoc(userPrefsRef, { recentItems }, { merge: true });
  } catch (error) {
    console.error('Error tracking item access:', error);
  }
};

export const getRecentItems = async (
  userId: string,
  tenantId: string,
  itemType?: 'customer' | 'job' | 'invoice' | 'estimate' | 'location'
): Promise<RecentItem[]> => {
  if (!userId || !tenantId) return [];
  
  try {
    const userPrefsRef = doc(db, `tenants/${tenantId}/userPreferences/${userId}`);
    const userPrefsSnap = await getDoc(userPrefsRef);
    
    if (userPrefsSnap.exists()) {
      const recentItems = userPrefsSnap.data().recentItems || [];
      
      if (itemType) {
        return recentItems
          .filter((item: RecentItem) => item.type === itemType)
          .sort((a: RecentItem, b: RecentItem) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime())
          .slice(0, 5);
      }
      
      return recentItems
        .sort((a: RecentItem, b: RecentItem) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime());
    }
    
    return [];
  } catch (error) {
    console.error('Error getting recent items:', error);
    return [];
  }
}; 