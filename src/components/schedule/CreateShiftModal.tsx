import React, { useState } from 'react';
import { X, Users, User } from 'lucide-react';
import { format } from 'date-fns';
import { StaffMember, ShiftCreationData } from '../../types/schedule';

interface CreateShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shiftData: ShiftCreationData) => void;
  staff: StaffMember[];
  selectedDate: Date;
}

const CreateShiftModal: React.FC<CreateShiftModalProps> = ({ isOpen, onClose, onSave, staff, selectedDate }) => {
  const [shiftType, setShiftType] = useState('shift'); // shift, timeoff
  const [formData, setFormData] = useState({
    title: '',
    startDate: format(selectedDate, 'yyyy-MM-dd'),
    endDate: format(selectedDate, 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '17:00',
    isOnCall: false,
    isOvernight: false,
    repeats: 'never',
    businessUnit: '',
    selectedStaff: [] as string[],
    notes: '',
    type: 'scheduled', // scheduled, on_call, time_off
    selectedDays: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleStaffSelection = (staffId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedStaff: prev.selectedStaff.includes(staffId)
        ? prev.selectedStaff.filter(id => id !== staffId)
        : [...prev.selectedStaff, staffId]
    }));
  };

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      selectedDays: {
        ...prev.selectedDays,
        [day]: !prev.selectedDays[day as keyof typeof prev.selectedDays]
      }
    }));
  };

  const handleSelectAllDays = () => {
    const allSelected = Object.values(formData.selectedDays).every(Boolean);
    setFormData(prev => ({
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
    
    if (formData.selectedStaff.length === 0) {
      alert('Please select at least one staff member');
      return;
    }

    let type: 'scheduled' | 'on_call' | 'time_off' = 'scheduled';
    if (shiftType === 'timeoff') {
      type = 'time_off';
    } else if (formData.isOnCall) {
      type = 'on_call';
    }

    const shiftData: ShiftCreationData = {
      ...formData,
      type
    };

    onSave(shiftData);
    onClose();
    
    setFormData({
      title: '',
      startDate: format(selectedDate, 'yyyy-MM-dd'),
      endDate: format(selectedDate, 'yyyy-MM-dd'),
      startTime: '09:00',
      endTime: '17:00',
      isOnCall: false,
      isOvernight: false,
      repeats: 'never',
      businessUnit: '',
      selectedStaff: [],
      notes: '',
      type: 'scheduled',
      selectedDays: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false
      }
    });
  };

  if (!isOpen) return null;

  const technicians = staff.filter(member => member.staffType === 'technician');
  const officeStaff = staff.filter(member => member.staffType === 'office');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-end z-50">
      <div className="w-[500px] bg-white dark:bg-slate-800 h-screen overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex space-x-4">
              <button 
                type="button"
                onClick={() => setShiftType('shift')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  shiftType === 'shift' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200'
                }`}
              >
                SHIFT
              </button>
              <button 
                type="button"
                onClick={() => setShiftType('timeoff')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  shiftType === 'timeoff' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200'
                }`}
              >
                TIME OFF
              </button>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6 text-gray-800 dark:text-gray-200">
            {shiftType === 'shift' && (
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    name="isOnCall"
                    checked={formData.isOnCall}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700" 
                  />
                  <span className="text-sm">ON CALL</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    name="isOvernight"
                    checked={formData.isOvernight}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700" 
                  />
                  <span className="text-sm">OVERNIGHT SHIFT</span>
                </label>
              </div>
            )}

            <div>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder={shiftType === 'timeoff' ? "Time off reason (vacation, sick, etc.)" : "Add a title"}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  START DATE
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  END DATE
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                />
              </div>
            </div>

            {shiftType === 'shift' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                  />
                </div>
              </div>
            )}

            {/* Days of Week Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Days of Week
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllDays}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  {Object.values(formData.selectedDays).every(Boolean) ? 'Deselect All' : 'Select All'}
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
                      checked={formData.selectedDays[day.key as keyof typeof formData.selectedDays]}
                      onChange={() => handleDayToggle(day.key)}
                      className="mb-1"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                REPEATS
              </label>
              <select 
                name="repeats"
                value={formData.repeats}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
              >
                <option value="never">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Business Units
              </label>
              <select 
                name="businessUnit"
                value={formData.businessUnit}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
              >
                <option value="">All Business Units</option>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Staff Members
              </label>
              
              {/* Technicians */}
              {technicians.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                    <Users size={16} className="mr-2" />
                    Technicians
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {technicians.map(member => (
                      <label key={member.id} className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.selectedStaff.includes(member.id)}
                          onChange={() => handleStaffSelection(member.id)}
                          className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 mr-3"
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
                            <div className="text-sm font-medium">{member.fullName}</div>
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
                  <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                    <User size={16} className="mr-2" />
                    Office Staff
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {officeStaff.map(member => (
                      <label key={member.id} className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.selectedStaff.includes(member.id)}
                          onChange={() => handleStaffSelection(member.id)}
                          className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 mr-3"
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
                            <div className="text-sm font-medium">{member.fullName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{member.role}</div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Add a note"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg h-24 bg-white dark:bg-slate-700"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button 
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add to schedule
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateShiftModal;