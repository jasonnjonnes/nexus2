import React, { useState, useEffect, useCallback } from 'react';
import { Phone, PhoneCall, PhoneMissed, Voicemail, Filter, Search, Play, Download, User, Building, Clock, Calendar, MoreHorizontal, RefreshCw } from 'lucide-react';
import DialpadAPIService, { CallLogEntry } from '../services/DialpadAPIService';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';

// CallLogEntry interface is now imported from DialpadAPIService

interface FilterOptions {
  direction: 'all' | 'inbound' | 'outbound';
  status: 'all' | 'completed' | 'missed' | 'voicemail' | 'busy' | 'failed';
  department: 'all' | string;
  dateRange: 'today' | 'week' | 'month' | 'custom';
  startDate?: string;
  endDate?: string;
}

interface InboxCallsInterfaceProps {
  selectedCall?: CallLogEntry | null;
  onCallSelect?: (call: CallLogEntry) => void;
  viewMode: 'my-inbox' | 'team' | 'calls' | 'company-inbox';
  currentUserId?: number;
}

const InboxCallsInterface: React.FC<InboxCallsInterfaceProps> = ({
  selectedCall,
  onCallSelect,
  viewMode,
  currentUserId
}) => {
  const { user, tenantId } = useFirebaseAuth();
  const [calls, setCalls] = useState<CallLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    direction: 'all',
    status: 'all',
    department: 'all',
    dateRange: 'week'
  });
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();

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

  // Load call logs based on view mode and filters
  const loadCallLogs = useCallback(async (refresh = false) => {
    if (!tenantId || !dialpadAPI) return;

    try {
      setIsLoading(true);
      
      // Check if authenticated, if not use demo data
      if (!dialpadAPI.isAuthenticated(tenantId)) {
        console.log('Not authenticated with Dialpad, using demo data');
        const demoData = dialpadAPI.getDemoCallLogs(viewMode, currentUserId);
        setCalls(demoData);
        setIsLoading(false);
        return;
      }

      // Determine API parameters based on view mode
      let apiParams: any = {
        limit: 50,
        offset: refresh ? 0 : calls.length,
      };

      // Apply date range filter
      const now = new Date();
      switch (filters.dateRange) {
        case 'today':
          apiParams.startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString().split('T')[0];
          apiParams.endDate = new Date(now.setHours(23, 59, 59, 999)).toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
          apiParams.startDate = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          apiParams.startDate = monthStart.toISOString().split('T')[0];
          break;
        case 'custom':
          if (filters.startDate) apiParams.startDate = filters.startDate;
          if (filters.endDate) apiParams.endDate = filters.endDate;
          break;
      }

      // Apply direction filter
      if (filters.direction !== 'all') {
        apiParams.direction = filters.direction;
      }

      // Apply view mode specific filters
      switch (viewMode) {
        case 'my-inbox':
          if (currentUserId) {
            apiParams.userId = currentUserId;
          }
          break;
        case 'team':
          // Load calls for all team members
          break;
        case 'calls':
          // Load all calls with department filtering
          if (filters.department !== 'all') {
            const dept = departments.find(d => d.name === filters.department);
            if (dept) {
              apiParams.departmentId = parseInt(dept.id);
            }
          }
          break;
        case 'company-inbox':
          // Load calls from unassigned numbers or company-wide
          break;
      }

      // Apply status filter
      if (filters.status !== 'all') {
        apiParams.status = filters.status;
      }

      const result = await dialpadAPI.getCallLogs(tenantId, apiParams);
      
      // Apply search filter
      let filteredCalls = result;
      if (searchTerm) {
        filteredCalls = result.filter(call =>
          call.from.includes(searchTerm) ||
          call.to.includes(searchTerm) ||
          call.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      // Set the filtered calls
      if (refresh) {
        setCalls(filteredCalls);
      } else {
        setCalls(prev => [...prev, ...filteredCalls]);
      }
    } catch (error) {
      console.error('Error loading call logs:', error);
      // Fallback to demo data
      const demoData: CallLogEntry[] = [
        {
          id: 'demo-call-1',
          direction: 'inbound',
          from: '+15551234567',
          to: '+15559876543',
          duration: 180,
          startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 180000).toISOString(),
          status: 'completed',
          customerName: 'Sarah Johnson',
        },
        {
          id: 'demo-call-2',
          direction: 'inbound',
          from: '+15555551234',
          to: '+15559876543',
          duration: 0,
          startTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          status: 'missed',
          customerName: 'Mike Wilson',
        },
        {
          id: 'demo-call-3',
          direction: 'inbound',
          from: '+15556667890',
          to: '+15559876543',
          duration: 45,
          startTime: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 6 * 60 * 60 * 1000 + 45000).toISOString(),
          status: 'voicemail',
          customerName: 'Emma Davis',
          voicemailUrl: 'https://example.com/voicemail/demo-3.mp3',
        }
      ];
      setCalls(demoData);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantId, filters, searchTerm, viewMode, currentUserId, departments, dialpadAPI, calls.length]);

  // Load departments for filtering
  const loadDepartments = useCallback(async () => {
    // Demo departments for now
    setDepartments([
      { id: '1', name: 'Sales' },
      { id: '2', name: 'Support' },
      { id: '3', name: 'Dispatch' },
      { id: '4', name: 'Management' }
    ]);
  }, []);

  // Initial load
  useEffect(() => {
    loadCallLogs(true);
    loadDepartments();
  }, [loadCallLogs, loadDepartments]);

  // Refresh calls
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadCallLogs(true);
  };

  // Handle call selection
  const handleCallClick = (call: CallLogEntry) => {
    onCallSelect?.(call);
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
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

  // Get call status icon and color
  const getCallStatusIcon = (call: CallLogEntry) => {
    switch (call.status) {
      case 'completed':
        return call.direction === 'inbound' 
          ? <PhoneCall size={16} className="text-green-600 dark:text-green-400" />
          : <Phone size={16} className="text-blue-600 dark:text-blue-400" />;
      case 'missed':
        return <PhoneMissed size={16} className="text-red-600 dark:text-red-400" />;
      case 'voicemail':
        return <Voicemail size={16} className="text-purple-600 dark:text-purple-400" />;
      case 'busy':
        return <PhoneMissed size={16} className="text-orange-600 dark:text-orange-400" />;
      case 'failed':
        return <PhoneMissed size={16} className="text-red-600 dark:text-red-400" />;
      default:
        return <Phone size={16} className="text-gray-600 dark:text-gray-400" />;
    }
  };

  // Filter calls based on search and filters
  const filteredCalls = calls.filter(call => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        call.from.includes(searchTerm) ||
        call.to.includes(searchTerm) ||
        call.customerName?.toLowerCase().includes(searchLower) ||
        formatPhoneNumber(call.from).includes(searchTerm) ||
        formatPhoneNumber(call.to).includes(searchTerm)
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
            {viewMode === 'my-inbox' && 'My Calls'}
            {viewMode === 'team' && 'Team Calls'}
            {viewMode === 'calls' && 'All Calls'}
            {viewMode === 'company-inbox' && 'Company Calls'}
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
            placeholder="Search calls by number or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Direction</label>
                <select
                  value={filters.direction}
                  onChange={(e) => setFilters(prev => ({ ...prev, direction: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Calls</option>
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
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
                  <option value="completed">Completed</option>
                  <option value="missed">Missed</option>
                  <option value="voicemail">Voicemail</option>
                  <option value="busy">Busy</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {(viewMode === 'calls' || viewMode === 'team') && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                  <select
                    value={filters.department}
                    onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Departments</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              )}

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

      {/* Call List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="p-8 text-center">
            <Phone className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No calls found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'Try adjusting your search or filters' : 'No calls match your current filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 p-2">
            {filteredCalls.map((call) => (
              <div
                key={call.id}
                onClick={() => handleCallClick(call)}
                className={`p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors border-l-4 ${
                  selectedCall?.id === call.id 
                    ? 'bg-blue-50 dark:bg-slate-700 border-l-blue-500' 
                    : call.status === 'missed' 
                      ? 'border-l-red-500 bg-red-50/30 dark:bg-red-900/10' 
                      : call.status === 'voicemail'
                        ? 'border-l-purple-500 bg-purple-50/30 dark:bg-purple-900/10'
                        : 'border-l-transparent'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getCallStatusIcon(call)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {call.customerName || (call.direction === 'inbound' ? formatPhoneNumber(call.from) : formatPhoneNumber(call.to))}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                        {new Date(call.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {call.direction === 'inbound' ? 'From' : 'To'}: {formatPhoneNumber(call.direction === 'inbound' ? call.from : call.to)}
                      </p>
                      <div className="flex items-center space-x-2">
                        {call.status === 'voicemail' && call.voicemailUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle voicemail playback
                            }}
                            className="p-1 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded"
                          >
                            <Play size={12} />
                          </button>
                        )}
                        {call.recordingUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(call.recordingUrl, '_blank');
                            }}
                            className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                          >
                            <Download size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        call.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        call.status === 'missed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        call.status === 'voicemail' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                        call.status === 'busy' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                        {call.status.charAt(0).toUpperCase() + call.status.slice(1)}
                      </span>
                      <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                        <Clock size={12} />
                        <span>{formatDuration(call.duration)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InboxCallsInterface; 