import { useState, useCallback } from 'react';
import { apiService } from '../services/ApiService';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T>(
  apiFunction: (...args: any[]) => Promise<{ data?: T; error?: string }>
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      setState({ data: null, loading: true, error: null });
      
      try {
        const response = await apiFunction(...args);
        
        if (response.error) {
          setState({ data: null, loading: false, error: response.error });
          return null;
        }
        
        setState({ data: response.data || null, loading: false, error: null });
        return response.data || null;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState({ data: null, loading: false, error: errorMessage });
        return null;
      }
    },
    [apiFunction]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// Specific hooks for common operations
export function useCustomers() {
  return useApi(apiService.getCustomers);
}

export function useCustomer() {
  return useApi(apiService.getCustomer);
}

export function useCreateCustomer() {
  return useApi(apiService.createCustomer);
}

export function useUpdateCustomer() {
  return useApi(apiService.updateCustomer);
}

export function useDeleteCustomer() {
  return useApi(apiService.deleteCustomer);
}

export function useJobs() {
  return useApi(apiService.getJobs);
}

export function useCreateJob() {
  return useApi(apiService.createJob);
}

export function useServices() {
  return useApi(apiService.getServices);
}

export function useMaterials() {
  return useApi(apiService.getMaterials);
}

export function useInvoices() {
  return useApi(apiService.getInvoices);
}

export function useCreateInvoice() {
  return useApi(apiService.createInvoice);
}

export function useHealthCheck() {
  return useApi(apiService.healthCheck);
} 