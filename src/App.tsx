import React, { useState, useEffect } from 'react';
import { Routes, Route, BrowserRouter } from 'react-router-dom';

// Import your components
import Layout from './components/Layout';

// Import your pages
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Dispatch from './pages/Dispatch';
import Automations from './pages/Automations';
import Accounting from './pages/Accounting';
import Payroll from './pages/Payroll';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import Inbound from './pages/Inbound';
import JobDetail from './pages/JobDetail';
import EstimateDetail from './pages/EstimateDetail';
import InvoiceDetail from './pages/InvoiceDetail';
import Pricebook from './pages/Pricebook';

export default function App() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <BrowserRouter>
      <Layout theme={theme} toggleTheme={toggleTheme}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inbound" element={<Inbound />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/dispatch" element={<Dispatch />} />
          <Route path="/automations" element={<Automations />} />
          <Route path="/accounting" element={<Accounting />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/pricebook" element={<Pricebook />} />
          <Route path="/job/:jobId" element={<JobDetail />} />
          <Route path="/estimate/:estimateId" element={<EstimateDetail />} />
          <Route path="/invoice/:invoiceId" element={<InvoiceDetail />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}