# App-Wide Caching System

This application now includes a comprehensive caching system that dramatically improves performance by storing frequently accessed data locally and persisting it across browser sessions.

## Overview

The caching system provides:
- **Automatic data caching** with configurable TTL (Time To Live)
- **localStorage persistence** across browser sessions
- **Intelligent cache invalidation** when data changes
- **Memory + disk storage** for optimal performance
- **Cache statistics** for monitoring performance
- **Automatic cleanup** of expired entries

## Quick Start

### 1. Basic Usage

```typescript
import { useCache } from '../contexts/CacheContext';

const MyComponent = () => {
  const cache = useCache();
  
  // Get data from cache
  const cachedData = cache.get<MyDataType>('my-cache-key');
  
  // Set data in cache (with 30 minute TTL)
  cache.set('my-cache-key', myData, 30);
  
  // Remove specific cache entry
  cache.remove('my-cache-key');
  
  // Clear all cache
  cache.clear();
};
```

### 2. Using the Custom Hook for Firebase Data

```typescript
import { useCachedFirebaseData } from '../contexts/CacheContext';

const MyComponent = () => {
  const { data, loading, error, refresh } = useCachedFirebaseData(
    'my-data-key',
    async () => {
      // Your Firebase fetch logic here
      const snapshot = await getDocs(query(collection(db, 'myCollection')));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    60 // Cache for 60 minutes
  );
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      {data?.map(item => <div key={item.id}>{item.name}</div>)}
      <button onClick={refresh}>Refresh Data</button>
    </div>
  );
};
```

## Cache Configuration

Different data types have different cache durations based on how frequently they change:

```typescript
const CACHE_CONFIG = {
  pricebook: { ttl: 60 },      // 1 hour - rarely changes
  customers: { ttl: 15 },      // 15 minutes - moderate changes
  jobs: { ttl: 5 },           // 5 minutes - frequently changes
  staff: { ttl: 60 },         // 1 hour - rarely changes
  businessUnits: { ttl: 120 }, // 2 hours - very stable
  jobTypes: { ttl: 120 },     // 2 hours - very stable
  emails: { ttl: 10 },        // 10 minutes - frequently changes
};
```

## Implementation Examples

### Pricebook Component (Full Implementation)

The Pricebook component demonstrates the complete caching implementation:

```typescript
// 1. Import the cache hook
import { useCache } from '../contexts/CacheContext';

const Pricebook = () => {
  const cache = useCache();
  
  // 2. Create cached fetch functions
  const fetchServicesWithCache = useCallback(async () => {
    const cacheKey = `services_${tenantId}_${userId}`;
    
    // Check cache first
    const cachedServices = cache.get<Service[]>(cacheKey);
    if (cachedServices) {
      setServices(cachedServices);
      return;
    }
    
    // Fetch from Firebase if not cached
    const snapshot = await getDocs(query(/* your query */));
    const servicesData = snapshot.docs.map(/* your mapping */);
    
    // Cache the result
    cache.set(cacheKey, servicesData, 60); // 1 hour TTL
    setServices(servicesData);
  }, [cache, tenantId, userId]);
  
  // 3. Invalidate cache when data changes
  const handleUpdateService = async () => {
    // ... update logic ...
    
    // Invalidate and refresh
    cache.remove(`services_${tenantId}_${userId}`);
    await fetchServicesWithCache();
  };
  
  // 4. Add refresh functionality
  const refreshData = useCallback(async () => {
    cache.invalidate(`${tenantId}_${userId}`); // Clear all tenant data
    await Promise.all([
      fetchServicesWithCache(),
      fetchMaterialsWithCache(),
      // ... other fetch functions
    ]);
  }, [/* dependencies */]);
};
```

### Simple Component Example

For simpler components, use the built-in methods:

```typescript
const SimpleComponent = () => {
  const cache = useCache();
  const [data, setData] = useState([]);
  
  useEffect(() => {
    const loadData = async () => {
      // Try cache first
      const cached = cache.getCustomers();
      if (cached) {
        setData(cached);
        return;
      }
      
      // Fetch and cache
      const freshData = await fetchFromFirebase();
      cache.setCustomers(freshData);
      setData(freshData);
    };
    
    loadData();
  }, [cache]);
};
```

## Cache Invalidation Strategies

### 1. Automatic Invalidation
Cache entries automatically expire based on their TTL.

### 2. Manual Invalidation
```typescript
// Remove specific cache entry
cache.remove('specific-key');

// Remove all entries matching a pattern
cache.invalidate('customer'); // Removes all keys containing 'customer'

// Clear all cache
cache.clear();
```

