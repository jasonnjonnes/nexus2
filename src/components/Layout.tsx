import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import TopNavigation from './TopNavigation';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useFirebaseAuth();
  const navigate = useNavigate();

  /* ------------------------------------------------------------------
   * Theme (light / dark) handling for the whole application
   * ------------------------------------------------------------------ */
  const getInitialTheme = () => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  /* ------------------------------------------------------------------
   * Sidebar toggle placeholder – can be extended later if needed
   * ------------------------------------------------------------------ */
  const toggleSidebar = () => {
    /* Future implementation: open / close sidebar */
  };

  /* ------------------------------------------------------------------
   * Logout helper (kept from previous layout)
   * ------------------------------------------------------------------ */
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Top navigation bar with global search, links, dark-mode toggle, etc. */}
      <TopNavigation
        toggleSidebar={toggleSidebar}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {/* Optional user/logout section – can be styled / positioned as desired */}
      <div className="hidden md:flex justify-end items-center px-6 py-2 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700">
        <span className="mr-4 text-sm font-medium">
          {user?.email}
        </span>
        <button
          onClick={handleLogout}
          className="px-3 py-1 text-sm text-gray-800 dark:text-gray-100 bg-gray-200 dark:bg-slate-700 rounded-md hover:bg-gray-300 dark:hover:bg-slate-600"
        >
          Logout
        </button>
      </div>

      {/* Page content */}
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;