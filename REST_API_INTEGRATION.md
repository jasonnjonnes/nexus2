# REST API Integration with Firebase

This guide explains how to integrate REST API functionality with your Firebase database in the Nexus Field Service Management application.

## Overview

We've implemented a comprehensive REST API using Firebase Cloud Functions that provides:
- **Secure authentication** using Firebase Auth tokens
- **Multi-tenant support** with automatic tenant isolation
- **CRUD operations** for customers, jobs, invoices, and pricebook items
- **Type-safe client integration** with React hooks

## Architecture

```
Frontend (React) → API Service → Firebase Functions → Firebase Firestore
```

## Setup Instructions

### 1. Update Firebase Functions Configuration

First, you need to update the API URL in the client service:

```typescript
// In src/services/ApiService.ts
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://YOUR_PROJECT_ID-YOUR_REGION.cloudfunctions.net/api'
  : 'http://localhost:5001/YOUR_PROJECT_ID/YOUR_REGION/api';
```

Replace `YOUR_PROJECT_ID` and `YOUR_REGION` with your actual Firebase project details.

### 2. Install Dependencies

```bash
cd functions
npm install
```

### 3. Deploy Functions

```bash
# Deploy to Firebase
npm run deploy

# Or for development, run locally
npm run serve
```

### 4. Configure CORS (if needed)

For production, you may need to configure CORS settings in the Firebase console.

## API Endpoints

### Authentication

All endpoints require a Firebase Auth token in the Authorization header:
```
Authorization: Bearer <firebase-id-token>
```

### Customers

- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get specific customer
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Jobs

- `GET /api/jobs` - Get all jobs
- `POST /api/jobs` - Create new job

### Pricebook

- `GET /api/pricebook/services` - Get all services
- `GET /api/pricebook/materials` - Get all materials

### Invoices

- `GET /api/invoices` - Get all invoices
- `POST /api/invoices` - Create new invoice

### Health Check

- `GET /health` - API health check

## Usage Examples

### Using the API Service Directly

```typescript
import { apiService } from '../services/ApiService';

// Get all customers
const response = await apiService.getCustomers();
if (response.data) {
  console.log(response.data.customers);
}

// Create a new customer
const newCustomer = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '555-0123'
};
const result = await apiService.createCustomer(newCustomer);
```

### Using React Hooks

```typescript
import { useCustomers, useCreateCustomer } from '../hooks/useApi';

function CustomerComponent() {
  const customersApi = useCustomers();
  const createCustomerApi = useCreateCustomer();

  useEffect(() => {
    customersApi.execute();
  }, []);

  const handleCreateCustomer = async (customerData) => {
    const result = await createCustomerApi.execute(customerData);
    if (result) {
      // Refresh the list
      customersApi.execute();
    }
  };

  return (
    <div>
      {customersApi.loading && <div>Loading...</div>}
      {customersApi.error && <div>Error: {customersApi.error}</div>}
      {customersApi.data && (
        <div>
          {customersApi.data.customers.map(customer => (
            <div key={customer.id}>{customer.name}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Available React Hooks

- `useCustomers()` - Get all customers
- `useCustomer()` - Get specific customer
- `useCreateCustomer()` - Create customer
- `useUpdateCustomer()` - Update customer
- `useDeleteCustomer()` - Delete customer
- `useJobs()` - Get all jobs
- `useCreateJob()` - Create job
- `useServices()` - Get pricebook services
- `useMaterials()` - Get pricebook materials
- `useInvoices()` - Get all invoices
- `useCreateInvoice()` - Create invoice
- `useHealthCheck()` - API health check

## Error Handling

All API calls return a consistent response format:

```typescript
interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
```

## Security Features

- **Firebase Auth Integration**: All endpoints verify Firebase ID tokens
- **Tenant Isolation**: Each request is automatically scoped to the user's tenant
- **Role-Based Access**: Uses Firebase custom claims for role verification
- **Input Validation**: Server-side validation of all inputs

## Testing

Use the `CustomerApiExample` component to test the API integration:

```typescript
import CustomerApiExample from '../components/CustomerApiExample';

// Add to your routing
<Route path="/api-test" element={<CustomerApiExample />} />
```

## Extending the API

To add new endpoints:

1. **Add to Firebase Functions** (`functions/src/index.ts`):
```typescript
app.get('/api/new-endpoint', verifyToken, async (req, res) => {
  // Implementation
});
```

2. **Add to API Service** (`src/services/ApiService.ts`):
```typescript
async newEndpoint() {
  return this.makeRequest('/api/new-endpoint');
}
```

3. **Add React Hook** (`src/hooks/useApi.ts`):
```typescript
export function useNewEndpoint() {
  return useApi(apiService.newEndpoint);
}
```

## Alternative Approaches

### Approach 2: Direct Firebase REST API

Firebase provides direct REST endpoints:

```typescript
// Example: Get document
const response = await fetch(
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/customers/${customerId}`,
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  }
);
```

### Approach 3: Extended Express Server

You can also extend your existing `server.js` to include API routes:

```javascript
// Add to server.js
app.use('/api', require('./routes/api'));
```

## Monitoring and Logging

Firebase Functions automatically provide:
- Request logging in Firebase Console
- Error tracking
- Performance monitoring
- Usage analytics

## Production Considerations

1. **Rate Limiting**: Implement rate limiting for production
2. **Caching**: Add caching for frequently accessed data
3. **Database Indexes**: Ensure proper Firestore indexes
4. **Error Monitoring**: Set up error monitoring (Sentry, etc.)
5. **Load Testing**: Test API performance under load

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure CORS is properly configured
2. **Auth Errors**: Verify Firebase ID token is valid
3. **Permissions**: Check Firestore security rules
4. **Function Timeout**: Increase timeout for long-running operations

### Debug Mode

Enable debug logging in development:

```typescript
// In functions/src/index.ts
console.log('Debug info:', { user: req.user, data: req.body });
```

## Next Steps

1. Deploy the functions to Firebase
2. Test the API endpoints
3. Integrate with your existing components
4. Add more endpoints as needed
5. Implement proper error handling and logging

This REST API integration provides a solid foundation for external integrations, mobile apps, and third-party services while maintaining security and data integrity. 