import React, { useState, useRef, useEffect } from 'react';
import { Bell, Clock, CheckCircle, AlertCircle, X, User, DollarSign, ClipboardList } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';

const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    showClockInReminder,
    dismissClockInReminder,
    clockIn,
    isClockedIn
  } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'clock_in_reminder':
        return <Clock size={16} className="text-blue-600" />;
      case 'task_assignment':
        return <ClipboardList size={16} className="text-purple-600" />;
      case 'payroll_update':
        return <DollarSign size={16} className="text-green-600" />;
      case 'payment_received':
        return <CheckCircle size={16} className="text-green-600" />;
      default:
        return <Bell size={16} className="text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/20';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      setIsOpen(false);
    }
  };

  const handleClockInNow = async () => {
    try {
      await clockIn('Clocked in via notification reminder');
      dismissClockInReminder();
      setIsOpen(false);
    } catch (error) {
      console.error('Error clocking in:', error);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full text-gray-500 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Clock-in Reminder Notification */}
      {showClockInReminder && !isClockedIn && (
        <div className="fixed top-20 right-4 z-50 bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-700 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-full">
                <Clock size={20} className="text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Time to Clock In!
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Don't forget to start tracking your time for today.
                </p>
                <div className="flex space-x-2 mt-3">
                  <button
                    onClick={handleClockInNow}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Clock In Now
                  </button>
                  <button
                    onClick={dismissClockInReminder}
                    className="px-3 py-1 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 text-xs rounded-md hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={dismissClockInReminder}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Notifications Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`px-4 py-3 border-l-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                    !notification.read ? getPriorityColor(notification.priority) : 'border-l-gray-300 dark:border-l-slate-600'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${
                          !notification.read 
                            ? 'text-gray-900 dark:text-gray-100' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {notification.title}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                      </div>
                      <p className={`text-sm mt-1 ${
                        !notification.read 
                          ? 'text-gray-700 dark:text-gray-300' 
                          : 'text-gray-500 dark:text-gray-500'
                      }`}>
                        {notification.message}
                      </p>
                      {notification.actionLabel && (
                        <span className="inline-block mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {notification.actionLabel} →
                        </span>
                      )}
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
              <button
                onClick={() => {
                  navigate('/notifications');
                  setIsOpen(false);
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown; 