### 3. Data Modification Invalidation
Always invalidate cache when data changes:

```typescript
const updateCustomer = async (customerId, updates) => {
  // Update in Firebase
  await updateDoc(doc(db, 'customers', customerId), updates);
  
  // Invalidate related cache
  cache.invalidate('customer');
  
  // Refresh the data
  await fetchCustomersWithCache();
};
```

## Cache Statistics

Monitor cache performance with the CacheStats component:

```typescript
import CacheStats from '../components/CacheStats';

const AdminPanel = () => (
  <div>
    <CacheStats className="mb-4" />
    {/* Other admin content */}
  </div>
);
```

The stats show:
- **Entries**: Number of cached items
- **Size**: Total cache size in memory
- **Hit Rate**: Percentage of cache hits vs misses

## Best Practices

### 1. Cache Key Naming
Use descriptive, hierarchical cache keys:
```typescript
// Good
`services_${tenantId}_${userId}`
`customer_${customerId}_jobs`
`pricebook_materials_${categoryId}`

// Bad
'data'
'stuff'
'cache1'
```

### 2. TTL Selection
Choose appropriate TTL based on data volatility:
- **Static data** (settings, categories): 2+ hours
- **Semi-static data** (customers, services): 15-60 minutes  
- **Dynamic data** (jobs, messages): 5-15 minutes
- **Real-time data** (notifications): Don't cache or 1-2 minutes

### 3. Cache Invalidation
Always invalidate cache when data changes:
```typescript
// After any create/update/delete operation
cache.invalidate('relevant-pattern');
await refreshRelevantData();
```

### 4. Error Handling
Handle cache errors gracefully:
```typescript
const getData = async () => {
  try {
    const cached = cache.get('my-data');
    if (cached) return cached;
    
    const fresh = await fetchFromFirebase();
    cache.set('my-data', fresh);
    return fresh;
  } catch (error) {
    console.error('Cache error:', error);
    // Fallback to direct Firebase fetch
    return await fetchFromFirebase();
  }
};
```

### 5. Memory Management
The cache automatically manages memory by:
- Removing expired entries every 5 minutes
- Clearing old entries when localStorage is full
- Limiting individual entry size to prevent memory issues

## Performance Benefits

With caching enabled, you should see:
- **90%+ reduction** in Firebase reads for cached data
- **Instant loading** of previously viewed pages
- **Reduced bandwidth** usage
- **Better user experience** with faster page loads
- **Lower Firebase costs** due to fewer reads

## Debugging

### View Cache Contents
```typescript
// In browser console
console.log('Cache stats:', cache.getCacheStats());

// View specific cache entry
console.log('Services cache:', cache.get('services_tenant_user'));
```

### Clear Cache for Testing
```typescript
// Clear all cache
cache.clear();

// Or use the CacheStats component's "Clear Cache" button
```

## Migration Guide

To add caching to existing components:

1. **Import the cache hook**:
   ```typescript
   import { useCache } from '../contexts/CacheContext';
   ```

2. **Replace direct Firebase calls** with cached versions:
   ```typescript
   // Before
   useEffect(() => {
     const unsubscribe = onSnapshot(query, setData);
     return unsubscribe;
   }, []);
   
   // After
   const cache = useCache();
   useEffect(() => {
     const loadData = async () => {
       const cached = cache.get('my-data');
       if (cached) {
         setData(cached);
         return;
       }
       
       const snapshot = await getDocs(query);
       const data = snapshot.docs.map(/* mapping */);
       cache.set('my-data', data, 30);
       setData(data);
     };
     loadData();
   }, [cache]);
   ```

3. **Add cache invalidation** to data modification functions:
   ```typescript
   const updateData = async () => {
     await updateDoc(/* ... */);
     cache.invalidate('my-data');
     await loadData();
   };
   ```

4. **Add refresh functionality**:
   ```typescript
   const refresh = () => {
     cache.remove('my-data');
     loadData();
   };
   ```

## Troubleshooting

### Cache Not Working
- Ensure `CacheProvider` wraps your app in `App.tsx`
- Check browser console for cache-related errors
- Verify cache keys are consistent between set/get operations

### Data Not Updating
- Ensure cache invalidation after data modifications
- Check TTL values aren't too long for your use case
- Use refresh functionality to bypass cache when needed

### Performance Issues
- Monitor cache hit rate (should be >80% for good performance)
- Reduce TTL for frequently changing data
- Clear cache if it grows too large

The caching system is now ready to use throughout your application. Start with high-traffic components like Pricebook and Customers for maximum impact! 