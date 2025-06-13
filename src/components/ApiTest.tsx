import React, { useState } from 'react';
import { apiService } from '../services/ApiService';
import { auth } from '../firebase';

const ApiTest: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testCustomersAPI = async () => {
    setLoading(true);
    try {
      const response = await apiService.getCustomers();
      setResult(JSON.stringify(response, null, 2));
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testHealthCheck = async () => {
    setLoading(true);
    try {
      const response = await apiService.healthCheck();
      setResult(JSON.stringify(response, null, 2));
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const showToken = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        setResult('Error: User not logged in');
        return;
      }
      const token = await user.getIdToken();
      setResult(`Bearer Token:\n${token}\n\n(Token copied to clipboard)`);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(token);
    } catch (error) {
      setResult(`Error getting token: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">API Test</h2>
      
      <div className="space-x-4 mb-4">
        <button
          onClick={showToken}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? 'Getting...' : 'Show Bearer Token'}
        </button>
        
        <button
          onClick={testHealthCheck}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Health Check'}
        </button>
        
        <button
          onClick={testCustomersAPI}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Customers API'}
        </button>
      </div>

      {result && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Result:</h3>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ApiTest; 