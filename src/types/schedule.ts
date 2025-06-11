export interface StaffMember {
  id: string;
  staffType: 'technician' | 'office';
  profilePicture?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  color?: string;
  role?: string;
  businessUnit?: string;
  status?: string;
  userId?: string;
}

export interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  staffType: 'technician' | 'office';
  title: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  type: 'scheduled' | 'on_call' | 'time_off';
  isOnCall: boolean;
  isOvernight: boolean;
  businessUnit: string;
  notes: string;
  repeats: string;
  userId: string;
  createdAt: string;
}

export interface ShiftCreationData {
  title: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  isOnCall: boolean;
  isOvernight: boolean;
  repeats: string;
  businessUnit: string;
  selectedStaff: string[];
  notes: string;
  type: 'scheduled' | 'on_call' | 'time_off';
  selectedDays: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
}

export interface ShiftDeletionData {
  startDate: string;
  endDate: string;
  selectedStaff: string[];
  selectedDays: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  shiftTypes: {
    scheduled: boolean;
    on_call: boolean;
    time_off: boolean;
  };
} 