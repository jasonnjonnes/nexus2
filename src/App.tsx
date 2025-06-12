import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { BasicAuthProvider } from './contexts/BasicAuthContext';
import { BasicProtectedRoute } from './components/BasicProtectedRoute';
import { BasicLogin } from './pages/BasicLogin';
import { BasicRegister } from './pages/BasicRegister';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import JobDetail from './pages/JobDetail';
import EstimateDetail from './pages/EstimateDetail';
import InvoiceDetail from './pages/InvoiceDetail';
import Settings from './pages/Settings';
import { Unauthorized } from './pages/Unauthorized';

export default function App() {
  return (
    <Router>
      <BasicAuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<BasicLogin />} />
          <Route path="/register" element={<BasicRegister />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected routes */}
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
            path="/invoice/:invoiceId"
            element={
              <BasicProtectedRoute>
                <Layout>
                  <InvoiceDetail />
                </Layout>
              </BasicProtectedRoute>
            }
          />

          {/* Catch all route - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BasicAuthProvider>
    </Router>
  );
}