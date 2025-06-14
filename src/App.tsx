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
        </Routes>
      </Router>
    </FirebaseAuthProvider>
  );
}