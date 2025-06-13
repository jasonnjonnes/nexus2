import React, { useState, useEffect, useMemo } from 'react';
import { 
  Info, 
  TrendingUp, 
  Users, 
  Calendar, 
  Clock,
  DollarSign,
  FileText,
  CheckCircle,
  AlertCircle,
  XCircle,
  PieChart
} from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { db } from '../firebase';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import {
  query,
  collection,
  where,
  orderBy,
  onSnapshot,
  DocumentData,
  QuerySnapshot,
  Unsubscribe
} from 'firebase/firestore';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// Define interfaces for type safety
interface Job {
  id: string;
  status?: string;
  startDate?: string;
  createdAt?: string;
  technicianId?: string;
  assignedTo?: string;
  assignedTechnicians?: Array<{
    id?: string;
    technicianId?: string;
    name?: string;
  }>;
  customerName?: string;
  jobType?: string;
  businessUnitId?: string;
  businessUnit?: string;
  [key: string]: any;
}

interface Invoice {
  id: string;
  status?: string;
  total?: number;
  createdAt?: string;
  jobId?: string;
  businessUnitId?: string;
  businessUnit?: string;
  [key: string]: any;
}

interface Estimate {
  id: string;
  status?: string;
  total?: number;
  createdAt?: string;
  jobId?: string;
  businessUnitId?: string;
  businessUnit?: string;
  [key: string]: any;
}

interface Customer {
  id: string;
  [key: string]: any;
}

interface BusinessUnit {
  id: string;
  name?: string;
  businessUnitName?: string;
  [key: string]: any;
}

interface Technician {
  id: string;
  name?: string;
  fullName?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: any;
}

interface TechPerformance {
  id: string;
  name: string;
  jobsCompleted: number;
  totalRevenue: number;
}

interface Metrics {
  totalRevenue: number;
  totalSales: number;
  jobStatusCounts: Record<string, number>;
  upcomingJobs: Job[];
  techPerformance: TechPerformance[];
}

interface FilteredData {
  jobs: Job[];
  invoices: Invoice[];
  estimates: Estimate[];
}

interface DateRange {
  start: Date;
  end: Date;
}

declare global {
  interface Window {
    __firebase_config: any;
  }
}

