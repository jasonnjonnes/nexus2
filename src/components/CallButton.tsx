import React from 'react';
import { dialpadService } from '../services/DialpadService';

interface CallButtonProps {
  phoneNumber: string;
  customerName?: string;
  customerId?: string;
  jobId?: string;
  variant?: 'primary' | 'secondary' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}

const CallButton: React.FC<CallButtonProps> = ({
  phoneNumber,
  customerName,
  customerId,
  jobId,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false
}) => {
  const handleCall = () => {
    if (!phoneNumber || disabled) return;

    // Create custom data to pass with the call
    const customData = JSON.stringify({
      customerName,
      customerId,
      jobId,
      source: 'nexus_field_service',
      timestamp: new Date().toISOString()
    });

    // Initiate the call
    dialpadService.initiateCall(phoneNumber, {
      customData: customData.length <= 2000 ? customData : JSON.stringify({
        customerName,
        customerId,
        source: 'nexus_field_service'
      })
    });
  };

  const formatDisplayNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  const baseClasses = "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-2 text-base"
  };

  const variantClasses = {
    primary: "bg-green-600 hover:bg-green-700 text-white focus:ring-green-500",
    secondary: "bg-gray-100 hover:bg-gray-200 text-gray-900 focus:ring-gray-500",
    icon: "bg-transparent hover:bg-gray-100 text-gray-600 hover:text-green-600 p-1 rounded-full focus:ring-green-500"
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleCall}
        disabled={disabled || !phoneNumber}
        className={`${baseClasses} ${variantClasses.icon} ${className}`}
        title={`Call ${formatDisplayNumber(phoneNumber)}`}
      >
        <svg 
          className="w-5 h-5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" 
          />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={handleCall}
      disabled={disabled || !phoneNumber}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} rounded-md ${className}`}
    >
      <svg 
        className="w-4 h-4 mr-2" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" 
        />
      </svg>
      {size === 'sm' ? 'Call' : `Call ${formatDisplayNumber(phoneNumber)}`}
    </button>
  );
};

export default CallButton; 