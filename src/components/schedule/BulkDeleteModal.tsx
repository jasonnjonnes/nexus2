import React, { useState } from 'react';
import { X, Users, User } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { StaffMember, ShiftDeletionData } from '../../types/schedule';

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: (deleteData: ShiftDeletionData) => void;
  staff: StaffMember[];
}

const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({ isOpen, onClose, onDelete, staff }) => {
  const [deleteData, setDeleteData] = useState<ShiftDeletionData>({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    selectedStaff: [],
    selectedDays: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false
    },
    shiftTypes: {
      scheduled: true,
      on_call: true,
      time_off: true
    }
  });

  const handleStaffSelection = (staffId: string) => {
    setDeleteData(prev => ({
      ...prev,
      selectedStaff: prev.selectedStaff.includes(staffId)
        ? prev.selectedStaff.filter(id => id !== staffId)
        : [...prev.selectedStaff, staffId]
    }));
  };

  const handleDayToggle = (day: string) => {
    setDeleteData(prev => ({
      ...prev,
      selectedDays: {
        ...prev.selectedDays,
        [day]: !prev.selectedDays[day as keyof typeof prev.selectedDays]
      }
    }));
  };

  const handleShiftTypeToggle = (type: string) => {
    setDeleteData(prev => ({
      ...prev,
      shiftTypes: {
        ...prev.shiftTypes,
        [type]: !prev.shiftTypes[type as keyof typeof prev.shiftTypes]
      }
    }));
  };

  const handleSelectAllStaff = () => {
    const allSelected = deleteData.selectedStaff.length === staff.length;
    setDeleteData(prev => ({
      ...prev,
      selectedStaff: allSelected ? [] : staff.map(s => s.id)
    }));
  };

  const handleSelectAllDays = () => {
    const allSelected = Object.values(deleteData.selectedDays).every(Boolean);
    setDeleteData(prev => ({
      ...prev,
      selectedDays: {
        monday: !allSelected,
        tuesday: !allSelected,
        wednesday: !allSelected,
        thursday: !allSelected,
        friday: !allSelected,
        saturday: !allSelected,
        sunday: !allSelected
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (deleteData.selectedStaff.length === 0) {
      alert('Please select at least one staff member');
      return;
    }

    const selectedDaysCount = Object.values(deleteData.selectedDays).filter(Boolean).length;
    if (selectedDaysCount === 0) {
      alert('Please select at least one day of the week');
      return;
    }

    const selectedTypesCount = Object.values(deleteData.shiftTypes).filter(Boolean).length;
    if (selectedTypesCount === 0) {
      alert('Please select at least one shift type');
      return;
    }

    onDelete(deleteData);
    onClose();
  };

  if (!isOpen) return null;

  const technicians = staff.filter(member => member.staffType === 'technician');
  const officeStaff = staff.filter(member => member.staffType === 'office');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
              Bulk Delete Shifts
            </h3>
            <button type="button" onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Date Range */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Date Range</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={deleteData.startDate}
                    onChange={(e) => setDeleteData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={deleteData.endDate}
                    onChange={(e) => setDeleteData(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Days of Week */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Days of Week</h4>
                <button
                  type="button"
                  onClick={handleSelectAllDays}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  {Object.values(deleteData.selectedDays).every(Boolean) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {[
                  { key: 'monday', label: 'Mon' },
                  { key: 'tuesday', label: 'Tue' },
                  { key: 'wednesday', label: 'Wed' },
                  { key: 'thursday', label: 'Thu' },
                  { key: 'friday', label: 'Fri' },
                  { key: 'saturday', label: 'Sat' },
                  { key: 'sunday', label: 'Sun' }
                ].map(day => (
                  <label key={day.key} className="flex flex-col items-center p-2 border border-gray-200 dark:border-slate-700 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                    <input
                      type="checkbox"
                      checked={deleteData.selectedDays[day.key as keyof typeof deleteData.selectedDays]}
                      onChange={() => handleDayToggle(day.key)}
                      className="mb-1"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Shift Types */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Shift Types</h4>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={deleteData.shiftTypes.scheduled}
                    onChange={() => handleShiftTypeToggle('scheduled')}
                    className="mr-2"
                  />
                  <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Scheduled Shifts</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={deleteData.shiftTypes.on_call}
                    onChange={() => handleShiftTypeToggle('on_call')}
                    className="mr-2"
                  />
                  <div className="w-3 h-3 bg-yellow-500 rounded mr-2"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">On Call Shifts</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={deleteData.shiftTypes.time_off}
                    onChange={() => handleShiftTypeToggle('time_off')}
                    className="mr-2"
                  />
                  <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Time Off</span>
                </label>
              </div>
            </div>

            {/* Staff Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Staff Members</h4>
                <button
                  type="button"
                  onClick={handleSelectAllStaff}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  {deleteData.selectedStaff.length === staff.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              {/* Technicians */}
              {technicians.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                    <Users size={14} className="mr-1" />
                    Technicians
                  </h5>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {technicians.map(member => (
                      <label key={member.id} className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={deleteData.selectedStaff.includes(member.id)}
                          onChange={() => handleStaffSelection(member.id)}
                          className="mr-3"
                        />
                        <div className="flex items-center">
                          {member.profilePicture ? (
                            <img 
                              src={member.profilePicture} 
                              alt={member.fullName} 
                              className="h-6 w-6 rounded-full object-cover mr-2"
                            />
                          ) : (
                            <div 
                              className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs mr-2"
                              style={{ backgroundColor: member.color || '#3B82F6' }}
                            >
                              {member.firstName?.[0]}{member.lastName?.[0]}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{member.fullName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{member.role} • {member.businessUnit || 'Unassigned'}</div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Office Staff */}
              {officeStaff.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                    <User size={14} className="mr-1" />
                    Office Staff
                  </h5>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {officeStaff.map(member => (
                      <label key={member.id} className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={deleteData.selectedStaff.includes(member.id)}
                          onChange={() => handleStaffSelection(member.id)}
                          className="mr-3"
                        />
                        <div className="flex items-center">
                          {member.profilePicture ? (
                            <img 
                              src={member.profilePicture} 
                              alt={member.fullName} 
                              className="h-6 w-6 rounded-full object-cover mr-2"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs mr-2">
                              {member.firstName?.[0]}{member.lastName?.[0]}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{member.fullName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{member.role}</div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Delete Shifts
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkDeleteModal; 