interface DialpadMessage {
  api: string;
  version: string;
  method: string;
  payload?: any;
}

interface CallContact {
  id: string;
  phone: string;
  type: string;
  name: string;
  email?: string;
}

interface CallTarget {
  id: number;
  phone: string;
  type: string;
  name: string;
  email?: string;
}

interface CallRingingPayload {
  state: 'on' | 'off';
  id: number;
  contact: CallContact;
  target: CallTarget;
  internal_number: string;
  external_number: string;
}

interface UserAuthPayload {
  user_authenticated: boolean;
  user_id: number;
}

export class DialpadService {
  private ctiIframe: HTMLIFrameElement | null = null;
  private isAuthenticated = false;
  private currentUserId: number | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor() {
    // Listen for messages from Dialpad CTI
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  /**
   * Initialize the CTI with the provided client ID
   */
  initializeCTI(clientId: string, container: HTMLElement): void {
    const iframe = document.createElement('iframe');
    iframe.src = `https://dialpad.com/apps/${clientId}`;
    iframe.title = 'Dialpad CTI';
    iframe.allow = 'microphone; speaker-selection; autoplay; camera; display-capture; hid';
    iframe.sandbox = 'allow-popups allow-scripts allow-same-origin';
    iframe.style.cssText = 'width: 400px; height: 520px; border: none; border-radius: 8px;';
    
    container.appendChild(iframe);
    this.ctiIframe = iframe;

    // Enable current tab once iframe loads
    iframe.onload = () => {
      setTimeout(() => this.enableCurrentTab(), 1000);
    };
  }

  /**
   * Handle messages from Dialpad CTI
   */
  private handleMessage(event: MessageEvent): void {
    if (event.origin !== 'https://dialpad.com') return;

    const message: DialpadMessage = event.data;
    if (message.api !== 'opencti_dialpad' || message.version !== '1.0') return;

    switch (message.method) {
      case 'user_authentication':
        this.handleAuthentication(message.payload as UserAuthPayload);
        break;
      case 'call_ringing':
        this.handleCallRinging(message.payload as CallRingingPayload);
        break;
      default:
        console.log('Unknown Dialpad message:', message);
    }
  }

  /**
   * Handle user authentication events
   */
  private handleAuthentication(payload: UserAuthPayload): void {
    this.isAuthenticated = payload.user_authenticated;
    this.currentUserId = payload.user_authenticated ? payload.user_id : null;
    
    this.emit('authentication', {
      authenticated: this.isAuthenticated,
      userId: this.currentUserId
    });
  }

  /**
   * Handle incoming call events
   */
  private handleCallRinging(payload: CallRingingPayload): void {
    this.emit('call_ringing', payload);
  }

  /**
   * Enable current tab for calling
   */
  enableCurrentTab(): void {
    if (!this.ctiIframe) return;

    const message: DialpadMessage = {
      api: 'opencti_dialpad',
      version: '1.0',
      method: 'enable_current_tab'
    };

    this.ctiIframe.contentWindow?.postMessage(message, 'https://dialpad.com');
  }

  /**
   * Initiate a call to a phone number
   */
  initiateCall(phoneNumber: string, options: {
    enableCurrentTab?: boolean;
    identityType?: 'Office' | 'OfficeGroup' | 'CallCenter';
    identityId?: number;
    customData?: string;
    outboundCallerId?: string;
  } = {}): void {
    if (!this.ctiIframe) {
      console.error('CTI not initialized');
      return;
    }

    const message: DialpadMessage = {
      api: 'opencti_dialpad',
      version: '1.0',
      method: 'initiate_call',
      payload: {
        enable_current_tab: options.enableCurrentTab ?? true,
        phone_number: this.formatPhoneNumber(phoneNumber),
        identity_type: options.identityType,
        identity_id: options.identityId,
        custom_data: options.customData,
        outbound_caller_id: options.outboundCallerId
      }
    };

    this.ctiIframe.contentWindow?.postMessage(message, 'https://dialpad.com');
  }

  /**
   * End all active calls
   */
  endAllCalls(): void {
    if (!this.ctiIframe) return;

    const message: DialpadMessage = {
      api: 'opencti_dialpad',
      version: '1.0',
      method: 'end_all_calls'
    };

    this.ctiIframe.contentWindow?.postMessage(message, 'https://dialpad.com');
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Add + if not present and assume US number if 10 digits
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    } else if (!phoneNumber.startsWith('+')) {
      return `+${digits}`;
    }
    
    return phoneNumber;
  }

  /**
   * Add event listener
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    handlers?.forEach(handler => handler(data));
  }

  /**
   * Get authentication status
   */
  getAuthenticationStatus(): { authenticated: boolean; userId: number | null } {
    return {
      authenticated: this.isAuthenticated,
      userId: this.currentUserId
    };
  }

  /**
   * Destroy the CTI instance
   */
  destroy(): void {
    if (this.ctiIframe && this.ctiIframe.parentNode) {
      this.ctiIframe.parentNode.removeChild(this.ctiIframe);
      this.ctiIframe = null;
    }
    this.eventHandlers.clear();
    window.removeEventListener('message', this.handleMessage.bind(this));
  }
}

// Create singleton instance
export const dialpadService = new DialpadService(); 