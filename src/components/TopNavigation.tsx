import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar, Truck, GitBranch, FileText, 
  DollarSign, Users, Search, Bell, Settings, User, ClipboardList, BookOpen, Phone
} from 'lucide-react';
import DarkModeToggle from './DarkModeToggle';
import GlobalSearch from './GlobalSearch';
import NotificationDropdown from './NotificationDropdown';
import UserProfileDropdown from './UserProfileDropdown';
import DialpadCTI from './DialpadCTI';

interface TopNavigationProps {
  toggleSidebar: () => void;
  theme: string;
  toggleTheme: () => void;
}

const TopNavigation: React.FC<TopNavigationProps> = ({ toggleSidebar, theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDialpadOpen, setIsDialpadOpen] = useState(false);
  
  // Dialpad configuration
  const dialpadClientId = import.meta.env.VITE_DIALPAD_CLIENT_ID;
  
  // Debug: Log the client ID to console
  console.log('TopNavigation: Dialpad Client ID:', dialpadClientId);
  
  const handleIncomingCall = (callData: any) => {
    console.log('Incoming call:', callData);
    setIsDialpadOpen(true); // Auto-open dialpad on incoming call
  };

  const handleDialpadAuth = (authenticated: boolean, userId: number | null) => {
    console.log('Dialpad authentication changed:', { authenticated, userId });
  };
  
  const navLinkClasses = ({ isActive }: { isActive: boolean }) => 
    `flex items-center px-3 py-4 text-sm font-medium transition-colors duration-150 ${
      isActive 
        ? 'text-blue-500 dark:text-blue-400 border-b-2 border-blue-500 dark:border-blue-400' 
        : 'text-gray-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white'
    }`;
  
  const mobileNavLinkClasses = ({ isActive }: { isActive: boolean }) => 
    `flex flex-col items-center px-3 py-1 text-xs font-medium transition-colors duration-150 ${
      isActive 
        ? 'text-blue-500 dark:text-blue-400' 
        : 'text-gray-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white'
    }`;

  return (
    <>
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700 z-30 transition-colors duration-300">
        {/* Top section: Logo, Search, Icons */}
        <div className="px-4 sm:px-6 lg:px-8 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img 
                src="/Nexus.svg" 
                alt="Nexus" 
                className="h-8 w-auto transition-all duration-300 dark:brightness-0 dark:invert" 
              />
            </div>
            {/* Mobile Icons */}
            <div className="flex items-center gap-2 md:hidden">
              {/* Mobile Dialpad Button */}
              {dialpadClientId && (
                <button 
                  onClick={() => setIsDialpadOpen(!isDialpadOpen)}
                  className="p-1 rounded-full text-gray-500 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white"
                  title="Open Dialpad"
                >
                  <Phone size={18} />
                </button>
              )}
              <DarkModeToggle theme={theme} toggleTheme={toggleTheme} />
              <NotificationDropdown />
              <button onClick={() => navigate('/settings')} className="p-1 rounded-full text-gray-500 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white">
                <Settings size={20} />
              </button>
              <UserProfileDropdown />
            </div>
          </div>
          
          {/* Enhanced Search Bar */}
          <div className="mt-3 md:mt-0 md:ml-4 relative max-w-md w-full mx-auto md:mx-0">
            <div 
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 bg-gray-100 dark:bg-gray-800 w-full cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Search size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 w-full">
                Search customers, jobs, invoices...
              </span>
              <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-mono bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-gray-500 dark:text-gray-400">
                ⌘K
              </kbd>
            </div>
          </div>
          
          {/* Desktop Icons */}
          <div className="hidden md:flex md:items-center md:gap-3">
            {/* Dialpad Button */}
            {dialpadClientId && (
              <button 
                onClick={() => setIsDialpadOpen(!isDialpadOpen)}
                className="p-2 rounded-full text-gray-500 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Open Dialpad"
              >
                <Phone size={18} />
              </button>
            )}
            <DarkModeToggle theme={theme} toggleTheme={toggleTheme} />
            <NotificationDropdown />
            <button onClick={() => navigate('/settings')} className="p-1 rounded-full text-gray-500 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white">
              <Settings size={20} />
            </button>
            <UserProfileDropdown />
          </div>
        </div>
        
        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex justify-between px-4 sm:px-6 lg:px-8">
          <NavLink to="/" className={navLinkClasses}><LayoutDashboard size={18} className="mr-2" />Dashboard</NavLink>
          <NavLink to="/inbound" className={navLinkClasses}><ClipboardList size={18} className="mr-2" />Inbound</NavLink>
          <NavLink to="/schedule" className={navLinkClasses}><Calendar size={18} className="mr-2" />Schedule</NavLink>
          <NavLink to="/dispatch" className={navLinkClasses}><Truck size={18} className="mr-2" />Dispatch</NavLink>
          <NavLink to="/pricebook" className={navLinkClasses}><BookOpen size={18} className="mr-2" />Pricebook</NavLink>
          <NavLink to="/automations" className={navLinkClasses}><GitBranch size={18} className="mr-2" />Automations</NavLink>
          <NavLink to="/accounting" className={navLinkClasses}><FileText size={18} className="mr-2" />Accounting</NavLink>
          <NavLink to="/payroll" className={navLinkClasses}><DollarSign size={18} className="mr-2" />Payroll</NavLink>
          <NavLink to="/customers" className={navLinkClasses}><Users size={18} className="mr-2" />Customers</NavLink>
        </nav>
        
        {/* Mobile Navigation Links */}
        <div className="md:hidden border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-7 gap-1 py-2 px-4">
            <NavLink to="/" className={mobileNavLinkClasses}><LayoutDashboard size={18} className="mb-1" />Dashboard</NavLink>
            <NavLink to="/inbound" className={mobileNavLinkClasses}><ClipboardList size={18} className="mb-1" />Inbound</NavLink>
            <NavLink to="/schedule" className={mobileNavLinkClasses}><Calendar size={18} className="mb-1" />Schedule</NavLink>
            <NavLink to="/dispatch" className={mobileNavLinkClasses}><Truck size={18} className="mb-1" />Dispatch</NavLink>
            <NavLink to="/pricebook" className={mobileNavLinkClasses}><BookOpen size={18} className="mb-1" />Pricebook</NavLink>
            <NavLink to="/automations" className={mobileNavLinkClasses}><GitBranch size={18} className="mb-1" />Auto</NavLink>
            <NavLink to="/accounting" className={mobileNavLinkClasses}><FileText size={18} className="mb-1" />Account</NavLink>
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearch 
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* Keyboard shortcut handler */}
      <div
        className="fixed inset-0 pointer-events-none"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setIsSearchOpen(true);
          }
          if (e.key === 'Escape' && isSearchOpen) {
            setIsSearchOpen(false);
          }
          if (e.key === 'Escape' && isDialpadOpen) {
            setIsDialpadOpen(false);
          }
        }}
        tabIndex={-1}
      />

      {/* Dialpad CTI */}
      {dialpadClientId && (
        <DialpadCTI
          clientId={dialpadClientId}
          onIncomingCall={handleIncomingCall}
          onAuthenticationChange={handleDialpadAuth}
          isVisible={isDialpadOpen}
          onToggleVisibility={() => setIsDialpadOpen(!isDialpadOpen)}
          className={isDialpadOpen ? 'dialpad-visible' : 'dialpad-hidden'}
        />
      )}


    </>
  );
};

export default TopNavigation;