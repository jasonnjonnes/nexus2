// Dialpad API Service with proper OAuth 2.0 implementation
// Following Dialpad's official OAuth documentation for multi-tenant applications

interface DialpadOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'sandbox' | 'production' | 'beta';
  scopes?: string[];
}

interface DialpadTokens {
  access_token: string;
  refresh_token?: string;
  token_type: 'bearer';
  expires_in?: number;
  expires_at?: number;
}

interface DialpadUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  timezone: string;
  company: {
    id: number;
    name: string;
  };
}

interface CallLogEntry {
  id: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  status: 'completed' | 'missed' | 'voicemail' | 'busy' | 'failed' | 'no-answer';
  startTime: string;
  endTime?: string;
  duration: number;
  recordingUrl?: string;
  voicemailUrl?: string;
  customerName?: string;
  userId?: number;
  departmentId?: number;
}

interface SMSMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  body: string;
  timestamp: string;
  status: 'delivered' | 'pending' | 'failed';
  userId?: number;
}

interface SMSThread {
  phoneNumber: string;
  customerName?: string;
  messages: SMSMessage[];
  lastMessage: SMSMessage;
  unreadCount: number;
}

class DialpadAPIService {
  private config: DialpadOAuthConfig;
  private baseUrl: string;
  private tokenStorage: Map<string, DialpadTokens> = new Map(); // tenantId -> tokens
  private userCache: Map<string, DialpadUser> = new Map(); // tenantId -> user

  constructor(config: DialpadOAuthConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'sandbox' 
      ? 'https://sandbox.dialpad.com' 
      : config.environment === 'beta'
      ? 'https://dialpadbeta.com'
      : 'https://dialpad.com';
  }

