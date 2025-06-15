import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
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
    <NotificationProvider>
      <div className="min-h-screen bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 transition-colors">
        {/* Top navigation bar with global search, links, dark-mode toggle, etc. */}
        <TopNavigation
          toggleSidebar={toggleSidebar}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        {/* Page content */}
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>

        {/* Dialpad CTI is now integrated into TopNavigation */}
      </div>
    </NotificationProvider>
  );
};

export default Layout;