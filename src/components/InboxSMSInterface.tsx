import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Search, Filter, User, Building, Clock, RefreshCw, Phone, MoreHorizontal } from 'lucide-react';
import DialpadAPIService, { SMSThread, SMSMessage } from '../services/DialpadAPIService';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';

// SMSMessage and SMSThread interfaces are now imported from DialpadAPIService

interface FilterOptions {
  direction: 'all' | 'inbound' | 'outbound';
  status: 'all' | 'delivered' | 'failed' | 'pending';
  dateRange: 'today' | 'week' | 'month' | 'custom';
  startDate?: string;
  endDate?: string;
}

interface InboxSMSInterfaceProps {
  selectedThread?: SMSThread | null;
  onThreadSelect?: (thread: SMSThread) => void;
  viewMode: 'my-inbox' | 'team' | 'messages' | 'company-inbox';
  currentUserId?: number;
}

const InboxSMSInterface: React.FC<InboxSMSInterfaceProps> = ({
  selectedThread,
  onThreadSelect,
  viewMode,
  currentUserId
}) => {
  const { user, tenantId } = useFirebaseAuth();
  const [threads, setThreads] = useState<SMSThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    direction: 'all',
    status: 'all',
    dateRange: 'week'
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Initialize Dialpad API service with OAuth config
  const [dialpadAPI, setDialpadAPI] = useState<DialpadAPIService | null>(null);

  useEffect(() => {
      const clientId = import.meta.env.VITE_DIALPAD_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_DIALPAD_CLIENT_SECRET;
  const redirectUri = import.meta.env.VITE_DIALPAD_REDIRECT_URI || 
    (window.location.hostname === 'localhost' 
      ? `${window.location.origin}/oauth/dialpad/callback`
      : 'https://pro.nexus.io/oauth/dialpad/callback');
  const environment = import.meta.env.VITE_DIALPAD_ENVIRONMENT || 'beta';

    if (clientId && clientSecret) {
      const service = new DialpadAPIService({
        clientId,
        clientSecret,
        redirectUri,
        environment: environment as 'sandbox' | 'production',
        scopes: import.meta.env.VITE_DIALPAD_SCOPES?.split(',') || undefined
      });
      setDialpadAPI(service);
    }
  }, []);

  // Load SMS messages and group into threads
  const loadSMSMessages = useCallback(async (refresh = false) => {
    if (!tenantId || !dialpadAPI) return;

    try {
      setIsLoading(true);
      
      // Check if authenticated, if not use demo data
      if (!dialpadAPI.isAuthenticated(tenantId)) {
        console.log('Not authenticated with Dialpad, using demo data');
        const demoData = dialpadAPI.getDemoSMSThreads(viewMode, currentUserId);
        setThreads(demoData);
        setIsLoading(false);
        return;
      }

      // Get SMS threads directly from the API
      const result = await dialpadAPI.getSMSThreads(tenantId, currentUserId);
      
      // Apply search filter
      let filteredThreads = result;
      if (searchTerm) {
        filteredThreads = result.filter(thread =>
          thread.phoneNumber.includes(searchTerm) ||
          thread.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          thread.messages.some(msg => msg.body.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

      setThreads(filteredThreads);
    } catch (error) {
      console.error('Error loading SMS messages:', error);
      // Fallback to demo data
      const demoThreads: SMSThread[] = [
        {
          id: 'thread-1',
          phoneNumber: '+15551234567',
          customerName: 'Sarah Johnson',
          lastMessage: {
            id: 'demo-sms-3',
            direction: 'inbound',
            from: '+15551234567',
            to: '+15559876543',
            body: 'Friday at 10 AM works perfect! Thank you.',
            timestamp: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
            status: 'delivered',
            customerName: 'Sarah Johnson',
            threadId: 'thread-1',
          },
          unreadCount: 1,
          messages: []
        },
        {
          id: 'thread-2',
          phoneNumber: '+15555551234',
          customerName: 'Mike Wilson',
          lastMessage: {
            id: 'demo-sms-4',
            direction: 'inbound',
            from: '+15555551234',
            to: '+15559876543',
            body: 'Is this the emergency repair line? My water heater just started leaking!',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            status: 'delivered',
            customerName: 'Mike Wilson',
            threadId: 'thread-2',
          },
          unreadCount: 1,
          messages: []
        }
      ];
      setThreads(demoThreads);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantId, filters, viewMode, currentUserId, dialpadAPI, searchTerm]);

  // Initial load
  useEffect(() => {
    loadSMSMessages(true);
  }, [loadSMSMessages]);

  // Refresh messages
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSMSMessages(true);
  };

  // Handle thread selection
  const handleThreadClick = (thread: SMSThread) => {
    // Mark as read
    const updatedThread = { ...thread, unreadCount: 0 };
    setThreads(prev => prev.map(t => t.id === thread.id ? updatedThread : t));
    onThreadSelect?.(updatedThread);
  };

  // Send SMS message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedThread || isSending || !dialpadAPI || !tenantId) return;

    try {
      setIsSending(true);
      
      // Create new message
      const message: SMSMessage = {
        id: `msg-${Date.now()}`,
        direction: 'outbound',
        from: '+15559876543', // Company number
        to: selectedThread.phoneNumber,
        body: newMessage.trim(),
        timestamp: new Date().toISOString(),
        status: 'pending',
      };

      // Add message to thread optimistically
      const updatedThread = {
        ...selectedThread,
        lastMessage: message,
        messages: [...selectedThread.messages, message]
      };

      // Update threads
      setThreads(prev => prev.map(t => t.phoneNumber === selectedThread.phoneNumber ? updatedThread : t));
      onThreadSelect?.(updatedThread);

      // Clear input
      setNewMessage('');

      // Send via Dialpad API if authenticated
      if (dialpadAPI.isAuthenticated(tenantId)) {
        const result = await dialpadAPI.sendSMS(
          tenantId,
          selectedThread.phoneNumber,
          newMessage.trim()
        );

        if (result.success) {
          // Update message status to delivered
          const deliveredMessage = { ...message, status: 'delivered' as const, id: result.messageId || message.id };
          const finalThread = {
            ...updatedThread,
            lastMessage: deliveredMessage,
            messages: updatedThread.messages.map(m => m.id === message.id ? deliveredMessage : m)
          };
          
          setThreads(prev => prev.map(t => t.phoneNumber === selectedThread.phoneNumber ? finalThread : t));
          onThreadSelect?.(finalThread);
        } else {
          // Update message status to failed
          const failedMessage = { ...message, status: 'failed' as const };
          const failedThread = {
            ...updatedThread,
            lastMessage: failedMessage,
            messages: updatedThread.messages.map(m => m.id === message.id ? failedMessage : m)
          };
          
          setThreads(prev => prev.map(t => t.phoneNumber === selectedThread.phoneNumber ? failedThread : t));
          onThreadSelect?.(failedThread);
          console.error('Failed to send SMS:', result.error);
        }
      } else {
        // Simulate delivery for demo mode
        setTimeout(() => {
          const deliveredMessage = { ...message, status: 'delivered' as const };
          const finalThread = {
            ...updatedThread,
            lastMessage: deliveredMessage,
            messages: updatedThread.messages.map(m => m.id === message.id ? deliveredMessage : m)
          };
          
          setThreads(prev => prev.map(t => t.phoneNumber === selectedThread.phoneNumber ? finalThread : t));
          onThreadSelect?.(finalThread);
        }, 1000);
      }

    } catch (error) {
      console.error('Error sending SMS:', error);
      // Update message status to failed
      const failedMessage = { 
        id: `msg-${Date.now()}`,
        direction: 'outbound' as const,
        from: '+15559876543',
        to: selectedThread.phoneNumber,
        body: newMessage.trim(),
        timestamp: new Date().toISOString(),
        status: 'failed' as const,
      };
      
      const failedThread = {
        ...selectedThread,
        lastMessage: failedMessage,
        messages: [...selectedThread.messages, failedMessage]
      };
      
      setThreads(prev => prev.map(t => t.phoneNumber === selectedThread.phoneNumber ? failedThread : t));
      onThreadSelect?.(failedThread);
    } finally {
      setIsSending(false);
    }
  };

  // Format phone number
  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      const number = cleaned.slice(1);
      return `+1 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Filter threads based on search
  const filteredThreads = threads.filter(thread => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        thread.phoneNumber.includes(searchTerm) ||
        thread.customerName?.toLowerCase().includes(searchLower) ||
        thread.lastMessage.body.toLowerCase().includes(searchLower) ||
        formatPhoneNumber(thread.phoneNumber).includes(searchTerm)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {viewMode === 'my-inbox' && 'My Messages'}
            {viewMode === 'team' && 'Team Messages'}
            {viewMode === 'messages' && 'All Messages'}
            {viewMode === 'company-inbox' && 'Company Messages'}
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters 
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              <Filter size={16} />
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search messages by number, customer, or content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Direction</label>
                <select
                  value={filters.direction}
                  onChange={(e) => setFilters(prev => ({ ...prev, direction: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Messages</option>
                  <option value="inbound">Received</option>
                  <option value="outbound">Sent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="delivered">Delivered</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date Range</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
            </div>

            {filters.dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No messages found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'Try adjusting your search or filters' : 'No messages match your current filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 p-2">
            {filteredThreads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => handleThreadClick(thread)}
                className={`p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors border-l-4 ${
                  selectedThread?.id === thread.id 
                    ? 'bg-blue-50 dark:bg-slate-700 border-l-blue-500' 
                    : thread.unreadCount > 0
                      ? 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10'
                      : 'border-l-transparent'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={16} className="text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`text-sm truncate ${
                        thread.unreadCount > 0 
                          ? 'font-semibold text-gray-900 dark:text-gray-100' 
                          : 'font-normal text-gray-900 dark:text-gray-100'
                      }`}>
                        {thread.customerName || formatPhoneNumber(thread.phoneNumber)}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {new Date(thread.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {thread.unreadCount > 0 && (
                          <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate mb-1">
                      {formatPhoneNumber(thread.phoneNumber)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {thread.lastMessage.direction === 'outbound' ? 'You: ' : ''}
                      {thread.lastMessage.body}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        thread.lastMessage.status === 'delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        thread.lastMessage.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {thread.lastMessage.status.charAt(0).toUpperCase() + thread.lastMessage.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message Input (if thread is selected) */}
      {selectedThread && (
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Send a message to ${selectedThread.customerName || formatPhoneNumber(selectedThread.phoneNumber)}...`}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxSMSInterface; 