  // Step 1: Generate OAuth authorization URL
  generateAuthUrl(tenantId: string, state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state: state || this.generateState(tenantId),
      scope: this.config.scopes?.join(' ') || ''
    });

    return `${this.baseUrl}/oauth2/authorize?${params.toString()}`;
  }

  // Step 2: Handle OAuth callback and exchange code for tokens
  async handleOAuthCallback(
    tenantId: string, 
    code: string, 
    state: string
  ): Promise<{ success: boolean; user?: DialpadUser; error?: string }> {
    try {
      // Verify state parameter for CSRF protection
      if (!this.verifyState(tenantId, state)) {
        return { success: false, error: 'Invalid state parameter' };
      }

      // Step 3: Exchange authorization code for access token
      const tokens = await this.exchangeCodeForTokens(code);
      
      // Store tokens for this tenant
      this.tokenStorage.set(tenantId, tokens);
      
      // Get user information
      const user = await this.getCurrentUser(tenantId);
      this.userCache.set(tenantId, user);

      return { success: true, user };
    } catch (error) {
      console.error('OAuth callback error:', error);
      return { success: false, error: error.message };
    }
  }

  // Exchange authorization code for access token
  private async exchangeCodeForTokens(code: string): Promise<DialpadTokens> {
    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens: DialpadTokens = await response.json();
    
    // Calculate expiration time if provided
    if (tokens.expires_in) {
      tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
    }

    return tokens;
  }

  // Refresh access token using refresh token
  async refreshAccessToken(tenantId: string): Promise<boolean> {
    try {
      const tokens = this.tokenStorage.get(tenantId);
      if (!tokens?.refresh_token) {
        return false;
      }

      const response = await fetch(`${this.baseUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const newTokens: DialpadTokens = await response.json();
      
      // Calculate expiration time
      if (newTokens.expires_in) {
        newTokens.expires_at = Date.now() + (newTokens.expires_in * 1000);
      }

      // Update stored tokens
      this.tokenStorage.set(tenantId, newTokens);
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  // Revoke OAuth tokens (deauthorization)
  async revokeTokens(tenantId: string): Promise<boolean> {
    try {
      const tokens = this.tokenStorage.get(tenantId);
      if (!tokens) {
        return true; // Already revoked
      }

      const response = await fetch(`${this.baseUrl}/oauth2/deauthorize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });

      // Clean up local storage regardless of response
      this.tokenStorage.delete(tenantId);
      this.userCache.delete(tenantId);

      return response.ok;
    } catch (error) {
      console.error('Token revocation error:', error);
      return false;
    }
  }

  // Get current authenticated user
  async getCurrentUser(tenantId: string): Promise<DialpadUser> {
    const response = await this.makeAuthenticatedRequest(tenantId, '/api/v2/users/me');
    return response;
  }

  // Get call logs with filtering options
  async getCallLogs(
    tenantId: string,
    options: {
      userId?: number;
      departmentId?: number;
      direction?: 'inbound' | 'outbound';
      status?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<CallLogEntry[]> {
    const params = new URLSearchParams();
    
    if (options.userId) params.append('user_id', options.userId.toString());
    if (options.departmentId) params.append('department_id', options.departmentId.toString());
    if (options.direction) params.append('direction', options.direction);
    if (options.status) params.append('status', options.status);
    if (options.startDate) params.append('start_date', options.startDate);
    if (options.endDate) params.append('end_date', options.endDate);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());

    const response = await this.makeAuthenticatedRequest(
      tenantId, 
      `/api/v2/calls?${params.toString()}`
    );

    return this.transformCallLogs(response.items || []);
  }

  // Get SMS messages
  async getSMSMessages(
    tenantId: string,
    options: {
      userId?: number;
      phoneNumber?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<SMSMessage[]> {
    const params = new URLSearchParams();
    
    if (options.userId) params.append('user_id', options.userId.toString());
    if (options.phoneNumber) params.append('phone_number', options.phoneNumber);
    if (options.startDate) params.append('start_date', options.startDate);
    if (options.endDate) params.append('end_date', options.endDate);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());

    const response = await this.makeAuthenticatedRequest(
      tenantId,
      `/api/v2/sms?${params.toString()}`
    );

    return this.transformSMSMessages(response.items || []);
  }

  // Send SMS message
  async sendSMS(
    tenantId: string,
    to: string,
    message: string,
    from?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await this.makeAuthenticatedRequest(
        tenantId,
        '/api/v2/sms',
        {
          method: 'POST',
          body: JSON.stringify({
            to,
            text: message,
            from
          })
        }
      );

      return { success: true, messageId: response.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Group SMS messages into threads
  async getSMSThreads(
    tenantId: string,
    userId?: number
  ): Promise<SMSThread[]> {
    const messages = await this.getSMSMessages(tenantId, { userId });
    const threads = new Map<string, SMSThread>();

    messages.forEach(message => {
      const phoneNumber = message.direction === 'inbound' ? message.from : message.to;
      
      if (!threads.has(phoneNumber)) {
        threads.set(phoneNumber, {
          phoneNumber,
          messages: [],
          lastMessage: message,
          unreadCount: 0
        });
      }

      const thread = threads.get(phoneNumber)!;
      thread.messages.push(message);
      
      // Update last message if this one is newer
      if (new Date(message.timestamp) > new Date(thread.lastMessage.timestamp)) {
        thread.lastMessage = message;
      }

      // Count unread messages (assuming inbound messages are unread)
      if (message.direction === 'inbound') {
        thread.unreadCount++;
      }
    });

    // Sort messages within each thread by timestamp
    threads.forEach(thread => {
      thread.messages.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });

    return Array.from(threads.values()).sort((a, b) => 
      new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
    );
  }

  // Check if tenant is authenticated
  isAuthenticated(tenantId: string): boolean {
    const tokens = this.tokenStorage.get(tenantId);
    if (!tokens) return false;

    // Check if token is expired
    if (tokens.expires_at && Date.now() >= tokens.expires_at) {
      return false;
    }

    return true;
  }

  // Get cached user info
  getCachedUser(tenantId: string): DialpadUser | null {
    return this.userCache.get(tenantId) || null;
  }

  // Make authenticated API request with automatic token refresh
  private async makeAuthenticatedRequest(
    tenantId: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    let tokens = this.tokenStorage.get(tenantId);
    
    if (!tokens) {
      throw new Error('No authentication tokens found for tenant');
    }

    // Check if token is expired and refresh if possible
    if (tokens.expires_at && Date.now() >= tokens.expires_at) {
      const refreshed = await this.refreshAccessToken(tenantId);
      if (!refreshed) {
        throw new Error('Token expired and refresh failed');
      }
      tokens = this.tokenStorage.get(tenantId)!;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try to refresh token once more
        const refreshed = await this.refreshAccessToken(tenantId);
        if (refreshed) {
          // Retry the request with new token
          const newTokens = this.tokenStorage.get(tenantId)!;
          const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
              'Authorization': `Bearer ${newTokens.access_token}`,
              'Content-Type': 'application/json',
              ...options.headers,
            },
          });
          
          if (retryResponse.ok) {
            return retryResponse.json();
          }
        }
        throw new Error('Authentication failed');
      }
      
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} ${error}`);
    }

    return response.json();
  }

  // Transform Dialpad call log format to our format
  private transformCallLogs(dialpadCalls: any[]): CallLogEntry[] {
    return dialpadCalls.map(call => ({
      id: call.id,
      direction: call.direction,
      from: call.from?.number || call.from,
      to: call.to?.number || call.to,
      status: this.mapCallStatus(call.state),
      startTime: call.start_time,
      endTime: call.end_time,
      duration: call.duration || 0,
      recordingUrl: call.recording_url,
      voicemailUrl: call.voicemail_url,
      customerName: call.contact?.name,
      userId: call.user_id,
      departmentId: call.department_id
    }));
  }

  // Transform Dialpad SMS format to our format
  private transformSMSMessages(dialpadMessages: any[]): SMSMessage[] {
    return dialpadMessages.map(msg => ({
      id: msg.id,
      direction: msg.direction,
      from: msg.from,
      to: msg.to,
      body: msg.text,
      timestamp: msg.date_created,
      status: msg.state || 'delivered',
      userId: msg.user_id
    }));
  }

  // Map Dialpad call states to our status format
  private mapCallStatus(dialpadState: string): CallLogEntry['status'] {
    const statusMap: Record<string, CallLogEntry['status']> = {
      'completed': 'completed',
      'missed': 'missed',
      'voicemail': 'voicemail',
      'busy': 'busy',
      'failed': 'failed',
      'no_answer': 'no-answer'
    };
    
    return statusMap[dialpadState] || 'failed';
  }

  // Generate CSRF state parameter
  private generateState(tenantId: string): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    return btoa(`${tenantId}:${timestamp}:${random}`);
  }

  // Verify CSRF state parameter
  private verifyState(tenantId: string, state: string): boolean {
    try {
      const decoded = atob(state);
      const [stateTenantId] = decoded.split(':');
      return stateTenantId === tenantId;
    } catch {
      return false;
    }
  }

  // Demo data fallback methods (for development/testing)
  getDemoCallLogs(viewMode: string, userId?: number): CallLogEntry[] {
    const demoData: CallLogEntry[] = [
      {
        id: 'demo-call-1',
        direction: 'inbound',
        from: '+1234567890',
        to: '+1987654321',
        status: 'completed',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        duration: 180,
        customerName: 'John Smith',
        userId: 1001
      },
      {
        id: 'demo-call-2',
        direction: 'inbound',
        from: '+1555123456',
        to: '+1987654321',
        status: 'missed',
        startTime: new Date(Date.now() - 7200000).toISOString(),
        duration: 0,
        customerName: 'Sarah Johnson',
        userId: 1002
      },
      {
        id: 'demo-call-3',
        direction: 'outbound',
        from: '+1987654321',
        to: '+1444555666',
        status: 'voicemail',
        startTime: new Date(Date.now() - 10800000).toISOString(),
        duration: 45,
        voicemailUrl: 'https://example.com/voicemail.mp3',
        customerName: 'Mike Wilson',
        userId: 1001
      }
    ];

    // Filter based on view mode and user
    return demoData.filter(call => {
      if (viewMode === 'my-inbox' && userId && call.userId !== userId) {
        return false;
      }
      return true;
    });
  }

  getDemoSMSThreads(viewMode: string, userId?: number): SMSThread[] {
    const demoThreads: SMSThread[] = [
      {
        phoneNumber: '+1234567890',
        customerName: 'John Smith',
        messages: [
          {
            id: 'sms-1',
            direction: 'inbound',
            from: '+1234567890',
            to: '+1987654321',
            body: 'Hi, I need help with my HVAC system',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            status: 'delivered',
            userId: 1001
          },
          {
            id: 'sms-2',
            direction: 'outbound',
            from: '+1987654321',
            to: '+1234567890',
            body: 'Hello! I can help you with that. What seems to be the issue?',
            timestamp: new Date(Date.now() - 3300000).toISOString(),
            status: 'delivered',
            userId: 1001
          }
        ],
        lastMessage: {
          id: 'sms-2',
          direction: 'outbound',
          from: '+1987654321',
          to: '+1234567890',
          body: 'Hello! I can help you with that. What seems to be the issue?',
          timestamp: new Date(Date.now() - 3300000).toISOString(),
          status: 'delivered',
          userId: 1001
        },
        unreadCount: 0
      }
    ];

    return demoThreads.filter(thread => {
      if (viewMode === 'my-inbox' && userId) {
        return thread.messages.some(msg => msg.userId === userId);
      }
      return true;
    });
  }
}

export default DialpadAPIService;
export type { 
  DialpadOAuthConfig, 
  DialpadTokens, 
  DialpadUser, 
  CallLogEntry, 
  SMSMessage, 
  SMSThread 
}; 