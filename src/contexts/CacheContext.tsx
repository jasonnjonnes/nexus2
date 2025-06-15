import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  key: string;
}

interface CacheContextType {
  // Generic cache methods
  get: <T>(key: string) => T | null;
  set: <T>(key: string, data: T, ttlMinutes?: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  invalidate: (pattern: string) => void;
  
  // Storage management
  clearMemory: () => void;
  getStorageUsage: () => number;
  freeUpStorage: (targetSize: number) => number;
  
  // Specific data cache methods
  getPricebook: () => any[] | null;
  setPricebook: (data: any[]) => void;
  getCustomers: () => any[] | null;
  setCustomers: (data: any[]) => void;
  getJobs: () => any[] | null;
  setJobs: (data: any[]) => void;
  getStaff: () => any[] | null;
  setStaff: (data: any[]) => void;
  getBusinessUnits: () => any[] | null;
  setBusinessUnits: (data: any[]) => void;
  getJobTypes: () => any[] | null;
  setJobTypes: (data: any[]) => void;
  getEmails: () => any[] | null;
  setEmails: (data: any[]) => void;
  
  // Cache stats
  getCacheStats: () => { totalEntries: number; totalSize: string; hitRate: number };
  
  // Loading states
  isLoading: (key: string) => boolean;
  setLoading: (key: string, loading: boolean) => void;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

const CACHE_PREFIX = 'servicepro_cache_';
const DEFAULT_TTL_MINUTES = 30; // Default cache time: 30 minutes
const MAX_ENTRY_SIZE = 5 * 1024 * 1024; // 5MB max per entry
const MAX_TOTAL_STORAGE = 10 * 1024 * 1024; // 10MB max total storage

// Cache configuration for different data types
const CACHE_CONFIG = {
  pricebook: { ttl: 60, key: 'pricebook' }, // 1 hour
  customers: { ttl: 15, key: 'customers' }, // 15 minutes
  jobs: { ttl: 5, key: 'jobs' }, // 5 minutes (frequently changing)
  staff: { ttl: 60, key: 'staff' }, // 1 hour
  businessUnits: { ttl: 120, key: 'business_units' }, // 2 hours
  jobTypes: { ttl: 120, key: 'job_types' }, // 2 hours
  emails: { ttl: 10, key: 'emails' }, // 10 minutes
};

export const CacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const loadingStatesRef = useRef<Map<string, boolean>>(new Map());
  const hitCountRef = useRef(0);
  const missCountRef = useRef(0);

  // Load cache from localStorage on mount
  useEffect(() => {
    const loadCacheFromStorage = () => {
      try {
        const cacheData = new Map<string, CacheEntry>();
        const now = Date.now();
        
        // Load all cache entries from localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(CACHE_PREFIX)) {
            const cacheKey = key.replace(CACHE_PREFIX, '');
            const item = localStorage.getItem(key);
            if (item) {
              try {
                const entry: CacheEntry = JSON.parse(item);
                // Check if entry is still valid
                if (now - entry.timestamp < entry.ttl) {
                  cacheData.set(cacheKey, entry);
                } else {
                  // Remove expired entry
                  localStorage.removeItem(key);
                }
              } catch (e) {
                // Remove corrupted entry
                localStorage.removeItem(key);
              }
            }
          }
        }
        
        cacheRef.current = cacheData;
        console.log(`Cache loaded: ${cacheData.size} entries from localStorage`);
      } catch (error) {
        console.error('Error loading cache from localStorage:', error);
      }
    };

    loadCacheFromStorage();
  }, []);

  // Calculate current storage usage
  const getStorageUsage = useCallback(() => {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }
    }
    return totalSize;
  }, []);

  // Clear cache entries to free up space
  const freeUpStorage = useCallback((targetSize: number) => {
    const cache = cacheRef.current;
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp); // Sort by oldest first
    
    let freedSize = 0;
    let clearedCount = 0;
    
    for (const [key, entry] of entries) {
      if (freedSize >= targetSize) break;
      
      const storageKey = CACHE_PREFIX + key;
      const value = localStorage.getItem(storageKey);
      if (value) {
        freedSize += new Blob([value]).size;
      }
      
      localStorage.removeItem(storageKey);
      cache.delete(key);
      clearedCount++;
    }
    
    console.log(`Freed up ${(freedSize / 1024 / 1024).toFixed(2)}MB by clearing ${clearedCount} cache entries`);
    return freedSize;
  }, []);

  // Save cache entry to localStorage
  const saveCacheEntry = useCallback((key: string, entry: CacheEntry) => {
    try {
      const storageKey = CACHE_PREFIX + key;
      const serialized = JSON.stringify(entry);
      const entrySize = new Blob([serialized]).size;
      
      // Check if single entry is too large
      if (entrySize > MAX_ENTRY_SIZE) {
        console.warn(`Cache entry too large, skipping: ${key} (${(entrySize / 1024 / 1024).toFixed(2)}MB)`);
        return false;
      }
      
      // Check total storage usage
      const currentUsage = getStorageUsage();
      if (currentUsage + entrySize > MAX_TOTAL_STORAGE) {
        console.log(`Storage limit reached, freeing up space...`);
        const targetFreeSize = Math.max(entrySize * 2, MAX_TOTAL_STORAGE * 0.3); // Free at least 30% or 2x entry size
        freeUpStorage(targetFreeSize);
      }
      
      localStorage.setItem(storageKey, serialized);
      return true;
    } catch (error) {
      console.error('Error saving cache entry:', error);
      
      if (error.name === 'QuotaExceededError') {
        console.log('Storage quota exceeded, attempting to free up space...');
        try {
          // Try to free up 50% of storage
          freeUpStorage(MAX_TOTAL_STORAGE * 0.5);
          
          // Retry saving the entry
          const serialized = JSON.stringify(entry);
          localStorage.setItem(CACHE_PREFIX + key, serialized);
          console.log(`Successfully saved cache entry after cleanup: ${key}`);
          return true;
        } catch (retryError) {
          console.error('Failed to save cache entry even after cleanup:', retryError);
          return false;
        }
      }
      return false;
    }
  }, [getStorageUsage, freeUpStorage]);



  // Generic cache methods
  const get = useCallback(<T,>(key: string): T | null => {
    const cache = cacheRef.current;
    const entry = cache.get(key);
    if (!entry) {
      missCountRef.current++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Entry expired
      cache.delete(key);
      localStorage.removeItem(CACHE_PREFIX + key);
      missCountRef.current++;
      return null;
    }

    hitCountRef.current++;
    return entry.data as T;
  }, []);

  const set = useCallback(<T,>(key: string, data: T, ttlMinutes: number = DEFAULT_TTL_MINUTES) => {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000, // Convert to milliseconds
      key
    };

    cacheRef.current.set(key, entry);
    saveCacheEntry(key, entry);
    
    console.log(`Cache set: ${key} (TTL: ${ttlMinutes}m)`);
  }, [saveCacheEntry]);

  const remove = useCallback((key: string) => {
    cacheRef.current.delete(key);
    localStorage.removeItem(CACHE_PREFIX + key);
    console.log(`Cache removed: ${key}`);
  }, []);

  const clear = useCallback(() => {
    // Clear memory cache
    cacheRef.current.clear();
    
    // Clear localStorage cache
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Reset stats
    hitCountRef.current = 0;
    missCountRef.current = 0;
    
    console.log('Cache cleared');
  }, []);

  const invalidate = useCallback((pattern: string) => {
    const cache = cacheRef.current;
    const keysToRemove: string[] = [];
    
    cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      cache.delete(key);
      localStorage.removeItem(CACHE_PREFIX + key);
    });
    
    console.log(`Cache invalidated: ${keysToRemove.length} entries matching "${pattern}"`);
  }, []);

  // Clear memory cache only (keep localStorage)
  const clearMemory = useCallback(() => {
    cacheRef.current.clear();
    loadingStatesRef.current.clear();
    console.log('Memory cache cleared');
  }, []);

  // Specific data cache methods
  const getPricebook = useCallback(() => get<any[]>('pricebook'), []);
  const setPricebook = useCallback((data: any[]) => set('pricebook', data, CACHE_CONFIG.pricebook.ttl), []);

  const getCustomers = useCallback(() => get<any[]>('customers'), []);
  const setCustomers = useCallback((data: any[]) => set('customers', data, CACHE_CONFIG.customers.ttl), []);

  const getJobs = useCallback(() => get<any[]>('jobs'), []);
  const setJobs = useCallback((data: any[]) => set('jobs', data, CACHE_CONFIG.jobs.ttl), []);

  const getStaff = useCallback(() => get<any[]>('staff'), []);
  const setStaff = useCallback((data: any[]) => set('staff', data, CACHE_CONFIG.staff.ttl), []);

  const getBusinessUnits = useCallback(() => get<any[]>('business_units'), []);
  const setBusinessUnits = useCallback((data: any[]) => set('business_units', data, CACHE_CONFIG.businessUnits.ttl), []);

  const getJobTypes = useCallback(() => get<any[]>('job_types'), []);
  const setJobTypes = useCallback((data: any[]) => set('job_types', data, CACHE_CONFIG.jobTypes.ttl), []);

  const getEmails = useCallback(() => get<any[]>('emails'), []);
  const setEmails = useCallback((data: any[]) => set('emails', data, CACHE_CONFIG.emails.ttl), []);

  // Cache stats
  const getCacheStats = useCallback(() => {
    const cache = cacheRef.current;
    const totalEntries = cache.size;
    const hitCount = hitCountRef.current;
    const missCount = missCountRef.current;
    const totalRequests = hitCount + missCount;
    const hitRate = totalRequests > 0 ? (hitCount / totalRequests) * 100 : 0;
    
    // Calculate total cache size in memory
    let memorySize = 0;
    cache.forEach(entry => {
      memorySize += new Blob([JSON.stringify(entry)]).size;
    });
    
    // Calculate localStorage usage
    const storageSize = getStorageUsage();
    
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return {
      totalEntries,
      memorySize: formatSize(memorySize),
      storageSize: formatSize(storageSize),
      totalSize: formatSize(memorySize + storageSize),
      hitRate: Math.round(hitRate),
      storageUsagePercent: Math.round((storageSize / MAX_TOTAL_STORAGE) * 100)
    };
  }, [getStorageUsage]);

  // Loading state management
  const isLoading = useCallback((key: string) => {
    return loadingStatesRef.current.get(key) || false;
  }, []);

  const setLoading = useCallback((key: string, loading: boolean) => {
    const loadingStates = loadingStatesRef.current;
    if (loading) {
      loadingStates.set(key, true);
    } else {
      loadingStates.delete(key);
    }
  }, []);

  // Auto-cleanup expired entries every 5 minutes
  useEffect(() => {
    const cleanup = setInterval(() => {
      const cache = cacheRef.current;
      const now = Date.now();
      const expiredKeys: string[] = [];
      
      cache.forEach((entry, key) => {
        if (now - entry.timestamp > entry.ttl) {
          expiredKeys.push(key);
        }
      });
      
      if (expiredKeys.length > 0) {
        expiredKeys.forEach(key => {
          cache.delete(key);
          localStorage.removeItem(CACHE_PREFIX + key);
        });
        console.log(`Auto-cleanup: removed ${expiredKeys.length} expired entries`);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(cleanup);
  }, []);

  // Expose cache management to global scope for debugging
  useEffect(() => {
    (window as any).clearServiceProCache = () => {
      clear();
      console.log('ServicePro cache cleared from console');
    };
    
    (window as any).getServiceProCacheStats = () => {
      const stats = getCacheStats();
      console.table(stats);
      return stats;
    };
    
    (window as any).freeServiceProStorage = (sizeMB: number = 5) => {
      const bytes = sizeMB * 1024 * 1024;
      const freed = freeUpStorage(bytes);
      console.log(`Freed ${(freed / 1024 / 1024).toFixed(2)}MB of storage`);
      return freed;
    };
  }, [clear, getCacheStats, freeUpStorage]);

  const value: CacheContextType = useMemo(() => ({
    get,
    set,
    remove,
    clear,
    invalidate,
    clearMemory,
    getStorageUsage,
    freeUpStorage,
    getPricebook,
    setPricebook,
    getCustomers,
    setCustomers,
    getJobs,
    setJobs,
    getStaff,
    setStaff,
    getBusinessUnits,
    setBusinessUnits,
    getJobTypes,
    setJobTypes,
    getEmails,
    setEmails,
    getCacheStats,
    isLoading,
    setLoading
  }), []); // All functions are now stable

  return (
    <CacheContext.Provider value={value}>
      {children}
    </CacheContext.Provider>
  );
};

export const useCache = () => {
  const context = useContext(CacheContext);
  if (context === undefined) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
};

// Custom hook for cached Firebase data fetching
export const useCachedFirebaseData = <T,>(
  key: string,
  fetchFunction: () => Promise<T>,
  ttlMinutes?: number
) => {
  const cache = useCache();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cachedData = cache.get<T>(key);
      if (cachedData) {
        setData(cachedData);
        return cachedData;
      }
    }

    // Check if already loading
    if (cache.isLoading(key)) {
      return;
    }

    try {
      cache.setLoading(key, true);
      setLoading(true);
      setError(null);

      const result = await fetchFunction();
      
      // Cache the result
      cache.set(key, result, ttlMinutes);
      setData(result);
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error(`Error fetching ${key}:`, err);
    } finally {
      cache.setLoading(key, false);
      setLoading(false);
    }
  }, [key, fetchFunction, cache, ttlMinutes]);

  // Load data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(true),
    refresh: () => fetchData(true)
  };
}; 