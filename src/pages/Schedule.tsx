import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  Filter,
  X,
  Clock,
  Plus,
  Search,
  Info,
  Trash2,
  Copy,
  User,
  Users,
  AlertTriangle,
  Check
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, addWeeks, addMonths, startOfMonth, endOfMonth, isSameDay, parseISO, eachDayOfInterval } from 'date-fns';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, onSnapshot, query, where, doc, setDoc, deleteDoc, addDoc, getDocs, Firestore
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import CalendarPicker from '../components/schedule/CalendarPicker';
import BulkDeleteModal from '../components/schedule/BulkDeleteModal';
import CreateShiftModal from '../components/schedule/CreateShiftModal';
import UnscheduledWarningModal from '../components/schedule/UnscheduledWarningModal';
import { StaffMember, Shift, ShiftCreationData, ShiftDeletionData } from '../types/schedule';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { db } from '../firebase';

declare global {
  interface Window {
    __firebase_config: any;
  }
}

const Schedule: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState('Week'); // Day, Week, Month
  const [showCreateShift, setShowCreateShift] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    scheduled: true,
    onCall: true,
    timeOff: true
  });
  
  const { user, tenantId } = useFirebaseAuth();
  const userId = user?.uid;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debug logging
  console.log('Schedule render:', { user: user?.email, tenantId, userId, isLoading });
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState('');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('');

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log('Schedule: Loading timeout reached, setting loading to false');
        setIsLoading(false);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading]);

  useEffect(() => {
    if (!db || !userId || !tenantId) {
      console.log('Schedule: Missing required data for Firebase queries', { db: !!db, userId, tenantId });
      return;
    }

    console.log('Schedule: Setting up staff listener', { userId, tenantId });

    const staffQuery = query(
      collection(db, 'tenants', tenantId, 'staff'),
      where("userId", "==", userId),
      where("status", "==", "active")
    );
    
    const unsubscribe = onSnapshot(staffQuery, (querySnapshot) => {
      const staffData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StaffMember[];
      console.log('Schedule: Loaded staff data:', staffData.length, 'members');
      setStaff(staffData);
      setIsLoading(false); // Set loading to false when staff data loads
    }, (error) => {
      console.error("Error loading staff:", error);
      setError('Failed to load staff data');
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, [db, userId, tenantId]);

  useEffect(() => {
    if (!db || !userId || !tenantId) return;

    console.log('Schedule: Setting up shifts listener', { userId, tenantId });

    const shiftsQuery = query(
      collection(db, 'tenants', tenantId, 'schedule'),
      where("userId", "==", userId)
    );
    
    const unsubscribe = onSnapshot(shiftsQuery, (querySnapshot) => {
      const shiftsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Shift[];
      console.log('Schedule: Loaded shifts data:', shiftsData.length, 'shifts');
      setShifts(shiftsData);
    }, (error) => {
      console.error("Error loading shifts:", error);
      setError('Failed to load shifts data');
    });
    
    return () => unsubscribe();
  }, [db, userId, tenantId]);

  const handleSaveShift = async (shiftData: ShiftCreationData) => {
    if (!db || !userId) return;
    
    try {
      const startDate = new Date(shiftData.startDate);
      const endDate = new Date(shiftData.endDate);
      
      const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
      
      const promises: Promise<void>[] = [];
      
      for (const staffId of shiftData.selectedStaff) {
        const staffMember = staff.find(s => s.id === staffId);
        
        for (const date of dateRange) {
          const dayOfWeek = format(date, 'EEEE').toLowerCase();
          
          if (shiftData.selectedDays[dayOfWeek as keyof typeof shiftData.selectedDays]) {
            const shiftId = `${Date.now()}_${staffId}_${format(date, 'yyyy-MM-dd')}`;
            const shiftRecord: Shift = {
              ...shiftData,
              id: shiftId,
              staffId,
              staffName: staffMember?.fullName || '',
              staffType: staffMember?.staffType || 'office',
              startDate: format(date, 'yyyy-MM-dd'),
              endDate: format(date, 'yyyy-MM-dd'),
              userId,
              createdAt: new Date().toISOString()
            };
            
            promises.push(setDoc(doc(db, 'tenants', tenantId, 'schedule', shiftRecord.id), shiftRecord));
          }
        }
      }
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Error creating shifts:', error);
      setError('Failed to create shifts');
    }
  };

  const handleBulkDelete = async (deleteData: ShiftDeletionData) => {
    if (!db || !userId) return;
    
    try {
      const shiftsQuery = query(
        collection(db, 'tenants', tenantId, 'schedule'),
        where("userId", "==", userId)
      );
      
      const querySnapshot = await getDocs(shiftsQuery);
      const shiftsToDelete: string[] = [];
      
      const deleteStartDate = new Date(deleteData.startDate);
      const deleteEndDate = new Date(deleteData.endDate);
      
      querySnapshot.forEach((doc) => {
        const shift = doc.data() as Shift;
        const shiftDate = new Date(shift.startDate);
        
        const matchesDateRange = shiftDate >= deleteStartDate && shiftDate <= deleteEndDate;
        const matchesStaff = deleteData.selectedStaff.includes(shift.staffId);
        const matchesShiftType = deleteData.shiftTypes[shift.type];
        
        const dayOfWeek = format(shiftDate, 'EEEE').toLowerCase();
        const matchesDayOfWeek = deleteData.selectedDays[dayOfWeek as keyof typeof deleteData.selectedDays];
        
        if (matchesDateRange && matchesStaff && matchesShiftType && matchesDayOfWeek) {
          shiftsToDelete.push(doc.id);
        }
      });
      
      const deletePromises = shiftsToDelete.map(shiftId => 
        deleteDoc(doc(db, 'tenants', tenantId, 'schedule', shiftId))
      );
      
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error bulk deleting shifts:', error);
      setError('Failed to delete shifts');
    }
  };

  const handleDateNavigation = (direction: 'prev' | 'next') => {
    if (viewMode === 'Day') {
      setCurrentDate(prev => addDays(prev, direction === 'next' ? 1 : -1));
    } else if (viewMode === 'Week') {
      setCurrentDate(prev => addWeeks(prev, direction === 'next' ? 1 : -1));
    } else if (viewMode === 'Month') {
      setCurrentDate(prev => addMonths(prev, direction === 'next' ? 1 : -1));
    }
  };

  const getDateRangeText = () => {
    if (viewMode === 'Day') {
      return format(currentDate, 'EEE, MMM d, yyyy');
    } else if (viewMode === 'Week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    } else if (viewMode === 'Month') {
      return format(currentDate, 'MMMM yyyy');
    }
    return '';
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return {
        name: format(date, 'EEE'),
        number: format(date, 'd'),
        full: format(date, 'yyyy-MM-dd'),
        date: date
      };
    });
  };

  const getShiftForStaffAndDate = (staffId: string, date: string) => {
    return shifts.find(shift => 
      shift.staffId === staffId && 
      shift.startDate === date
    );
  };

  const getShiftTypeColor = (type: string) => {
    switch (type) {
      case 'scheduled': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700';
      case 'on_call': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700';
      case 'time_off': return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600';
    }
  };

  const getShiftTypeLabel = (type: string) => {
    switch (type) {
      case 'scheduled': return 'Scheduled';
      case 'on_call': return 'On Call';
      case 'time_off': return 'Time Off';
      default: return 'Unknown';
    }
  };

  // Filter staff based on selected filters
  const filteredStaff = staff.filter(member => {
    if (selectedBusinessUnit && member.businessUnit !== selectedBusinessUnit) return false;
    if (selectedStaffFilter && !member.fullName.toLowerCase().includes(selectedStaffFilter.toLowerCase())) return false;
    return true;
  });

  const weekDays = getWeekDays();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600 dark:text-gray-300">Loading schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg m-4 dark:bg-red-900/50 dark:text-red-300">
        <b>Error:</b> {error}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            {/* View Mode Selector */}
            <select 
              value={viewMode} 
              onChange={(e) => setViewMode(e.target.value)}
              className="border border-gray-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-700"
            >
              <option value="Day">Day</option>
              <option value="Week">Week</option>
              <option value="Month">Month</option>
            </select>

            {/* Date Navigation */}
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => handleDateNavigation('prev')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-medium min-w-[200px] text-center">{getDateRangeText()}</span>
              <button 
                onClick={() => handleDateNavigation('next')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="flex space-x-2">
              <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"><Copy size={18} /></button>
              <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"><Filter size={18} /></button>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowCreateShift(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Shift
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-6">
          <div className="w-48">
            <select 
              value={selectedBusinessUnit}
              onChange={(e) => setSelectedBusinessUnit(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-700"
            >
              <option value="">ALL BUSINESS UNITS</option>
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
            </select>
          </div>
          <div className="w-48">
            <select 
              value={selectedStaffFilter}
              onChange={(e) => setSelectedStaffFilter(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-700"
            >
              <option value="">ALL STAFF</option>
              {staff.map(member => (
                <option key={member.id} value={member.fullName}>{member.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">SHIFT TYPES</h3>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  checked={selectedFilters.scheduled} 
                  onChange={() => setSelectedFilters(prev => ({ ...prev, scheduled: !prev.scheduled }))} 
                  className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700" 
                />
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-sm">Scheduled</span>
                <Info size={14} className="text-gray-400" />
              </label>
              <label className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  checked={selectedFilters.onCall} 
                  onChange={() => setSelectedFilters(prev => ({ ...prev, onCall: !prev.onCall }))} 
                  className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700" 
                />
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span className="text-sm">On Call</span>
                <Info size={14} className="text-gray-400" />
              </label>
              <label className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  checked={selectedFilters.timeOff} 
                  onChange={() => setSelectedFilters(prev => ({ ...prev, timeOff: !prev.timeOff }))} 
                  className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700" 
                />
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span className="text-sm">Time Off</span>
                <Info size={14} className="text-gray-400" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[1200px]">
          {/* Days header */}
          <div className="grid grid-cols-8 border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
            <div className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">
              STAFF MEMBERS ({filteredStaff.length})
            </div>
            {weekDays.map((day, i) => (
              <div key={i} className="p-4 text-center border-l border-gray-200 dark:border-slate-700">
                <div className="font-medium text-gray-800 dark:text-gray-200">{day.name} {day.number}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{format(day.date, 'MMM')}</div>
              </div>
            ))}
          </div>

          {/* Staff rows */}
          {filteredStaff.length === 0 ? (
            <div className="p-8 text-center">
              <Users size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">No Staff Members</h3>
              <p className="text-gray-600 dark:text-gray-400">Add staff members in Settings to create schedules.</p>
            </div>
          ) : (
            filteredStaff.map(member => (
              <div key={member.id} className="grid grid-cols-8 border-b border-gray-200 dark:border-slate-700">
                <div className="p-4 font-medium text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-slate-700">
                  <div className="flex items-center">
                    {member.profilePicture ? (
                      <img 
                        src={member.profilePicture} 
                        alt={member.fullName} 
                        className="h-8 w-8 rounded-full object-cover mr-3"
                      />
                    ) : (
                      <div 
                        className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm mr-3"
                        style={{ backgroundColor: member.color || '#6B7280' }}
                      >
                        {member.firstName?.[0]}{member.lastName?.[0]}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium">{member.fullName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {member.role} • {member.staffType === 'technician' ? 'Tech' : 'Office'}
                      </div>
                    </div>
                  </div>
                </div>
                {weekDays.map((day, i) => {
                  const shift = getShiftForStaffAndDate(member.id, day.full);
                  const shouldShow = shift && (
                    (shift.type === 'scheduled' && selectedFilters.scheduled) ||
                    (shift.type === 'on_call' && selectedFilters.onCall) ||
                    (shift.type === 'time_off' && selectedFilters.timeOff)
                  );
                  
                  return (
                    <div key={i} className="p-2 border-l border-gray-200 dark:border-slate-700 min-h-[80px]">
                      {shouldShow && (
                        <div className={`p-2 rounded text-sm border ${getShiftTypeColor(shift.type)}`}>
                          <div className="font-medium">{getShiftTypeLabel(shift.type)}</div>
                          {shift.type !== 'time_off' && shift.startTime && shift.endTime && (
                            <div className="text-xs mt-1">{shift.startTime} - {shift.endTime}</div>
                          )}
                          {shift.title && (
                            <div className="text-xs mt-1 truncate">{shift.title}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Shift Modal */}
      <CreateShiftModal
        isOpen={showCreateShift}
        onClose={() => setShowCreateShift(false)}
        onSave={handleSaveShift}
        staff={staff}
        selectedDate={currentDate}
      />

      <BulkDeleteModal
        isOpen={showBulkDelete}
        onClose={() => setShowBulkDelete(false)}
        onDelete={handleBulkDelete}
        staff={staff}
      />

      {showCalendar && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowCalendar(false)}
        />
      )}
    </div>
  );
};

export default Schedule;