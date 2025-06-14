import { auth } from '../firebase';

// Base API configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://pro.nexus.io/api'
  : 'http://localhost:5001/servicepro-4c705/nam5/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiService {
  private async getAuthToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    return await user.getIdToken();
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Request failed' };
      }

      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // =========================
  // CUSTOMERS API
  // =========================
  
  async getCustomers() {
    return this.makeRequest<{ customers: any[] }>('/api/customers');
  }

  async getCustomer(id: string) {
    return this.makeRequest<{ customer: any }>(`/api/customers/${id}`);
  }

  async createCustomer(customerData: any) {
    return this.makeRequest<{ customer: any }>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    });
  }

  async updateCustomer(id: string, customerData: any) {
    return this.makeRequest<{ message: string }>(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(customerData),
    });
  }

  async deleteCustomer(id: string) {
    return this.makeRequest<{ message: string }>(`/api/customers/${id}`, {
      method: 'DELETE',
    });
  }

  // =========================
  // JOBS API
  // =========================
  
  async getJobs() {
    return this.makeRequest<{ jobs: any[] }>('/api/jobs');
  }

  async createJob(jobData: any) {
    return this.makeRequest<{ job: any }>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  // =========================
  // PRICEBOOK API
  // =========================
  
  async getServices() {
    return this.makeRequest<{ services: any[] }>('/api/pricebook/services');
  }

  async getMaterials() {
    return this.makeRequest<{ materials: any[] }>('/api/pricebook/materials');
  }

  // =========================
  // INVOICES API
  // =========================
  
  async getInvoices() {
    return this.makeRequest<{ invoices: any[] }>('/api/invoices');
  }

  async createInvoice(invoiceData: any) {
    return this.makeRequest<{ invoice: any }>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(invoiceData),
    });
  }

  // =========================
  // UTILITY METHODS
  // =========================
  
  async healthCheck() {
    return this.makeRequest<{ status: string; timestamp: string }>('/health');
  }
}

export const apiService = new ApiService();
export default apiService; 