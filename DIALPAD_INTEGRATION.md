# Dialpad CTI Integration

This document outlines the integration of Dialpad's Mini Dialer (CTI) into the Nexus Field Service Management application.

## Overview

The Dialpad CTI (Computer Telephony Integration) allows users to make and receive calls directly from within the web application. This integration provides:

- **Click-to-call** functionality from customer records
- **Incoming call notifications** with customer context
- **Call logging** with job and customer data
- **Seamless workflow** integration

## Architecture

### Components

1. **DialpadService** (`src/services/DialpadService.ts`)
   - Handles all communication with Dialpad CTI
   - Manages postMessage API calls
   - Provides authentication and call management

2. **DialpadCTI** (`src/components/DialpadCTI.tsx`)
   - React component that renders the CTI iframe
   - Handles UI state and notifications
   - Provides floating call interface

3. **CallButton** (`src/components/CallButton.tsx`)
   - Reusable click-to-call button component
   - Integrates with customer data
   - Multiple display variants

### Integration Points

- **Layout Component**: Global CTI availability
- **Customer List**: Click-to-call from customer records
- **Customer Detail**: Enhanced calling features
- **Job Management**: Call customers from job records

## Configuration

### Environment Variables

Add to your `.env` file:

```env
VITE_DIALPAD_CLIENT_ID=your_dialpad_client_id_here
VITE_DIALPAD_CLIENT_SECRET=your_dialpad_client_secret_here
```

### Dialpad Setup Requirements

1. **Submit CTI Setup Form** to Dialpad with:
   - **Allowed Origins**: Your domain(s) (e.g., `nexusinc.io`, `localhost:5173`)
   - **Custom Headers**: Any required headers

2. **Receive Client ID** from Dialpad team

3. **Configure iframe permissions**:
   - `microphone`
   - `speaker-selection`
   - `autoplay`
   - `camera`
   - `display-capture`
   - `hid` (required by end of Jan 2023)

## Usage

### Basic Implementation

```typescript
import DialpadCTI from './components/DialpadCTI';

// In your component
<DialpadCTI
  clientId={process.env.VITE_DIALPAD_CLIENT_ID}
  onIncomingCall={handleIncomingCall}
  onAuthenticationChange={handleAuth}
/>
```

### Click-to-Call Buttons

```typescript
import CallButton from './components/CallButton';

// Icon button
<CallButton
  phoneNumber={customer.phone}
  customerName={customer.name}
  customerId={customer.id}
  variant="icon"
/>

// Full button
<CallButton
  phoneNumber={customer.phone}
  customerName={customer.name}
  customerId={customer.id}
  jobId={job.id}
  variant="primary"
  size="md"
/>
```

### Programmatic Calling

```typescript
import { dialpadService } from './services/DialpadService';

// Make a call with customer context
dialpadService.initiateCall('+15551234567', {
  customData: JSON.stringify({
    customerName: 'John Doe',
    customerId: 'cust_123',
    jobId: 'job_456',
    source: 'nexus_field_service'
  })
});
```

## Features

### 1. Authentication Management

- Automatic detection of Dialpad login status
- Visual indicators for connection state
- Callback handlers for auth state changes

### 2. Incoming Call Handling

- Automatic CTI visibility on incoming calls
- Customer information lookup
- Call context display

### 3. Outbound Calling

- Click-to-call from any customer record
- Automatic phone number formatting (E.164)
- Customer context passed to Dialpad

### 4. Call Data Integration

- Customer information attached to calls
- Job context when calling from job records
- Source tracking for analytics

## API Reference

### DialpadService Methods

#### `initializeCTI(clientId: string, container: HTMLElement)`
Initialize the CTI iframe in the specified container.

#### `initiateCall(phoneNumber: string, options?)`
Start a call to the specified number with optional context.

**Options:**
- `enableCurrentTab?: boolean` - Enable tab before calling
- `identityType?: 'Office' | 'OfficeGroup' | 'CallCenter'`
- `identityId?: number` - Identity ID for routing
- `customData?: string` - Max 2000 characters of call context
- `outboundCallerId?: string` - Caller ID override

#### `enableCurrentTab()`
Enable the current tab for calling (required for outbound calls).

#### `endAllCalls()`
End all active calls.

#### `on(event: string, handler: Function)`
Add event listener for CTI events.

**Events:**
- `authentication` - Auth state changes
- `call_ringing` - Incoming call notifications

### CallButton Props

```typescript
interface CallButtonProps {
  phoneNumber: string;          // Phone number to call (required)
  customerName?: string;        // Customer name for context
  customerId?: string;          // Customer ID for tracking
  jobId?: string;              // Job ID if calling from job
  variant?: 'primary' | 'secondary' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}
```

## Event Handling

### Incoming Call Events

```typescript
const handleIncomingCall = (callData) => {
  console.log('Incoming call from:', callData.external_number);
  console.log('Contact info:', callData.contact);
  
  // Custom logic: lookup customer, show notification, etc.
  const customer = lookupCustomerByPhone(callData.external_number);
  if (customer) {
    showCustomerPopup(customer);
  }
};
```

### Authentication Events

```typescript
const handleAuth = (authenticated: boolean, userId: number | null) => {
  if (authenticated) {
    console.log('Dialpad user logged in:', userId);
    // Enable calling features
  } else {
    console.log('Dialpad user logged out');
    // Disable calling features
  }
};
```

## Phone Number Formatting

The service automatically formats phone numbers to E.164 format:

- `(555) 123-4567` → `+15551234567`
- `555-123-4567` → `+15551234567`
- `15551234567` → `+15551234567`
- `5551234567` → `+15551234567` (assumes US)

## Security Considerations

1. **Domain Restrictions**: Dialpad validates allowed origins
2. **Iframe Sandboxing**: Proper sandbox attributes applied
3. **Event Origin Validation**: Only accepts messages from dialpad.com
4. **Data Limits**: Custom data limited to 2000 characters

## Troubleshooting

### Common Issues

1. **CTI Not Loading**
   - Verify client ID is correct
   - Check browser console for iframe errors
   - Ensure domain is in Dialpad's allow list

2. **Authentication Required**
   - User must log into Dialpad in the CTI iframe
   - Check authentication status in component state

3. **Calls Not Initiating**
   - Ensure `enableCurrentTab()` is called
   - Check microphone permissions
   - Verify phone number format

4. **postMessage Errors**
   - Verify event origin validation
   - Check message format against Dialpad spec
   - Ensure iframe is fully loaded

### Debug Mode

Enable debug logging:

```typescript
// In DialpadService constructor
console.log('Debug: CTI messages enabled');
window.addEventListener('message', (event) => {
  if (event.origin === 'https://dialpad.com') {
    console.log('Dialpad message:', event.data);
  }
});
```

## Best Practices

1. **Error Handling**: Always wrap CTI calls in try-catch
2. **User Feedback**: Show loading states for call initiation
3. **Context Data**: Include relevant customer/job info in calls
4. **Performance**: Lazy-load CTI component when needed
5. **Testing**: Test with various phone number formats

## Future Enhancements

Potential improvements for future versions:

1. **Call Recording Integration**: Link recordings to job records
2. **SMS Integration**: Text messaging from customer records  
3. **Call Analytics**: Track call duration and outcomes
4. **CRM Sync**: Sync call logs with external CRM systems
5. **Team Routing**: Route calls based on technician availability

## Support

For Dialpad-specific issues:
- Email: api@dialpad.com
- Documentation: https://developers.dialpad.com/

For integration issues:
- Check browser console for errors
- Verify environment configuration
- Test with simple phone numbers first 