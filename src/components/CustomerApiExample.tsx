import React, { useEffect, useState } from 'react';
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '../hooks/useApi';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
}

const CustomerApiExample: React.FC = () => {
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    company: ''
  });

  // Use API hooks
  const customersApi = useCustomers();
  const createCustomerApi = useCreateCustomer();
  const updateCustomerApi = useUpdateCustomer();
  const deleteCustomerApi = useDeleteCustomer();

  // Load customers on component mount
  useEffect(() => {
    customersApi.execute();
  }, []);

  // Handle form submission
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await createCustomerApi.execute(newCustomer);
    
    if (result) {
      console.log('Customer created:', result);
      // Refresh the customer list
      customersApi.execute();
      // Reset form
      setNewCustomer({ name: '', email: '', phone: '', company: '' });
    }
  };

  // Handle customer update
  const handleUpdateCustomer = async (customerId: string, updates: Partial<Customer>) => {
    const result = await updateCustomerApi.execute(customerId, updates);
    
    if (result) {
      console.log('Customer updated');
      // Refresh the customer list
      customersApi.execute();
    }
  };

  // Handle customer deletion
  const handleDeleteCustomer = async (customerId: string) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      const result = await deleteCustomerApi.execute(customerId);
      
      if (result) {
        console.log('Customer deleted');
        // Refresh the customer list
        customersApi.execute();
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Customer API Example</h1>
      
      {/* Create Customer Form */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Create New Customer</h2>
        <form onSubmit={handleCreateCustomer} className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              type="tel"
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Company</label>
            <input
              type="text"
              value={newCustomer.company}
              onChange={(e) => setNewCustomer({ ...newCustomer, company: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="col-span-2">
            <button
              type="submit"
              disabled={createCustomerApi.loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createCustomerApi.loading ? 'Creating...' : 'Create Customer'}
            </button>
          </div>
        </form>
        {createCustomerApi.error && (
          <div className="mt-4 text-red-600">
            Error: {createCustomerApi.error}
          </div>
        )}
      </div>

      {/* Customer List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Customer List</h2>
        
        {customersApi.loading && (
          <div className="text-center py-4">Loading customers...</div>
        )}
        
        {customersApi.error && (
          <div className="text-red-600 mb-4">
            Error loading customers: {customersApi.error}
          </div>
        )}
        
        {customersApi.data && (
          <div className="space-y-4">
            {customersApi.data.customers.length === 0 ? (
              <div className="text-gray-500 text-center py-4">
                No customers found
              </div>
            ) : (
              customersApi.data.customers.map((customer: Customer) => (
                <div
                  key={customer.id}
                  className="border border-gray-200 rounded-lg p-4 flex justify-between items-start"
                >
                  <div>
                    <h3 className="font-medium">{customer.name}</h3>
                    <p className="text-sm text-gray-600">{customer.email}</p>
                    <p className="text-sm text-gray-600">{customer.phone}</p>
                    {customer.company && (
                      <p className="text-sm text-gray-600">{customer.company}</p>
                    )}
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => handleUpdateCustomer(customer.id, { 
                        name: customer.name + ' (Updated)' 
                      })}
                      disabled={updateCustomerApi.loading}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(customer.id)}
                      disabled={deleteCustomerApi.loading}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        
        <div className="mt-4">
          <button
            onClick={() => customersApi.execute()}
            disabled={customersApi.loading}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            {customersApi.loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerApiExample; 