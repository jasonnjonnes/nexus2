import React, { useEffect, useRef, useState } from 'react';
import { dialpadService } from '../services/DialpadService';

interface DialpadCTIProps {
  clientId: string;
  onAuthenticationChange?: (authenticated: boolean, userId: number | null) => void;
  onIncomingCall?: (callData: any) => void;
  className?: string;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
}

const DialpadCTI: React.FC<DialpadCTIProps> = ({
  clientId,
  onAuthenticationChange,
  onIncomingCall,
  className = '',
  isVisible,
  onToggleVisibility
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [internalIsVisible, setInternalIsVisible] = useState(false);
  
  // Use external visibility control if provided, otherwise use internal state
  const dialpadVisible = isVisible !== undefined ? isVisible : internalIsVisible;
  const [incomingCall, setIncomingCall] = useState<any>(null);

  // Initialize CTI when panel becomes visible
  useEffect(() => {
    console.log('DialpadCTI: useEffect triggered', { dialpadVisible, clientId });
    if (!dialpadVisible || !clientId) {
      console.log('DialpadCTI: Skipping initialization', { dialpadVisible, clientId });
      return;
    }

    // Wait for next tick to ensure DOM is rendered
    const timer = setTimeout(() => {
      if (!containerRef.current) {
        console.log('DialpadCTI: Container not found after timeout', { container: !!containerRef.current, clientId });
        return;
      }

      console.log('DialpadCTI: Initializing with clientId:', clientId);
      // Initialize CTI
      dialpadService.initializeCTI(clientId, containerRef.current);
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [dialpadVisible, clientId]);

  // Set up event listeners (separate from initialization)
  useEffect(() => {
    if (!clientId) return;

    const handleAuthentication = (data: { authenticated: boolean; userId: number | null }) => {
      setIsAuthenticated(data.authenticated);
      onAuthenticationChange?.(data.authenticated, data.userId);
    };

    const handleCallRinging = (callData: any) => {
      if (callData.state === 'on') {
        setIncomingCall(callData);
        // Show CTI when call comes in (use external toggle if available)
        if (onToggleVisibility) {
          onToggleVisibility();
        } else {
          setInternalIsVisible(true);
        }
        onIncomingCall?.(callData);
      } else if (callData.state === 'off') {
        setIncomingCall(null);
      }
    };

    dialpadService.on('authentication', handleAuthentication);
    dialpadService.on('call_ringing', handleCallRinging);

    // Cleanup
    return () => {
      dialpadService.off('authentication', handleAuthentication);
      dialpadService.off('call_ringing', handleCallRinging);
    };
  }, [clientId, onAuthenticationChange, onIncomingCall, onToggleVisibility]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dialpadService.destroy();
    };
  }, []);

  const toggleVisibility = () => {
    if (onToggleVisibility) {
      onToggleVisibility();
    } else {
      setInternalIsVisible(!internalIsVisible);
    }
  };

  const minimizeCTI = () => {
    if (onToggleVisibility) {
      onToggleVisibility();
    } else {
      setInternalIsVisible(false);
    }
  };

  return (
    <div className={`dialpad-cti ${className}`}>
      {/* CTI Toggle Button */}
      <button
        onClick={toggleVisibility}
        className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-full shadow-lg transition-all duration-300 ${
          incomingCall 
            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
            : isAuthenticated
            ? 'bg-green-500 hover:bg-green-600'
            : 'bg-gray-500 hover:bg-gray-600'
        } text-white font-medium`}
        title={incomingCall ? 'Incoming Call!' : isAuthenticated ? 'Dialpad CTI' : 'Dialpad CTI (Not Authenticated)'}
      >
        {incomingCall ? (
          <div className="flex items-center gap-2">
            📞 <span className="animate-bounce">Incoming Call</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            📞 <span>Dialpad</span>
          </div>
        )}
      </button>

      {/* CTI Panel */}
      {dialpadVisible && (
        <div className="fixed bottom-20 right-4 z-40 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gray-50 px-4 py-2 flex justify-between items-center border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Dialpad CTI</span>
              {isAuthenticated && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Connected
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={minimizeCTI}
                className="text-gray-400 hover:text-gray-600 text-sm"
                title="Minimize"
              >
                ➖
              </button>
            </div>
          </div>

          {/* Incoming Call Alert */}
          {incomingCall && (
            <div className="bg-red-50 border-b border-red-200 p-3">
              <div className="text-red-800 font-medium text-sm mb-1">
                📞 Incoming Call
              </div>
              <div className="text-red-700 text-xs">
                From: {incomingCall.contact?.name || incomingCall.external_number}
              </div>
              <div className="text-red-600 text-xs">
                {incomingCall.external_number}
              </div>
            </div>
          )}

          {/* CTI Container */}
          <div 
            ref={containerRef} 
            className="dialpad-cti-container"
            style={{ width: '400px', height: '520px' }}
          />
        </div>
      )}
    </div>
  );
};

export default DialpadCTI; 