const Dashboard: React.FC = () => {
  // Theme detection
  const [currentTheme, setCurrentTheme] = useState(
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  // Firebase state
  const { user } = useFirebaseAuth();
  const userId = user?.uid || null;
  const [isLoading, setIsLoading] = useState(true);

  // Data state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  // Filter state
  const [dateRange, setDateRange] = useState('today');
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState('all');
  const [selectedTechnician, setSelectedTechnician] = useState('all');

  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          const newTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
          setCurrentTheme(newTheme);
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // Load data from Firebase
  useEffect(() => {
    if (!db || !userId) return;

    const unsubscribes: Unsubscribe[] = [];

    // Load jobs
    const jobsQuery = query(
      collection(db, 'jobs'),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    unsubscribes.push(onSnapshot(jobsQuery, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const jobsData: Job[] = [];
      querySnapshot.forEach((doc) => {
        jobsData.push({ id: doc.id, ...doc.data() } as Job);
      });
      setJobs(jobsData);
    }));

    // Load invoices
    const invoicesQuery = query(
      collection(db, 'invoices'),
      where("userId", "==", userId)
    );
    unsubscribes.push(onSnapshot(invoicesQuery, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const invoicesData: Invoice[] = [];
      querySnapshot.forEach((doc) => {
        invoicesData.push({ id: doc.id, ...doc.data() } as Invoice);
      });
      setInvoices(invoicesData);
    }));

    // Load estimates
    const estimatesQuery = query(
      collection(db, 'estimates'),
      where("userId", "==", userId)
    );
    unsubscribes.push(onSnapshot(estimatesQuery, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const estimatesData: Estimate[] = [];
      querySnapshot.forEach((doc) => {
        estimatesData.push({ id: doc.id, ...doc.data() } as Estimate);
      });
      setEstimates(estimatesData);
    }));

    // Load customers
    const customersQuery = query(
      collection(db, 'customers'),
      where("userId", "==", userId)
    );
    unsubscribes.push(onSnapshot(customersQuery, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const customersData: Customer[] = [];
      querySnapshot.forEach((doc) => {
        customersData.push({ id: doc.id, ...doc.data() } as Customer);
      });
      setCustomers(customersData);
    }));

    // Load business units
    const businessUnitsQuery = query(
      collection(db, 'businessUnits'),
      where("userId", "==", userId)
    );
    unsubscribes.push(onSnapshot(businessUnitsQuery, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const businessUnitsData: BusinessUnit[] = [];
      querySnapshot.forEach((doc) => {
        businessUnitsData.push({ id: doc.id, ...doc.data() } as BusinessUnit);
      });
      setBusinessUnits(businessUnitsData);
    }));

    // Load technicians from the staff collection (filtered by staffType = "technician")
    const staffQuery = query(
      collection(db, 'staff'),
      where("userId", "==", userId),
      where("staffType", "==", "technician")
    );
    unsubscribes.push(onSnapshot(staffQuery, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const techniciansData: Technician[] = [];
      querySnapshot.forEach((doc) => {
        techniciansData.push({ id: doc.id, ...doc.data() } as Technician);
      });
      console.log('Loaded technicians:', techniciansData);
      setTechnicians(techniciansData);
    }));

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [db, userId]);

  // Get date range for filtering
  const getDateRange = (): DateRange => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateRange) {
      case 'today':
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        };
      case 'this_week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return { start: startOfWeek, end: endOfWeek };
      case 'this_month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return { start: startOfMonth, end: endOfMonth };
      case 'last_month':
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: startOfLastMonth, end: endOfLastMonth };
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start: new Date(customStartDate),
            end: new Date(new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000)
          };
        }
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      default:
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
    }
  };

  // Helper function to check if a job is assigned to a specific technician
  const isJobAssignedToTechnician = (job: Job, technicianId: string): boolean => {
    if (!job.assignedTechnicians || !Array.isArray(job.assignedTechnicians)) {
      // Fallback for jobs that might use a single technician field
      return job.technicianId === technicianId || job.assignedTo === technicianId;
    }
    
    // Check if technician is in the assignedTechnicians array
    return job.assignedTechnicians.some(assignment => 
      assignment.technicianId === technicianId || assignment.id === technicianId
    );
  };

  // Filter data based on current filters
  const filteredData = useMemo((): FilteredData => {
    const { start, end } = getDateRange();
    
    const filterByDate = (item: Job | Invoice | Estimate): boolean => {
      const itemDate = new Date(item.createdAt || item.startDate || '');
      return itemDate >= start && itemDate < end;
    };

    const filterByBusinessUnit = (item: Job | Invoice | Estimate): boolean => {
      if (selectedBusinessUnit === 'all') return true;
      return item.businessUnitId === selectedBusinessUnit || item.businessUnit === selectedBusinessUnit;
    };

    const filterByTechnician = (item: Job | Invoice | Estimate): boolean => {
      if (selectedTechnician === 'all') return true;
      
      // For jobs, check if the technician is assigned
      if ('assignedTechnicians' in item || 'technicianId' in item || 'assignedTo' in item) {
        return isJobAssignedToTechnician(item as Job, selectedTechnician);
      }
      
      // For invoices/estimates, check if they're related to jobs assigned to the technician
      if ('jobId' in item) {
        const relatedJob = jobs.find(job => job.id === item.jobId);
        if (relatedJob) {
          return isJobAssignedToTechnician(relatedJob, selectedTechnician);
        }
      }
      
      return false;
    };

    return {
      jobs: jobs.filter(job => filterByDate(job) && filterByBusinessUnit(job) && filterByTechnician(job)),
      invoices: invoices.filter(invoice => filterByDate(invoice) && filterByBusinessUnit(invoice) && filterByTechnician(invoice)),
      estimates: estimates.filter(estimate => filterByDate(estimate) && filterByBusinessUnit(estimate) && filterByTechnician(estimate))
    };
  }, [jobs, invoices, estimates, dateRange, selectedBusinessUnit, selectedTechnician, customStartDate, customEndDate]);

  // Calculate metrics
  const metrics = useMemo((): Metrics => {
    const { jobs: filteredJobs, invoices: filteredInvoices, estimates: filteredEstimates } = filteredData;
    
    // Total revenue from completed invoices
    const completedInvoices = filteredInvoices.filter(invoice => invoice.status === 'paid');
    const totalRevenue = completedInvoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
    
    // Sales from sold estimates
    const soldEstimates = filteredEstimates.filter(estimate => estimate.status === 'approved' || estimate.status === 'sold');
    const totalSales = soldEstimates.reduce((sum, estimate) => sum + (estimate.total || 0), 0);
    
    // Job status counts
    const jobStatusCounts = filteredJobs.reduce((acc, job) => {
      const status = job.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Upcoming appointments (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingJobs = jobs.filter(job => {
      const jobDate = new Date(job.startDate || '');
      const now = new Date();
      return jobDate >= now && jobDate <= nextWeek && (job.status === 'scheduled' || job.status === 'confirmed');
    }).slice(0, 10);

    // Technician performance based on real technician data
    const techPerformance: Record<string, TechPerformance> = {};
    
    // Initialize with actual technicians from Firebase
    technicians.forEach(tech => {
      techPerformance[tech.id] = {
        id: tech.id,
        name: tech.fullName || tech.displayName || `${tech.firstName || ''} ${tech.lastName || ''}`.trim() || tech.name || '',
        jobsCompleted: 0,
        totalRevenue: 0
      };
    });

    // Calculate performance for jobs in the filtered date range
    filteredJobs.forEach(job => {
      if (job.status === 'completed') {
        // Check all assigned technicians for this job
        if (job.assignedTechnicians && Array.isArray(job.assignedTechnicians)) {
          job.assignedTechnicians.forEach(assignment => {
            const techId = assignment.technicianId || assignment.id || '';
            if (techPerformance[techId]) {
              techPerformance[techId].jobsCompleted += 1;
              
              // Find related completed invoice
              const relatedInvoice = invoices.find(inv => inv.jobId === job.id && inv.status === 'paid');
              if (relatedInvoice) {
                // Split revenue among assigned technicians
                const revenueShare = (relatedInvoice.total || 0) / job.assignedTechnicians!.length;
                techPerformance[techId].totalRevenue += revenueShare;
              }
            }
          });
        } else if (job.technicianId || job.assignedTo) {
          // Handle legacy single technician assignment
          const techId = job.technicianId || job.assignedTo || '';
          if (techPerformance[techId]) {
            techPerformance[techId].jobsCompleted += 1;
            
            const relatedInvoice = invoices.find(inv => inv.jobId === job.id && inv.status === 'paid');
            if (relatedInvoice) {
              techPerformance[techId].totalRevenue += relatedInvoice.total || 0;
            }
          }
        }
      }
    });

    // Filter out technicians with no activity for cleaner display
    const activeTechPerformance = Object.values(techPerformance).filter(tech => tech.jobsCompleted > 0);

    return {
      totalRevenue,
      totalSales,
      jobStatusCounts,
      upcomingJobs,
      techPerformance: activeTechPerformance
    };
  }, [filteredData, jobs, invoices, technicians]);

  // Generate revenue trend data for the last 18 months
  const generateRevenueData = () => {
    const months: string[] = [];
    const revenues: number[] = [];
    const now = new Date();
    
    for (let i = 17; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      
      // Get invoices for this month
      const monthlyInvoices = invoices.filter(invoice => {
        const invoiceDate = new Date(invoice.createdAt || '');
        return invoiceDate >= monthDate && invoiceDate < nextMonthDate && invoice.status === 'paid';
      });
      
      const monthlyRevenue = monthlyInvoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
      
      months.push(monthDate.toLocaleDateString('en-US', { month: 'short' }));
      revenues.push(monthlyRevenue);
    }
    
    return { months, revenues };
  };

  const isDarkMode = currentTheme === 'dark';
  const { months, revenues } = generateRevenueData();

  // Revenue trend chart data
  const revenueData = {
    labels: months,
    datasets: [
      {
        label: 'Monthly Revenue',
        data: revenues,
        borderColor: isDarkMode ? '#60A5FA' : '#3B82F6',
        backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.2)' : 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        fill: true,
      },
    ],
  };

  // Job status chart data
  const jobStatusData = {
    labels: ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Pending'],
    datasets: [
      {
        data: [
          metrics.jobStatusCounts.scheduled || 0,
          metrics.jobStatusCounts.in_progress || 0,
          metrics.jobStatusCounts.completed || 0,
          metrics.jobStatusCounts.cancelled || 0,
          metrics.jobStatusCounts.pending || 0
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)',
          'rgba(234, 179, 8, 0.7)',
          'rgba(22, 163, 74, 0.7)',
          'rgba(220, 38, 38, 0.7)',
          'rgba(156, 163, 175, 0.7)',
        ],
        borderColor: isDarkMode ? '#1f2937' : '#ffffff',
        borderWidth: 2,
      },
    ],
  };

  // Chart options
  const lineOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: isDarkMode ? '#334155' : '#ffffff',
        titleColor: isDarkMode ? '#ffffff' : '#000000',
        bodyColor: isDarkMode ? '#ffffff' : '#000000',
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: number) {
            return `$${value.toLocaleString()}`;
          },
          color: isDarkMode ? '#9ca3af' : '#6b7280',
        },
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }
      },
      x: {
        ticks: {
          color: isDarkMode ? '#9ca3af' : '#6b7280',
        },
        grid: {
          color: 'transparent'
        }
      }
    },
  };

  const doughnutOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'right' as const,
        labels: {
          color: isDarkMode ? '#f3f4f6' : '#1f2937',
          boxWidth: 12,
          padding: 20,
        }
      },
      tooltip: {
        backgroundColor: isDarkMode ? '#334155' : '#ffffff',
        titleColor: isDarkMode ? '#ffffff' : '#000000',
        bodyColor: isDarkMode ? '#ffffff' : '#000000',
      }
    },
    cutout: '70%',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600 dark:text-gray-300">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h1>
        <div className="mt-4 md:mt-0">
          <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2">
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="text-sm border-0 focus:ring-0 text-gray-600 dark:text-gray-300 bg-transparent"
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
            <div className="h-4 border-l border-gray-300 dark:border-slate-600"></div>
            <select 
              value={selectedBusinessUnit}
              onChange={(e) => setSelectedBusinessUnit(e.target.value)}
              className="text-sm border-0 focus:ring-0 text-gray-600 dark:text-gray-300 bg-transparent"
            >
              <option value="all">All Business Units</option>
              {businessUnits.map(bu => (
                <option key={bu.id} value={bu.id}>{bu.businessUnitName || bu.name}</option>
              ))}
            </select>
            <div className="h-4 border-l border-gray-300 dark:border-slate-600"></div>
            <select 
              value={selectedTechnician}
              onChange={(e) => setSelectedTechnician(e.target.value)}
              className="text-sm border-0 focus:ring-0 text-gray-600 dark:text-gray-300 bg-transparent"
            >
              <option value="all">All Technicians</option>
              {technicians.map(tech => (
                <option key={tech.id} value={tech.id}>
                  {tech.fullName || tech.displayName || `${tech.firstName || ''} ${tech.lastName || ''}`.trim() || tech.name || ''}
                </option>
              ))}
            </select>
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center space-x-2 mt-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-sm border border-gray-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300"
              />
              <span className="text-gray-500 dark:text-gray-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-sm border border-gray-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300"
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Revenue section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Revenue</h2>
            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
              <TrendingUp size={14} className="mr-1" />
              Revenue Tracking
            </div>
          </div>
          
          <div className="flex justify-center mb-6">
            <div className="relative h-48 w-48">
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                  ${metrics.totalRevenue.toLocaleString()}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</span>
              </div>
              <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#EBF5FF" className="dark:stroke-slate-700" strokeWidth="10" />
                <circle 
                  cx="50" 
                  cy="50" 
                  r="45" 
                  fill="none" 
                  stroke="#3B82F6" 
                  className="dark:stroke-blue-500" 
                  strokeWidth="10" 
                  strokeDasharray="282.6" 
                  strokeDashoffset={282.6 - (metrics.totalRevenue > 0 ? 200 : 0)}
                />
              </svg>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <div className="flex items-center">
                <span className="text-gray-600 dark:text-gray-400 text-sm">TOTAL REVENUE</span>
                <Info size={14} className="ml-1 text-gray-400" />
              </div>
              <span className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
                ${metrics.totalRevenue.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center">
                <span className="text-gray-600 dark:text-gray-400 text-sm">MISSED</span>
                <Info size={14} className="ml-1 text-gray-400" />
              </div>
              <span className="text-2xl font-semibold text-gray-800 dark:text-gray-100">$2,450</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">18 Month Trend</h2>
            <div className="flex space-x-2">
              <button className="px-3 py-1 text-sm font-medium bg-blue-600 text-white rounded">
                Month Trend
              </button>
              <button className="px-3 py-1 text-sm font-medium bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded">
                Week Trend
              </button>
            </div>
          </div>
          
          <div className="h-64">
            <Line data={revenueData} options={lineOptions} />
          </div>
        </div>
      </div>
      
      {/* Company metrics section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Company Metrics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="flex flex-col lg:border-r border-gray-200 dark:border-slate-700 pr-4 last:border-r-0">
            <div className="flex items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">TOTAL SALES</span>
              <Info size={14} className="ml-1 text-gray-400" />
            </div>
            <span className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
              ${metrics.totalSales.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col lg:border-r border-gray-200 dark:border-slate-700 pr-4 last:border-r-0">
            <div className="flex items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">COMPLETED REVENUE</span>
              <Info size={14} className="ml-1 text-gray-400" />
            </div>
            <span className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
              ${metrics.totalRevenue.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col lg:border-r border-gray-200 dark:border-slate-700 pr-4 last:border-r-0">
            <div className="flex items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">TOTAL JOBS</span>
              <Info size={14} className="ml-1 text-gray-400" />
            </div>
            <span className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
              {filteredData.jobs.length}
            </span>
          </div>
          <div className="flex flex-col lg:border-r border-gray-200 dark:border-slate-700 pr-4 last:border-r-0">
            <div className="flex items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">NON-JOB REVENUE</span>
              <Info size={14} className="ml-1 text-gray-400" />
            </div>
            <span className="text-2xl font-semibold text-gray-800 dark:text-gray-100">$0</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">ESTIMATES SENT</span>
              <Info size={14} className="ml-1 text-gray-400" />
            </div>
            <span className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
              {filteredData.estimates.length}
            </span>
          </div>
        </div>
      </div>
      
      {/* Additional metrics and charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Job Status Summary</h2>
          <div className="h-64">
            <Doughnut data={jobStatusData} options={doughnutOptions} />
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Upcoming Appointments</h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {metrics.upcomingJobs.length > 0 ? (
              metrics.upcomingJobs.map((job) => (
                <div key={job.id} className="flex items-start p-3 border border-gray-100 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                  <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded mr-3">
                    <Calendar size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-800 dark:text-gray-100">{job.customerName || 'Unknown Customer'}</span>
                      <div className={`px-2 py-0.5 text-xs rounded-full ${
                        job.status === 'scheduled' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        job.status === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {job.status || 'Pending'}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{job.jobType || 'Service Call'}</div>
                    <div className="flex items-center mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <Clock size={14} className="mr-1" />
                      {job.startDate ? new Date(job.startDate).toLocaleDateString() : 'Date TBD'}
                      {job.assignedTechnicians && job.assignedTechnicians.length > 0 && (
                        <span>
                          {' - '}
                          {job.assignedTechnicians.map(assignment => {
                            const tech = technicians.find(t => t.id === (assignment.technicianId || assignment.id));
                            return tech ? (tech.fullName || tech.displayName || `${tech.firstName} ${tech.lastName}`.trim() || tech.name) : 'Unknown';
                          }).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Calendar size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">No Upcoming Appointments</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">You're all caught up! No scheduled appointments in the next 7 days.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Technician performance */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Technician Performance</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Technician</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jobs Completed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg. Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer Rating</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {metrics.techPerformance.length > 0 ? (
                metrics.techPerformance.map((tech) => (
                  <tr key={tech.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm">
                          {tech.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{tech.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {tech.jobsCompleted}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      ${tech.totalRevenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      ${tech.jobsCompleted > 0 ? (tech.totalRevenue / tech.jobsCompleted).toLocaleString() : '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">4.8</span>
                        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                        </svg>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No technician performance data available for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;