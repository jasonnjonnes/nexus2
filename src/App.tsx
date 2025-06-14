import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import BasicProtectedRoute from './components/BasicProtectedRoute';
import Layout from './components/Layout';
import { FirebaseAuthProvider } from './contexts/FirebaseAuthContext';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Pricebook from './pages/Pricebook';
import Settings from './pages/Settings';
import JobDetail from './pages/JobDetail';
import InvoiceDetail from './pages/InvoiceDetail';
import EstimateDetail from './pages/EstimateDetail';
import Payroll from './pages/Payroll';
import Dispatch from './pages/Dispatch';
import Inbound from './pages/Inbound';
import Automations from './pages/Automations';
import Accounting from './pages/Accounting';
import { Unauthorized } from './pages/Unauthorized';
import { BasicLogin } from './pages/BasicLogin';
import CompanyOnboarding from './pages/CompanyOnboarding';

export default function App() {
  return (
    <FirebaseAuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<BasicLogin />} />
          <Route path="/onboarding" element={<CompanyOnboarding />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route
            path="/"
            element={
              <BasicProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </BasicProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <BasicProtectedRoute>
                <Layout>
                  <Customers />
                </Layout>
              </BasicProtectedRoute>
            }
          />
          <Route
            path="/job/:jobId"
            element={
              <BasicProtectedRoute>
                <Layout>
                  <JobDetail />
                </Layout>
              </BasicProtectedRoute>
            }
          />
          <Route
            path="/invoice/:invoiceId"
            element={
              <BasicProtectedRoute>
                <Layout>
                  <InvoiceDetail />
                </Layout>
              </BasicProtectedRoute>
            }
          />
          <Route
            path="/estimate/:estimateId"
            element={
              <BasicProtectedRoute>
                <Layout>
                  <EstimateDetail />
                </Layout>
              </BasicProtectedRoute>
            }
          />
          <Route
            path="/pricebook"
            element={
              <BasicProtectedRoute>
                <Layout>
                  <Pricebook />
                </Layout>
              </BasicProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <BasicProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </BasicProtectedRoute>
            }
          />
          <Route
            path="/payroll"
            element={
              <BasicProtectedRoute>
                <Layout>
                  <Payroll />
                </Layout>
              </BasicProtectedRoute>
            }
          />
          <Route
            path="/dispatch"
            element={
              <BasicProtectedRoute>
                <Layout>
                  <Dispatch />
                </Layout>
              </BasicProtectedRoute>
            }
          />
          <Route
            path="/inbound"
            element={
              <BasicProtectedRoute>
                <Layout>
                  <Inbound />
                </Layout>
              </BasicProtectedRoute>
            }
          />
          <Route
            path="/automations"
            element={
              <BasicProtectedRoute>
                <Layout>
                  <Automations />
                </Layout>
              </BasicProtectedRoute>
            }
          />
          <Route
            path="/accounting"
            element={
              <BasicProtectedRoute>
                <Layout>
                  <Accounting />
                </Layout>
              </BasicProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </FirebaseAuthProvider>
  );
}