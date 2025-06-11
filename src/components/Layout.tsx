import React from 'react';
import TopNavigation from './TopNavigation';

interface LayoutProps {
  children: React.ReactNode;
  theme: string;
  toggleTheme: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, theme, toggleTheme }) => {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900">
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopNavigation 
          toggleSidebar={() => {}} 
          theme={theme} 
          toggleTheme={toggleTheme} 
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;