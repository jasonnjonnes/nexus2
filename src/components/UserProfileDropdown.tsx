import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Clock, ClockIcon, DollarSign, ClipboardList, Settings, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { useNotifications } from '../contexts/NotificationContext';

const UserProfileDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useFirebaseAuth();
  const { isClockedIn, clockIn, clockOut, currentTimeEntry } = useNotifications();

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

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleClockToggle = async () => {
    try {
      if (isClockedIn) {
        await clockOut();
      } else {
        await clockIn();
      }
      setIsOpen(false);
    } catch (error) {
      console.error('Error toggling clock:', error);
    }
  };

  const getInitials = (email: string) => {
    return email.split('@')[0].substring(0, 2).toUpperCase();
  };

  const formatClockTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const calculateHoursWorked = () => {
    if (!currentTimeEntry?.clockInTime) return '0.0';
    const now = new Date();
    const clockInTime = new Date(currentTimeEntry.clockInTime);
    const hours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
    return hours.toFixed(1);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-1 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        <div className="h-8 w-8 rounded-full flex items-center justify-center text-slate-800 dark:text-white bg-gray-300 dark:bg-gray-600">
          {user?.photoURL ? (
            <img 
              src={user.photoURL} 
              alt="Profile" 
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <span className="text-sm font-medium">
              {user?.email ? getInitials(user.email) : <User size={16} />}
            </span>
          )}
        </div>
        <ChevronDown size={14} className="text-gray-500 dark:text-gray-400" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-full flex items-center justify-center text-slate-800 dark:text-white bg-gray-300 dark:bg-gray-600">
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="Profile" 
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium">
                    {user?.email ? getInitials(user.email) : <User size={20} />}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {user?.displayName || user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Clock Status */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock size={16} className={isClockedIn ? 'text-green-600' : 'text-gray-400'} />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {isClockedIn ? 'Clocked In' : 'Clocked Out'}
                </span>
              </div>
              <button
                onClick={handleClockToggle}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  isClockedIn
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300'
                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300'
                }`}
              >
                {isClockedIn ? 'Clock Out' : 'Clock In'}
              </button>
            </div>
            {isClockedIn && currentTimeEntry && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <div>Started: {formatClockTime(currentTimeEntry.clockInTime)}</div>
                <div>Hours worked: {calculateHoursWorked()}</div>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => {
                navigate('/settings/profile');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center space-x-3"
            >
              <User size={16} />
              <span>My Profile</span>
            </button>

            <button
              onClick={() => {
                navigate('/payroll/my-payroll');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center space-x-3"
            >
              <DollarSign size={16} />
              <span>My Payroll</span>
            </button>

            <button
              onClick={() => {
                navigate('/tasks/my-tasks');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center space-x-3"
            >
              <ClipboardList size={16} />
              <span>My Tasks</span>
            </button>

            <button
              onClick={() => {
                navigate('/settings');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center space-x-3"
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-gray-200 dark:border-slate-700 py-1">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-3"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileDropdown; 