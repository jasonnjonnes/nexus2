import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Menu,
  Plus,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  AlertTriangle,
  RefreshCw,
  User,
  X,
  Edit,
  FileText,
  Briefcase,
  Calendar,
  Save,
  Trash2,
  MessageSquare,
  CheckCircle,
  Users
} from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { createPortal } from 'react-dom';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, onSnapshot, query, where, updateDoc, doc, addDoc
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// --- CONSTANTS & HELPERS ---
const PIXELS_PER_HOUR = 160;
const TOTAL_TIMELINE_WIDTH = PIXELS_PER_HOUR * 24;
const JOB_CARD_HEIGHT = 64;
const JOB_CARD_TOP_OFFSET = 4;

const timeToMinutes = (timeStr) => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const getJobStackingLevels = (jobsForTechnician) => {
  const sortedJobs = [...jobsForTechnician].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const levels = [];
  sortedJobs.forEach(job => {
    let placed = false;
    for (const level of levels) {
      const lastJobInLevel = level[level.length - 1];
      if (timeToMinutes(job.startTime) >= timeToMinutes(lastJobInLevel.endTime)) {
        level.push(job);
        placed = true;
        break;
      }
    }
    if (!placed) levels.push([job]);
  });
  const jobLevels = new Map();
  levels.forEach((levelJobs, levelIndex) => {
    levelJobs.forEach(job => jobLevels.set(job.id, levelIndex));
  });
  return { jobLevels, totalLevels: levels.length };
};

// Helper function to format current date for comparison
const formatDateForComparison = (date) => {
  return format(date, 'yyyy-MM-dd');
};

// Helper function to parse time string to 24-hour format
const parseTimeString = (timeStr) => {
  if (!timeStr) return null;
  
  const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i;
  const match = timeStr.match(timeRegex);
  
  if (!match) return null;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3]?.toUpperCase();
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return hours * 60 + minutes; // Return total minutes
};

// Helper to calculate duration between two times
const calculateDuration = (startTime, endTime) => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const totalMinutes = endMinutes - startMinutes;
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return { hours, minutes, totalMinutes };
};

// Helper to apply duration to start time
const applyDuration = (startTime, hours, minutes) => {
  const startMinutes = timeToMinutes(startTime);
  const totalMinutes = startMinutes + (hours * 60) + minutes;
  return minutesToTime(totalMinutes);
};
// Generate job number helper
const generateJobNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `JOB-${timestamp}-${random}`;
};

// --- CALENDAR PICKER COMPONENT ---
const CalendarPicker = ({ isOpen, onClose, selectedDate, onDateSelect }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
  const calendarRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();
  
  const days = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }

  const handleDateClick = (date) => {
    onDateSelect(date);
    onClose();
  };

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  return (
    <div ref={calendarRef} className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg z-50 p-4 w-80">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
        >
          <ChevronLeft size={16} className="text-gray-600 dark:text-gray-300" />
        </button>
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <button
          onClick={() => navigateMonth(1)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
        >
          <ChevronRight size={16} className="text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          if (!date) {
            return <div key={index} className="h-8" />;
          }

          const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
          const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

          return (
            <button
              key={index}
              onClick={() => handleDateClick(date)}
              className={`h-8 w-8 text-sm rounded transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : isToday
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                  : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Today button */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
        <button
          onClick={() => handleDateClick(today)}
          className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Today
        </button>
      </div>
    </div>
  );
};

// --- ENHANCED JOB DETAILS MODAL WITH EDITING ---
const JobDetailsModal = ({ job, isOpen, onClose, onSave, technicians }) => {
  const modalRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedJob, setEditedJob] = useState(job || {});
  const [newNote, setNewNote] = useState('');
  const [selectedTechnicians, setSelectedTechnicians] = useState([]);

  useEffect(() => {
    if (job) {
      setEditedJob(job);
      // Initialize selected technicians from appointments or single technician
      if (job.appointments && job.appointments.length > 0) {
        const currentTechs = job.appointments.map(apt => apt.technician);
        setSelectedTechnicians(currentTechs);
      } else if (job.technician) {
        setSelectedTechnicians([job.technician]);
      } else {
        setSelectedTechnicians([]);
      }
    } else {
      setEditedJob({});
      setSelectedTechnicians([]);
    }
  }, [job]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !job) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Emergency': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'High': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Normal': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedJob(prev => ({ ...prev, [name]: value }));
  };

  const handleTechnicianAdd = (technicianName) => {
    if (!selectedTechnicians.includes(technicianName)) {
      setSelectedTechnicians(prev => [...prev, technicianName]);
    }
  };

  const handleTechnicianRemove = (technicianName) => {
    setSelectedTechnicians(prev => prev.filter(tech => tech !== technicianName));
  };

  const handleSave = async () => {
    try {
      // Create appointments array from selected technicians
      const appointments = selectedTechnicians.map((techName, index) => ({
        id: `${(editedJob.jobNumber || job.jobNumber)}-${index + 1}`,
        technician: techName,
        status: 'Scheduled',
        startDate: editedJob.startDate || job.startDate,
        startTime: editedJob.startTime || job.startTime,
        endTime: editedJob.endTime || job.endTime || '17:00'
      }));

      const updatedJob = {
        ...editedJob,
        technician: selectedTechnicians[0] || '', // Keep primary technician for backward compatibility
        appointments
      };

      // Use originalId if available (for multi-tech jobs), otherwise use regular id
      const jobId = job.originalId || job.id;
      await onSave({ ...updatedJob, id: jobId });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving job:', error);
    }
  };

  const handleCancel = () => {
    setEditedJob(job);
    if (job.appointments && job.appointments.length > 0) {
      setSelectedTechnicians(job.appointments.map(apt => apt.technician));
    } else if (job.technician) {
      setSelectedTechnicians([job.technician]);
    } else {
      setSelectedTechnicians([]);
    }
    setIsEditing(false);
  };

  const addNote = async () => {
    if (newNote.trim()) {
      const note = {
        id: `note_${Date.now()}`,
        text: newNote.trim(),
        author: 'Current User',
        timestamp: new Date().toISOString()
      };
      
      const updatedNotes = [...((editedJob && editedJob.notes) || []), note];
      const updatedJob = { ...editedJob, notes: updatedNotes };
      
      await onSave(updatedJob);
      setEditedJob(updatedJob);
      setNewNote('');
    }
  };

  const deleteNote = async (noteId) => {
    const updatedNotes = ((editedJob && editedJob.notes) || []).filter(note => note.id !== noteId);
    const updatedJob = { ...editedJob, notes: updatedNotes };
    
    await onSave(updatedJob);
    setEditedJob(updatedJob);
  };

  const availableTechnicians = technicians.filter(tech => 
    !selectedTechnicians.includes(tech.name)
  );

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div 
        ref={modalRef}
        className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{job.jobNumber}</h2>
            <p className="text-gray-600 dark:text-gray-400">{job.title}</p>
          </div>
          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <Edit size={16} className="mr-2" />
                Edit Job
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
                >
                  <Save size={16} className="mr-2" />
                  Save
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <X size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status and Priority */}
          <div className="flex items-center space-x-4">
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
              {isEditing ? (
                <select
                  name="status"
                  value={(editedJob && editedJob.status) || ''}
                  onChange={handleInputChange}
                  className="ml-2 border border-gray-300 dark:border-slate-600 rounded-md px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              ) : (
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                  {job.status ? job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ') : 'Unknown'}
                </span>
              )}
            </div>
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Priority:</span>
              {isEditing ? (
                <select
                  name="priority"
                  value={(editedJob && editedJob.priority) || ''}
                  onChange={handleInputChange}
                  className="ml-2 border border-gray-300 dark:border-slate-600 rounded-md px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Emergency">Emergency</option>
                </select>
              ) : (
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(job.priority)}`}>
                  {job.priority || 'Normal'}
                </span>
              )}
            </div>
          </div>

          {/* Job Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-3 flex items-center">
                <Briefcase size={18} className="mr-2" />
                Job Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Job Type:</span>
                  {isEditing ? (
                    <input
                      type="text"
                      name="type"
                      value={(editedJob && editedJob.type) || ''}
                      onChange={handleInputChange}
                      className="border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    />
                  ) : (
                    <span className="text-gray-800 dark:text-gray-200">{job.type || 'N/A'}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Start Date:</span>
                  {isEditing ? (
                    <input
                      type="date"
                      name="startDate"
                      value={(editedJob && editedJob.startDate) || ''}
                      onChange={handleInputChange}
                      className="border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    />
                  ) : (
                    <span className="text-gray-800 dark:text-gray-200">{job.startDate || 'N/A'}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Start Time:</span>
                  {isEditing ? (
                    <input
                      type="time"
                      name="startTime"
                      value={(editedJob && editedJob.startTime) || ''}
                      onChange={(e) => {
                        const newStartTime = e.target.value;
                        const currentDuration = editedJob?.endTime ? 
                          calculateDuration(editedJob.startTime || job.startTime, editedJob.endTime) : 
                          { hours: 1, minutes: 0 };
                        const newEndTime = applyDuration(newStartTime, currentDuration.hours, currentDuration.minutes);
                        setEditedJob(prev => ({ ...prev, startTime: newStartTime, endTime: newEndTime }));
                      }}
                      className="border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                    />
                  ) : (
                    <span className="text-gray-800 dark:text-gray-200">{job.startTime || 'N/A'}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                  {isEditing ? (
                    <div className="flex space-x-1">
                      <select
                        name="durationHours"
                        value={(() => {
                          if (editedJob?.startTime && editedJob?.endTime) {
                            const duration = calculateDuration(editedJob.startTime, editedJob.endTime);
                            return duration.hours;
                          }
                          return 1;
                        })()}
                        onChange={(e) => {
                          const hours = parseInt(e.target.value);
                          const minutes = (() => {
                            if (editedJob?.startTime && editedJob?.endTime) {
                              const duration = calculateDuration(editedJob.startTime, editedJob.endTime);
                              return duration.minutes;
                            }
                            return 0;
                          })();
                          const newEndTime = applyDuration(editedJob?.startTime || job?.startTime || '09:00', hours, minutes);
                          setEditedJob(prev => ({ ...prev, endTime: newEndTime }));
                        }}
                        className="border border-gray-300 dark:border-slate-600 rounded px-1 py-1 text-xs bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 w-12"
                      >
                        {Array.from({length: 24}, (_, i) => i + 1).map(hour => (
                          <option key={hour} value={hour}>{hour}h</option>
                        ))}
                      </select>
                      <select
                        name="durationMinutes"
                        value={(() => {
                          if (editedJob?.startTime && editedJob?.endTime) {
                            const duration = calculateDuration(editedJob.startTime, editedJob.endTime);
                            return duration.minutes;
                          }
                          return 0;
                        })()}
                        onChange={(e) => {
                          const minutes = parseInt(e.target.value);
                          const hours = (() => {
                            if (editedJob?.startTime && editedJob?.endTime) {
                              const duration = calculateDuration(editedJob.startTime, editedJob.endTime);
                              return duration.hours;
                            }
                            return 1;
                          })();
                          const newEndTime = applyDuration(editedJob?.startTime || job?.startTime || '09:00', hours, minutes);
                          setEditedJob(prev => ({ ...prev, endTime: newEndTime }));
                        }}
                        className="border border-gray-300 dark:border-slate-600 rounded px-1 py-1 text-xs bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 w-12"
                      >
                        <option value={0}>0m</option>
                        <option value={15}>15m</option>
                        <option value={30}>30m</option>
                        <option value={45}>45m</option>
                      </select>
                    </div>
                  ) : (
                    <span className="text-gray-800 dark:text-gray-200">
                      {(() => {
                        if (job.startTime && job.endTime) {
                          const duration = calculateDuration(job.startTime, job.endTime);
                          return `${duration.hours}h ${duration.minutes}m`;
                        }
                        return 'N/A';
                      })()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-3 flex items-center">
                <User size={18} className="mr-2" />
                Customer & Location
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Customer:</span>
                  <span className="text-gray-800 dark:text-gray-200">{job.title || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                  <span className="text-gray-800 dark:text-gray-200">{job.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Address:</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-1">{job.address || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Multiple Technician Assignment */}
          <div>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center">
              <Users size={18} className="mr-2" />
              Assigned Technicians
            </h3>
            
            {isEditing && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Add Technician
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleTechnicianAdd(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="block w-full border border-gray-300 dark:border-slate-600 rounded-md px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select a technician to add...</option>
                  {availableTechnicians.map(tech => (
                    <option key={tech.id} value={tech.name}>{tech.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Selected Technicians */}
            <div className="space-y-2">
              {selectedTechnicians.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No technicians assigned</p>
              ) : (
                selectedTechnicians.map(techName => {
                  const tech = technicians.find(t => t.name === techName);
                  return (
                    <div key={techName} className="flex items-center justify-between p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                      <div className="flex items-center">
                        <div 
                          className="w-4 h-4 rounded-full mr-3"
                          style={{ backgroundColor: tech?.color || '#3B82F6' }}
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {techName}
                          </span>
                          {tech && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {tech.role} {tech.businessUnit && `• ${tech.businessUnit}`}
                            </p>
                          )}
                        </div>
                      </div>
                      {isEditing && (
                        <button
                          onClick={() => handleTechnicianRemove(techName)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Description */}
          {((job.notes) || isEditing) && (
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-3 flex items-center">
                <FileText size={18} className="mr-2" />
                Job Description
              </h3>
              {isEditing ? (
                <textarea
                  name="notes"
                  value={(editedJob && editedJob.notes) || ''}
                  onChange={handleInputChange}
                  placeholder="Enter job description..."
                  className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 min-h-[100px]"
                />
              ) : (
                <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                  <p className="text-gray-800 dark:text-gray-200">{job.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Notes Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 flex items-center">
              <MessageSquare size={18} className="mr-2" />
              Job Notes
            </h3>
            
            {/* Add Note */}
            <div className="mb-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  className="flex-1 border border-gray-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  onKeyPress={(e) => e.key === 'Enter' && addNote()}
                />
                <button
                  onClick={addNote}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Notes List */}
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {((editedJob && editedJob.notes && Array.isArray(editedJob.notes)) ? editedJob.notes : []).map(note => (
                <div key={note.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 dark:text-gray-100">{note.text}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {note.author} • {new Date(note.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 ml-2"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {(!(editedJob && editedJob.notes && Array.isArray(editedJob.notes)) || editedJob.notes.length === 0) && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No notes yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- NEW JOB PANEL ---
const NewJobPanel = ({ isOpen, onClose, customers, technicians, onJobCreated, db, userId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [jobForm, setJobForm] = useState({
    jobType: '',
    businessUnit: '',
    priority: 'Normal',
    startDate: '',
    startTime: '',
    technician: '',
    summary: '',
    sendConfirmation: true
  });
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Filter customers based on search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCustomers([]);
      return;
    }

    const filtered = customers.filter(customer => 
      customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm)
    );
    
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  const handleJobFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setJobForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setSearchTerm(customer.name);
    setFilteredCustomers([]);
  };

  const handleBookJob = async () => {
    if (!selectedCustomer || !db || !userId) {
      alert('Please select a customer first');
      return;
    }

    if (!jobForm.jobType || !jobForm.startDate) {
      alert('Please fill in required fields (Job Type and Start Date)');
      return;
    }

    try {
      const jobNumber = generateJobNumber();
      const jobData = {
        jobNumber,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        title: selectedCustomer.name,
        address: selectedCustomer.address || 'No address provided',
        phone: selectedCustomer.phone || 'No phone provided',
        type: jobForm.jobType,
        priority: jobForm.priority,
        status: 'scheduled',
        startDate: jobForm.startDate,
        startTime: jobForm.startTime || '09:00',
        endTime: jobForm.startTime ? 
          minutesToTime(timeToMinutes(jobForm.startTime) + 60) : 
          '10:00',
        technician: jobForm.technician,
        technicianId: technicians.find(t => t.name === jobForm.technician)?.id,
        notes: jobForm.summary,
        createdAt: new Date().toISOString(),
        userId: userId
      };

      await addDoc(collection(db, 'jobs'), jobData);
      
      // Reset form and close panel
      setJobForm({
        jobType: '',
        businessUnit: '',
        priority: 'Normal',
        startDate: '',
        startTime: '',
        technician: '',
        summary: '',
        sendConfirmation: true
      });
      setSelectedCustomer(null);
      setSearchTerm('');
      onJobCreated();
      onClose();
      
    } catch (error) {
      console.error('Error creating job:', error);
      alert('Failed to create job. Please try again.');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div ref={panelRef} className="w-full max-w-2xl bg-white dark:bg-slate-800 h-full shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-6 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">New Job</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <X size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Search */}
          <div>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Search for Customer</h3>
            <div className="relative mb-4">
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by customer name, email, or phone..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200" 
              />
              
              {/* Search Results Dropdown */}
              {filteredCustomers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredCustomers.map(customer => (
                    <div
                      key={customer.id}
                      onClick={() => handleCustomerSelect(customer)}
                      className="p-3 hover:bg-gray-50 dark:hover:bg-slate-600 cursor-pointer border-b border-gray-100 dark:border-slate-600 last:border-b-0"
                    >
                      <div className="flex items-center">
                        <User size={16} className="text-gray-400 mr-2" />
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-200">{customer.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {customer.email} • {customer.phone}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Customer Display */}
            {selectedCustomer && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <User size={16} className="text-blue-600 dark:text-blue-400 mr-2" />
                    <div>
                      <div className="font-medium text-blue-800 dark:text-blue-200">{selectedCustomer.name}</div>
                      <div className="text-sm text-blue-600 dark:text-blue-400">
                        {selectedCustomer.email} • {selectedCustomer.phone}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCustomer(null);
                      setSearchTerm('');
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Job Details Form */}
          <div>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Job Details</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Job Type *</label>
                <select 
                  name="jobType"
                  value={jobForm.jobType}
                  onChange={handleJobFormChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                >
                  <option value="">Select job type...</option>
                  <option value="Installation">Installation</option>
                  <option value="Repair">Repair</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Service Call">Service Call</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Priority</label>
                <select 
                  name="priority"
                  value={jobForm.priority}
                  onChange={handleJobFormChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Start Date *</label>
                <input 
                  type="date"
                  name="startDate"
                  value={jobForm.startDate}
                  onChange={handleJobFormChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200" 
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Start Time</label>
                <input 
                  type="time"
                  name="startTime"
                  value={jobForm.startTime}
                  onChange={handleJobFormChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200" 
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Technician</label>
              <select 
                name="technician"
                value={jobForm.technician}
                onChange={handleJobFormChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              >
                <option value="">Select technician...</option>
                {technicians.map(tech => (
                  <option key={tech.id} value={tech.name}>
                    {tech.name} ({tech.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Summary</label>
              <textarea 
                name="summary"
                value={jobForm.summary}
                onChange={handleJobFormChange}
                placeholder="Enter job description or notes..."
                className="w-full p-3 min-h-[100px] border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200" 
              />
            </div>

            <div className="flex items-center mb-4">
              <label className="flex items-center text-gray-700 dark:text-gray-300">
                <input 
                  type="checkbox" 
                  name="sendConfirmation"
                  checked={jobForm.sendConfirmation}
                  onChange={handleJobFormChange}
                  className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 mr-2" 
                />
                Send booking confirmation
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-6">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200"
            >
              Cancel
            </button>
            <button 
              onClick={handleBookJob}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Book Job
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- SHIFT WARNING MODAL ---
const ShiftWarningModal = ({ isOpen, onConfirm, onCancel, technicianName }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <AlertTriangle size={24} className="text-yellow-600 mr-3" />
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">No Scheduled Shift</h3>
        </div>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          <strong>{technicianName}</strong> does not have a scheduled shift for this time period. 
          Are you sure you want to assign this job?
        </p>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
          >
            Assign Anyway
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- JOB CARD COMPONENT ---
const JobCard = ({ job, onDragStart, isDragging, level, technicianColor, onClick }) => {
  const jobCardRef = useRef(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0, visible: false });

  const getJobStyle = () => {
    const startMinutes = timeToMinutes(job.startTime);
    const endMinutes = timeToMinutes(job.endTime);
    const durationMinutes = endMinutes - startMinutes;
    
    const left = (startMinutes / 60) * PIXELS_PER_HOUR;
    const width = (durationMinutes / 60) * PIXELS_PER_HOUR;
    const top = JOB_CARD_TOP_OFFSET + (level * JOB_CARD_HEIGHT);
    
    return { left: `${left}px`, width: `${width}px`, top: `${top}px` };
  };
  
  const handleMouseEnter = () => { 
    if (jobCardRef.current && !isDragging) { 
      const rect = jobCardRef.current.getBoundingClientRect(); 
      setPopoverPosition({ top: rect.top - 10, left: rect.left, visible: true }); 
    }
  };
  const handleMouseLeave = () => setPopoverPosition(p => ({ ...p, visible: false }));

  return (
    <div ref={jobCardRef} className={`absolute h-[56px] transition-transform duration-200 ease-out ${isDragging ? 'z-50' : 'z-20'}`} style={getJobStyle()} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div 
        className={`relative h-full border rounded-md shadow-sm overflow-hidden flex cursor-move job-card transition-all duration-200 ease-out ${isDragging ? 'scale-105 shadow-xl opacity-50' : 'hover:shadow-md'}`} 
        style={{ 
          backgroundColor: technicianColor || '#3B82F6',
          borderColor: technicianColor || '#3B82F6',
          color: 'white'
        }}
        onMouseDown={(e) => {
          onDragStart(e, job, 'move');
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(job);
        }}
      >
        <div className="absolute top-0 left-0 bottom-0 w-2 cursor-ew-resize z-30" onMouseDown={(e) => { 
          e.stopPropagation(); 
          onDragStart(e, job, 'resize-left'); 
        }}/>
        <div className="px-2 py-1 h-full flex flex-col justify-center w-full pointer-events-none">
          <div className="text-xs font-semibold truncate">{job.title}</div>
          <div className="text-xs opacity-80">{job.startTime} - {job.endTime}</div>
          {job.isMultiTech && (
            <div className="text-xs opacity-60">Multi-tech</div>
          )}
        </div>
        <div className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize z-30" onMouseDown={(e) => { 
          e.stopPropagation(); 
          onDragStart(e, job, 'resize-right'); 
        }}/>
      </div>
      {popoverPosition.visible && createPortal(<div className="fixed w-72 p-4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-2xl z-50 pointer-events-none transition-opacity duration-300" style={{ top: popoverPosition.top, left: popoverPosition.left, transform: 'translateY(-100%)' }}><h4 className="font-bold text-gray-800 dark:text-gray-100">{job.type}</h4><p className="text-sm text-gray-600 dark:text-gray-300">{job.title}</p><p className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-2"><MapPin size={14} className="mr-2 shrink-0"/>{job.address}</p><p className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1"><Phone size={14} className="mr-2 shrink-0"/>{job.phone}</p><div className="border-t border-gray-200 dark:border-slate-700 mt-3 pt-3"><p className="text-xs text-gray-500 dark:text-gray-400 italic">{job.notes}</p></div></div>, document.body)}
    </div>
  );
};

// --- MAIN DISPATCH COMPONENT ---
const Dispatch = () => {
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showTechList, setShowTechList] = useState(false);
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [dragState, setDragState] = useState(null);
  const [showShiftWarning, setShowShiftWarning] = useState(false);
  const [pendingJobAssignment, setPendingJobAssignment] = useState(null);
  const [activeJobTab, setActiveJobTab] = useState('unassigned');
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  
  // New state for added features
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [showNewJobPanel, setShowNewJobPanel] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // Refs for timeline and technician rows
  const timelineContainerRef = useRef(null);
  const technicianRowsRef = useRef(new Map());

  // Date navigation functions
  const goToPreviousDay = () => {
    setCurrentDate(prevDate => subDays(prevDate, 1));
  };

  const goToNextDay = () => {
    setCurrentDate(prevDate => addDays(prevDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Initialize Firebase
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        if (typeof __firebase_config === 'undefined' || !__firebase_config) {
          setError("Firebase configuration is missing");
          setIsLoading(false);
          return;
        }
        
        let firebaseConfig;
        if (typeof __firebase_config === 'string') {
          firebaseConfig = JSON.parse(__firebase_config);
        } else {
          firebaseConfig = __firebase_config;
        }

        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const auth = getAuth(app);
        
        setDb(firestore);
        
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setUserId(user.uid);
            setIsLoading(false);
          } else {
            try {
              const userCredential = await signInAnonymously(auth);
              setUserId(userCredential.user.uid);
              setIsLoading(false);
            } catch (authError) {
              setError("Authentication failed");
              setIsLoading(false);
            }
          }
        });
        
        return () => unsubscribeAuth();
      } catch (e) {
        console.error("Error initializing Firebase:", e);
        setError("Firebase initialization failed");
        setIsLoading(false);
      }
    };

    initializeFirebase();
  }, []);

  // Force refresh function
  const handleRefresh = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    setIsRefreshing(true);
    setDataVersion(prev => prev + 1);
    
    setTechnicians([]);
    setSchedules([]);
    setJobs([]);
    
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  }, []);

  // Load active technicians from Firebase
  useEffect(() => {
    if (!db || !userId) return;

    console.log('🔄 Loading technicians... (version:', dataVersion, ')');

    const techQuery = query(
      collection(db, 'staff'),
      where("userId", "==", userId),
      where("staffType", "==", "technician"),
      where("status", "==", "active")
    );
    
    const unsubscribe = onSnapshot(techQuery, (querySnapshot) => {
      console.log('👥 Technicians snapshot received, docs:', querySnapshot.size);
      const techData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const techInfo = {
          id: doc.id,
          name: data.fullName || `${data.firstName} ${data.lastName}`,
          status: 'available',
          clockStatus: 'On-clock for 8h 0m',
          role: data.role,
          businessUnit: data.businessUnit,
          profilePicture: data.profilePicture,
          color: data.color || '#3B82F6'
        };
        console.log('👤 Technician loaded:', techInfo);
        techData.push(techInfo);
      });
      
      console.log('✅ All technicians loaded:', techData);
      setTechnicians(techData);
      setSelectedTechs(techData.map(tech => tech.id));
    }, (error) => {
      console.error("❌ Error loading technicians:", error);
    });
    
    return () => unsubscribe();
  }, [db, userId, dataVersion]);

  // Load customers from Firebase
  useEffect(() => {
    if (!db || !userId) return;

    const customersQuery = query(
      collection(db, 'customers'),
      where("userId", "==", userId)
    );
    
    const unsubscribe = onSnapshot(customersQuery, (querySnapshot) => {
      const customersData = [];
      querySnapshot.forEach((doc) => {
        customersData.push({ id: doc.id, ...doc.data() });
      });
      setCustomers(customersData);
    }, (error) => {
      console.error("Error loading customers:", error);
    });
    
    return () => unsubscribe();
  }, [db, userId]);

  // Load shifts with the correct collection name and structure
  useEffect(() => {
    if (!db || !userId) return;

    console.log('🔄 Loading shifts for current date... (version:', dataVersion, ')');
    
    const currentDateStr = formatDateForComparison(currentDate);
    console.log('Looking for shifts on date:', currentDateStr);
    
    const shiftsQuery = query(
      collection(db, 'shifts'),
      where("userId", "==", userId),
      where("startDate", "==", currentDateStr)
    );
    
    const unsubscribe = onSnapshot(shiftsQuery, (snapshot) => {
      console.log(`📊 Found ${snapshot.size} shifts for ${currentDateStr}`);
      
      const shiftsData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      console.log('✅ Shifts loaded:', shiftsData);
      setSchedules(shiftsData);
    }, (err) => { 
      console.error("Error loading shifts:", err); 
      setError("Failed to load shift data."); 
    });

    return () => unsubscribe();
  }, [db, userId, currentDate, dataVersion]);

  // Get technician shift with the correct data structure
  const getTechnicianShiftForToday = useCallback((technicianId) => {
    console.log(`🔍 Looking for shift for technician: ${technicianId}`);
    console.log('Available shifts:', schedules);
    
    const shift = schedules.find(s => {
      console.log(`Comparing staffId "${s.staffId}" with technicianId "${technicianId}"`);
      return s.staffId === technicianId;
    });
    
    console.log(`🎯 Shift found for ${technicianId}:`, shift);
    return shift;
  }, [schedules]);

  // Check if specific time slot is within shift  
  const isTimeSlotInShift = useCallback((technicianId, slotHour) => {
    const shift = getTechnicianShiftForToday(technicianId);
    
    if (!shift) {
      console.log(`❌ No shift found for technician ${technicianId} at hour ${slotHour}`);
      return false;
    }
    
    if (shift.type === 'time_off') {
      console.log(`❌ Technician ${technicianId} has time off at hour ${slotHour}`);
      return false;
    }
    
    if (!shift.startTime || !shift.endTime) {
      console.log(`❌ Shift has no time data for ${technicianId}`);
      return false;
    }
    
    const shiftStart = parseTimeString(shift.startTime);
    const shiftEnd = parseTimeString(shift.endTime);
    
    if (shiftStart === null || shiftEnd === null) {
      console.log(`❌ Could not parse shift times for ${technicianId}: start=${shift.startTime}, end=${shift.endTime}`);
      return false;
    }
    
    const slotStartMinutes = slotHour * 60;
    const slotEndMinutes = (slotHour + 1) * 60;
    
    const isInShift = slotStartMinutes < shiftEnd && slotEndMinutes > shiftStart;
    
    console.log(`Hour ${slotHour} for ${technicianId}: slot ${slotStartMinutes}-${slotEndMinutes} vs shift ${shiftStart}-${shiftEnd} = ${isInShift ? '✅ IN SHIFT' : '❌ OFF SHIFT'}`);
    
    return isInShift;
  }, [getTechnicianShiftForToday]);

  // Load jobs from Firebase - FIXED: Multi-technician support
  useEffect(() => {
    if (!db || !userId) return;

    console.log('🔄 Loading jobs... (version:', dataVersion, ')');
    
    const currentDateStr = formatDateForComparison(currentDate);
    console.log('Loading jobs for date:', currentDateStr);

    const jobsQuery = query(
      collection(db, 'jobs'),
      where("userId", "==", userId),
      where("startDate", "==", currentDateStr)
    );
    
    const unsubscribe = onSnapshot(jobsQuery, (querySnapshot) => {
      console.log('💼 Jobs snapshot received for', currentDateStr, ', docs:', querySnapshot.size);
      const jobsData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        if (data.status !== 'canceled') {
          // Create a job entry for each assigned technician
          if (data.appointments && data.appointments.length > 0) {
            // Handle multi-technician jobs - create a job instance for each technician
            data.appointments.forEach((appointment, index) => {
              const tech = technicians.find(t => t.name === appointment.technician);
              if (tech) {
                const job = {
                  id: `${doc.id}-${index}`, // Unique ID for each technician assignment
                  originalId: doc.id, // Keep original job ID for updates
                  title: data.customerName || 'Unknown Customer',
                  type: data.jobType || 'Service Call',
                  address: data.serviceLocation?.address || 'No address',
                  phone: data.serviceLocation?.phone || 'No phone',
                  notes: data.description || 'No notes',
                  startTime: appointment.startTime || '09:00',
                  endTime: appointment.endTime || '17:00',
                  technicianId: tech.id,
                  technician: appointment.technician,
                  status: data.status || 'scheduled',
                  jobNumber: data.jobNumber,
                  startDate: data.startDate,
                  customerId: data.customerId,
                  locationId: data.locationId,
                  priority: data.priority || 'Normal',
                  appointmentIndex: index, // Track which appointment this represents
                  isMultiTech: data.appointments.length > 1 // Flag for multi-tech jobs
                };
                jobsData.push(job);
              }
            });
          } else {
            // Handle single technician jobs (legacy format)
            const job = {
              id: doc.id,
              originalId: doc.id,
              title: data.customerName || 'Unknown Customer',
              type: data.jobType || 'Service Call',
              address: data.serviceLocation?.address || 'No address',
              phone: data.serviceLocation?.phone || 'No phone',
              notes: data.description || 'No notes',
              startTime: data.startTime || '09:00',
              endTime: data.endTime || '17:00',
              technicianId: null,
              status: data.status || 'scheduled',
              jobNumber: data.jobNumber,
              technician: data.technician,
              startDate: data.startDate,
              customerId: data.customerId,
              locationId: data.locationId,
              priority: data.priority || 'Normal',
              appointmentIndex: 0,
              isMultiTech: false
            };

            const tech = technicians.find(t => t.name === data.technician);
            if (tech) {
              job.technicianId = tech.id;
            }

            jobsData.push(job);
          }
        }
      });
      
      console.log('✅ Jobs loaded for', currentDateStr, ':', jobsData);
      setJobs(jobsData);
    }, (error) => {
      console.error("❌ Error loading jobs:", error);
    });
    
    return () => unsubscribe();
  }, [db, userId, technicians, dataVersion, currentDate]);

  // Check if technician has shift for current time
  const technicianHasShift = (technicianId, startTime) => {
    const shift = getTechnicianShiftForToday(technicianId);
    
    if (!shift || shift.type === 'time_off') {
      return false;
    }
    
    if (!shift.startTime || !shift.endTime) {
      return false;
    }
    
    const shiftStart = parseTimeString(shift.startTime);
    const shiftEnd = parseTimeString(shift.endTime);
    const jobStart = timeToMinutes(startTime);
    
    if (shiftStart !== null && shiftEnd !== null && jobStart >= shiftStart && jobStart <= shiftEnd) {
      return true;
    }
    
    return false;
  };

  const timeSlots = Array.from({ length: 24 }, (_, i) => { 
    const hour = i; 
    const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour); 
    return `${displayHour} ${hour < 12 ? 'AM' : 'PM'}`; 
  });
  
  const toggleTechnician = (techId) => setSelectedTechs(p => p.includes(techId) ? p.filter(id => id !== techId) : [...p, techId]);
  
  const handleDragStart = (e, job, type) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    
    document.body.classList.add('dragging');
    
    const jobElement = e.currentTarget.closest('.job-card');
    const rect = jobElement.getBoundingClientRect();
    
    let offsetX, offsetY;
    
    if (type === 'move') {
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    } else {
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    }
    
    setDragState({ 
      jobId: job.id, 
      type, 
      offsetX,
      offsetY,
      initialJobDuration: timeToMinutes(job.endTime) - timeToMinutes(job.startTime),
      originalJob: { ...job },
      initialMouseX: e.clientX,
      initialMouseY: e.clientY,
      isDraggingFreely: type === 'move',
      mouseX: e.clientX,
      mouseY: e.clientY
    });
  };

  const handleJobDragStart = (e, job) => {
    e.dataTransfer.setData('application/json', JSON.stringify(job));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragState) return;
    
    // For free dragging, update position and calculate hover hour
    if (dragState.isDraggingFreely) {
      let hoverHour = null;
      let hoverTechnicianId = null;
      
      // Calculate which hour we're hovering over
      if (timelineContainerRef.current) {
        const container = timelineContainerRef.current;
        const rect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft;
        
        // Auto-scroll near edges
        const scrollZone = 100;
        const scrollSpeed = 20;
        
        if (e.clientX < rect.left + scrollZone) {
          container.scrollLeft -= scrollSpeed;
        } else if (e.clientX > rect.right - scrollZone) {
          container.scrollLeft += scrollSpeed;
        }
        
        // Calculate hover hour
        const relativeX = e.clientX - rect.left + scrollLeft - dragState.offsetX;
        const hourPosition = relativeX / PIXELS_PER_HOUR;
        hoverHour = Math.max(0, Math.min(23, Math.floor(hourPosition)));
      }
      
      // Calculate which technician row we're over
      technicianRowsRef.current.forEach((rowEl, techId) => {
        if (!rowEl) return;
        const rowRect = rowEl.getBoundingClientRect();
        if (e.clientY >= rowRect.top && e.clientY <= rowRect.bottom) {
          hoverTechnicianId = techId;
        }
      });
      
      setDragState(prev => ({
        ...prev,
        mouseX: e.clientX,
        mouseY: e.clientY,
        hoverHour,
        hoverTechnicianId
      }));
      return;
    }
    
    // For resize operations
    if (!timelineContainerRef.current) return;
    
    const container = timelineContainerRef.current;
    const rect = container.getBoundingClientRect();
    const scrollZone = 60, scrollSpeed = 15;
    if (e.clientX < rect.left + scrollZone) container.scrollLeft -= scrollSpeed;
    else if (e.clientX > rect.right - scrollZone) container.scrollLeft += scrollSpeed;

    // Calculate mouse position in timeline
    const mouseXInTimeline = e.clientX - rect.left + container.scrollLeft;
    const mouseMinutes = (mouseXInTimeline / PIXELS_PER_HOUR) * 60;
    
    setJobs(prevJobs => prevJobs.map(job => {
      if (job.id !== dragState.jobId) return job;
      let newStartMinutes, newEndMinutes;
      
      const currentStartMinutes = timeToMinutes(job.startTime);
      const currentEndMinutes = timeToMinutes(job.endTime);
      
      if (dragState.type === 'resize-right') { 
        newStartMinutes = currentStartMinutes; 
        newEndMinutes = mouseMinutes; 
      } else if (dragState.type === 'resize-left') { 
        newEndMinutes = currentEndMinutes; 
        newStartMinutes = mouseMinutes; 
      }
      
      // Snap to 5-minute intervals for resizing
      newStartMinutes = Math.max(0, Math.round(newStartMinutes / 5) * 5);
      newEndMinutes = Math.min(24 * 60, Math.round(newEndMinutes / 5) * 5);
      
      // Minimum 15-minute duration
      if (newEndMinutes - newStartMinutes < 15) { 
        if (dragState.type === 'resize-right') newEndMinutes = newStartMinutes + 15; 
        else newStartMinutes = newEndMinutes - 15; 
      }
      
      return { 
        ...job, 
        startTime: minutesToTime(newStartMinutes), 
        endTime: minutesToTime(newEndMinutes)
      };
    }));
  }, [dragState]);

  const handleMouseUp = useCallback(async (e) => { 
    document.body.classList.remove('dragging'); 
    
    if (dragState && db) {
      if (dragState.isDraggingFreely) {
        let targetTechnicianId = null;
        let targetTime = null;
        
        // Check if mouse is over a technician row
        technicianRowsRef.current.forEach((rowEl, techId) => {
          if (!rowEl) return;
          const rowRect = rowEl.getBoundingClientRect();
          if (e.clientY >= rowRect.top && e.clientY <= rowRect.bottom) {
            targetTechnicianId = techId;
            
            if (timelineContainerRef.current && dragState.hoverHour !== null) {
              targetTime = dragState.hoverHour * 60; // Convert hour to minutes
            }
          }
        });
        
        if (targetTechnicianId && targetTime !== null) {
          const tech = technicians.find(t => t.id === targetTechnicianId);
          
          // Get the original job document to update
          const jobId = dragState.originalJob.originalId || dragState.originalJob.id;
          
          // Calculate new end time based on original duration
          const newStartTime = minutesToTime(targetTime);
          const newEndTime = minutesToTime(targetTime + dragState.initialJobDuration);
          
          // Create or update appointments array
          let appointments = [];
          
          if (dragState.originalJob.isMultiTech) {
            // Get all current appointments for this job
            const allJobInstances = jobs.filter(j => 
              (j.originalId === jobId) || (j.id === jobId)
            );
            
            appointments = allJobInstances.map(instance => ({
              id: `${dragState.originalJob.jobNumber}-${instance.appointmentIndex + 1}`,
              technician: instance.technician,
              status: 'Scheduled',
              startDate: instance.startDate,
              startTime: instance.startTime,
              endTime: instance.endTime
            }));
            
            // Update the appointment for the current technician
            const currentAppointmentIndex = dragState.originalJob.appointmentIndex || 0;
            if (appointments[currentAppointmentIndex]) {
              appointments[currentAppointmentIndex] = {
                ...appointments[currentAppointmentIndex],
                technician: tech?.name || '',
                startTime: newStartTime,
                endTime: newEndTime
              };
            }
          } else {
            // Single appointment
            appointments = [{
              id: `${dragState.originalJob.jobNumber}-1`,
              technician: tech?.name || '',
              status: 'Scheduled',
              startDate: dragState.originalJob.startDate,
              startTime: newStartTime,
              endTime: newEndTime
            }];
          }
          
          // Update the job in state immediately for better UX
          setJobs(prevJobs => prevJobs.map(job => {
            if (job.id === dragState.jobId) {
              return {
                ...job,
                technicianId: targetTechnicianId,
                technician: tech?.name || '',
                startTime: newStartTime,
                endTime: newEndTime,
                status: 'scheduled'
              };
            }
            return job;
          }));
          
          // Check if technician has shift for the new time
          if (!technicianHasShift(targetTechnicianId, newStartTime)) {
            setPendingJobAssignment({
              job: { ...dragState.originalJob, appointments },
              technicianName: tech?.name || 'Unknown'
            });
            setShowShiftWarning(true);
            setDragState(null);
            return;
          }
          
          // Save to Firebase
          try {
            await updateDoc(doc(db, 'jobs', jobId), {
              technician: appointments[0]?.technician || '',
              startTime: appointments[0]?.startTime || '',
              endTime: appointments[0]?.endTime || '',
              status: 'scheduled',
              appointments,
              updatedAt: new Date().toISOString()
            });
          } catch (error) {
            console.error('Error updating job:', error);
            // Revert state change on error
            setJobs(prevJobs => prevJobs.map(job => 
              job.id === dragState.jobId ? dragState.originalJob : job
            ));
          }
        } else {
          // Dropped outside valid area, restore original position
          setJobs(prevJobs => prevJobs.map(job => 
            job.id === dragState.jobId ? dragState.originalJob : job
          ));
        }
      } else {
        // Handle resize operations - update the specific appointment
        const updatedJob = jobs.find(job => job.id === dragState.jobId);
        if (updatedJob) {
          try {
            const jobId = updatedJob.originalId || updatedJob.id;
            
            // Get all appointments for this job
            const allJobInstances = jobs.filter(j => 
              (j.originalId === jobId) || (j.id === jobId)
            );
            
            const appointments = allJobInstances.map(instance => {
              if (instance.id === dragState.jobId) {
                // Update the resized appointment
                return {
                  id: `${instance.jobNumber}-${instance.appointmentIndex + 1}`,
                  technician: instance.technician,
                  status: 'Scheduled',
                  startDate: instance.startDate,
                  startTime: updatedJob.startTime,
                  endTime: updatedJob.endTime
                };
              } else {
                // Keep other appointments unchanged
                return {
                  id: `${instance.jobNumber}-${instance.appointmentIndex + 1}`,
                  technician: instance.technician,
                  status: 'Scheduled',
                  startDate: instance.startDate,
                  startTime: instance.startTime,
                  endTime: instance.endTime
                };
              }
            });
            
            await updateDoc(doc(db, 'jobs', jobId), {
              appointments,
              updatedAt: new Date().toISOString()
            });
          } catch (error) {
            console.error('Error updating job:', error);
          }
        }
      }
    }
    
    setDragState(null); 
  }, [dragState, jobs, technicians, db, technicianHasShift]);

  const handleShiftWarningConfirm = async () => {
    if (pendingJobAssignment && db) {
      try {
        const jobId = pendingJobAssignment.job.originalId || pendingJobAssignment.job.id;
        await updateDoc(doc(db, 'jobs', jobId), {
          technician: pendingJobAssignment.job.appointments[0]?.technician || '',
          startTime: pendingJobAssignment.job.appointments[0]?.startTime || '',
          endTime: pendingJobAssignment.job.appointments[0]?.endTime || '',
          appointments: pendingJobAssignment.job.appointments,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error updating job:', error);
      }
    }
    
    setShowShiftWarning(false);
    setPendingJobAssignment(null);
  };

  const handleShiftWarningCancel = () => {
    if (pendingJobAssignment && dragState?.originalJob) {
      setJobs(prevJobs => prevJobs.map(job => {
        if (job.id === pendingJobAssignment.job.id) {
          return dragState.originalJob;
        }
        return job;
      }));
    }
    
    setShowShiftWarning(false);
    setPendingJobAssignment(null);
  };

  const handleDrop = async (e, technicianId) => {
    e.preventDefault();
    
    try {
      const jobData = JSON.parse(e.dataTransfer.getData('application/json'));
      const technician = technicians.find(t => t.id === technicianId);
      
      if (!technician) return;

      let targetTime = 9 * 60; // Default to 9 AM
      
      if (timelineContainerRef.current) {
        const timelineRect = timelineContainerRef.current.getBoundingClientRect();
        const scrollLeft = timelineContainerRef.current.scrollLeft;
        
        const relativeX = e.clientX - timelineRect.left + scrollLeft;
        const timePosition = (relativeX / PIXELS_PER_HOUR) * 60;
        targetTime = Math.max(0, Math.round(timePosition / 15) * 15);
      }

      const updatedJob = {
        ...jobData,
        technicianId,
        technician: technician.name,
        startTime: minutesToTime(targetTime),
        endTime: minutesToTime(targetTime + 60),
        status: 'scheduled'
      };
      
      if (!technicianHasShift(technicianId, updatedJob.startTime)) {
        setPendingJobAssignment({
          job: updatedJob,
          technicianName: technician.name
        });
        setShowShiftWarning(true);
        return;
      }
      
      await updateDoc(doc(db, 'jobs', jobData.id), {
        technician: technician.name,
        startTime: updatedJob.startTime,
        endTime: updatedJob.endTime,
        status: 'scheduled',
        appointments: [{
          id: `${jobData.jobNumber}-1`,
          status: 'Scheduled',
          startDate: jobData.startDate,
          startTime: updatedJob.startTime,
          endTime: updatedJob.endTime,
          technician: technician.name
        }],
        updatedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error assigning job:', error);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleJobClick = (job) => {
    // Load the complete job data including all appointments
    if (job.isMultiTech && job.originalId) {
      // Get all instances of this multi-tech job
      const allInstances = jobs.filter(j => j.originalId === job.originalId || j.id === job.originalId);
      const fullJob = {
        ...job,
        appointments: allInstances.map(instance => ({
          id: `${instance.jobNumber}-${instance.appointmentIndex + 1}`,
          technician: instance.technician,
          status: 'Scheduled',
          startDate: instance.startDate,
          startTime: instance.startTime,
          endTime: instance.endTime
        }))
      };
      setSelectedJob(fullJob);
    } else {
      setSelectedJob(job);
    }
    setShowJobDetails(true);
  };

  const handleSaveJob = async (updatedJob) => {
    if (db) {
      try {
        const { id, originalId, appointmentIndex, isMultiTech, ...jobData } = updatedJob;
        const jobId = originalId || id; // Use originalId for multi-tech jobs
        
        // Update the job document with the new appointments array
        await updateDoc(doc(db, 'jobs', jobId), {
          ...jobData,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error updating job:', error);
      }
    }
    setShowJobDetails(false);
  };

  const handleJobCreated = () => {
    setDataVersion(prev => prev + 1);
  };

  useEffect(() => {
    if (dragState) { 
      window.addEventListener('mousemove', handleMouseMove); 
      window.addEventListener('mouseup', handleMouseUp, { once: true }); 
    }
    return () => { 
      window.removeEventListener('mousemove', handleMouseMove); 
      window.removeEventListener('mouseup', handleMouseUp); 
    };
  }, [dragState, handleMouseMove, handleMouseUp]);

  // Set default scroll position to center the view around 10 AM
  useEffect(() => {
    if (timelineContainerRef.current) {
      const centerTime = 10;
      const viewportWidth = timelineContainerRef.current.clientWidth;
      const scrollPosition = (centerTime * PIXELS_PER_HOUR) - (viewportWidth / 2);
      timelineContainerRef.current.scrollLeft = Math.max(0, scrollPosition);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600 dark:text-gray-300">Loading technicians...</p>
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

  if (technicians.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <h2 className="text-xl font-medium text-gray-800 dark:text-gray-100 mb-2">No Active Technicians</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Add technicians in Settings {'>'} People {'>'} Technicians to use the dispatch board.
          </p>
          <button 
            onClick={() => window.location.href = '/settings'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  // Filter jobs for dispatch board
  const dispatchJobs = jobs.filter(job => 
    job.status !== 'canceled' && 
    job.status !== 'on_hold' && 
    job.technicianId && 
    job.startTime
  );

  // Jobs for sidebar tabs - FIXED for multi-tech
  const unassignedJobs = jobs.filter(job => {
    if (job.status === 'canceled') return false;
    
    // For multi-tech jobs, only show in unassigned if NO technicians are assigned
    if (job.isMultiTech) {
      const allJobInstances = jobs.filter(j => 
        (j.originalId === job.originalId) && j.technician
      );
      return allJobInstances.length === 0;
    }
    
    // For single-tech jobs, show if no technician assigned
    return (!job.technician || job.technician === '') && (!job.startTime || job.startTime === '');
  });
  
  const unscheduledJobs = jobs.filter(job => 
    job.status !== 'canceled' && 
    job.technician && 
    job.technician !== '' && 
    (!job.startTime || job.startTime === '')
  );
  
  const onHoldJobs = jobs.filter(job => job.status === 'on_hold');

  const getTabJobs = () => {
    switch (activeJobTab) {
      case 'unassigned': return unassignedJobs;
      case 'unscheduled': return unscheduledJobs;
      case 'on_hold': return onHoldJobs;
      default: return unassignedJobs;
    }
  };

  const tabJobs = getTabJobs();

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200">
      <style>{`.dragging, .dragging * { cursor: grabbing !important; }`}</style>
      
      <div className="border-b border-gray-200 dark:border-slate-700 p-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={() => setShowTechList(!showTechList)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <Menu size={20} className="text-gray-600 dark:text-gray-300"/>
            </button>
            <div className="flex items-center space-x-2">
              <button 
                onClick={goToPreviousDay}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <ChevronLeft size={18} className="text-gray-600 dark:text-gray-300" />
              </button>
              
              <div className="relative">
                <button 
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 rounded transition-colors flex items-center"
                >
                  <Calendar size={16} className="mr-2" />
                  {format(currentDate, 'EEE, MMM d, yyyy')}
                </button>
                
                <CalendarPicker
                  isOpen={showCalendar}
                  onClose={() => setShowCalendar(false)}
                  selectedDate={currentDate}
                  onDateSelect={(date) => {
                    setCurrentDate(date);
                    setDataVersion(prev => prev + 1);
                  }}
                />
              </div>
              
              <button 
                onClick={goToNextDay}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <ChevronRight size={18} className="text-gray-600 dark:text-gray-300" />
              </button>
              
              <button
                onClick={goToToday}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                Today
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`flex items-center px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium transition-colors ${
                isRefreshing 
                  ? 'bg-gray-100 dark:bg-slate-700 text-gray-400 cursor-not-allowed' 
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              <RefreshCw size={16} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button 
              onClick={() => setShowNewJobPanel(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} className="mr-2" />
              New Job
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Technician List Sidebar */}
        <div className={`transition-all duration-300 ${showTechList ? 'w-64' : 'w-0'}`}>
          <div className={`w-64 border-r border-gray-200 dark:border-slate-700 overflow-y-auto h-full ${showTechList ? 'opacity-100' : 'opacity-0'}`}>
            <div className="p-4">
              <div className="space-y-2">
                {technicians.map(tech => (
                  <label key={tech.id} className="flex items-start p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                    <input type="checkbox" checked={selectedTechs.includes(tech.id)} onChange={() => toggleTechnician(tech.id)} className="mt-1 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-700"/>
                    <div className="ml-3 flex items-center">
                      {tech.profilePicture ? (
                        <img 
                          src={tech.profilePicture} 
                          alt={tech.name} 
                          className="h-8 w-8 rounded-full object-cover mr-3"
                        />
                      ) : (
                        <div 
                          className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm mr-3"
                          style={{ backgroundColor: tech.color }}
                        >
                          {tech.name.split(' ').map(n => n[0]).join('')}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{tech.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{tech.role} • {tech.businessUnit || 'Unassigned'}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Dispatch Board */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Dispatch Timeline */}
          <div className="flex-1 overflow-x-auto" ref={timelineContainerRef}>
            <div style={{ width: `${TOTAL_TIMELINE_WIDTH}px` }} className="relative">
              <div className="flex border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-40">
                <div className="w-48 flex-shrink-0 sticky left-0 bg-white dark:bg-slate-900 z-50 border-r border-gray-200 dark:border-slate-700" />
                <div className="flex-1 flex relative">
                  {timeSlots.map((time, index) => (
                    <div key={time} className="relative py-2 text-xs font-medium text-gray-400 dark:text-gray-500" style={{width: `${PIXELS_PER_HOUR}px`}}>
                      <div className="text-left pl-1">
                        <span>{time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {technicians.filter(tech => selectedTechs.includes(tech.id)).map(tech => {
                const techJobs = dispatchJobs.filter(job => job.technicianId === tech.id);
                const { jobLevels, totalLevels } = getJobStackingLevels(techJobs);
                const rowHeight = totalLevels > 0 ? totalLevels * JOB_CARD_HEIGHT + (JOB_CARD_TOP_OFFSET * 2) : 64;

                return (
                  <div 
                    key={tech.id} 
                    className="flex border-b border-gray-200 dark:border-slate-700" 
                    style={{ height: `${rowHeight}px` }} 
                    ref={el => technicianRowsRef.current.set(tech.id, el)}
                    onDrop={(e) => handleDrop(e, tech.id)}
                    onDragOver={handleDragOver}
                  >
                    <div className="w-48 flex-shrink-0 p-3 border-r border-gray-200 dark:border-slate-700 sticky left-0 bg-white dark:bg-slate-900 z-30">
                      <div className="flex items-center">
                        {tech.profilePicture ? (
                          <img 
                            src={tech.profilePicture} 
                            alt={tech.name} 
                            className="h-8 w-8 rounded-full object-cover mr-3"
                          />
                        ) : (
                          <div 
                            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm mr-3"
                            style={{ backgroundColor: tech.color }}
                          >
                            {tech.name.split(' ').map(n => n[0]).join('')}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{tech.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{tech.role}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Timeline with hour highlighting and snapping */}
                    <div className="flex-1 relative h-full">
                      {/* Hour-by-hour shift background */}
                      {Array.from({ length: 24 }, (_, hour) => {
                        const isInShift = isTimeSlotInShift(tech.id, hour);
                        
                        const isHovered = dragState?.isDraggingFreely && 
                                         dragState.hoverHour === hour && 
                                         dragState.hoverTechnicianId === tech.id;
                        
                        return (
                          <div
                            key={hour}
                            className="absolute top-0 bottom-0 transition-all duration-200"
                            style={{
                              left: `${hour * PIXELS_PER_HOUR}px`,
                              width: `${PIXELS_PER_HOUR}px`,
                              backgroundColor: isHovered 
                                ? 'rgba(59, 130, 246, 0.3)'
                                : isInShift 
                                  ? 'rgba(255, 255, 255, 1)'
                                  : 'rgba(156, 163, 175, 0.3)',
                              zIndex: 1,
                              border: isHovered ? '2px dashed rgba(59, 130, 246, 0.6)' : 'none'
                            }}
                          />
                        );
                      })}
                      
                      {/* Job cards */}
                      {techJobs.map(job => (
                        <JobCard 
                          key={job.id} 
                          job={job} 
                          onDragStart={handleDragStart} 
                          isDragging={dragState?.jobId === job.id} 
                          level={jobLevels.get(job.id) || 0}
                          technicianColor={tech.color}
                          onClick={handleJobClick}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Job Tabs Section */}
          <div className="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-slate-700">
              <div className="flex">
                <button
                  onClick={() => setActiveJobTab('unassigned')}
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeJobTab === 'unassigned'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  Unassigned ({unassignedJobs.length})
                </button>
                <button
                  onClick={() => setActiveJobTab('unscheduled')}
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeJobTab === 'unscheduled'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  Unscheduled ({unscheduledJobs.length})
                </button>
                <button
                  onClick={() => setActiveJobTab('on_hold')}
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeJobTab === 'on_hold'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  On Hold ({onHoldJobs.length})
                </button>
              </div>
            </div>

            {/* Job List */}
            <div className="h-48 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {tabJobs.map(job => (
                  <div
                    key={job.id}
                    className="p-3 border border-gray-200 dark:border-slate-700 rounded-lg cursor-move hover:shadow-md transition-shadow bg-white dark:bg-slate-700"
                    draggable
                    onDragStart={(e) => handleJobDragStart(e, job)}
                  >
                    <div className="font-medium text-gray-800 dark:text-gray-100 text-sm mb-1">
                      {job.jobNumber}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      {job.type} - {job.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      {job.address}
                    </div>
                    {job.technician && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Assigned to: {job.technician}
                      </div>
                    )}
                    {job.isMultiTech && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        Multi-technician job
                      </div>
                    )}
                  </div>
                ))}
                
                {tabJobs.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
                    <p className="text-sm">No {activeJobTab.replace('_', ' ')} jobs</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating job card with snap preview */}
      {dragState?.isDraggingFreely && dragState.mouseX !== undefined && dragState.mouseY !== undefined && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: `${dragState.mouseX - dragState.offsetX}px`,
            top: `${dragState.mouseY - dragState.offsetY}px`,
            transform: 'none'
          }}
        >
          <div 
            className="h-[56px] w-[200px] border rounded-md shadow-xl flex text-white opacity-90"
            style={{ 
              backgroundColor: technicians.find(t => t.id === dragState.originalJob?.technicianId)?.color || '#3B82F6'
            }}
          >
            <div className="px-2 py-1 h-full flex flex-col justify-center w-full">
              <div className="text-xs font-semibold truncate">{dragState.originalJob?.title}</div>
              <div className="text-xs opacity-80">
                {dragState.hoverHour !== null 
                  ? `${minutesToTime(dragState.hoverHour * 60)} - ${minutesToTime(dragState.hoverHour * 60 + dragState.initialJobDuration)}`
                  : `${dragState.originalJob?.startTime} - ${dragState.originalJob?.endTime}`
                }
              </div>
            </div>
          </div>
          
          {/* Snap indicator */}
          {dragState.hoverHour !== null && (
            <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-lg">
              Snap to {dragState.hoverHour}:00
            </div>
          )}
        </div>
      )}

      {/* Job Details Modal */}
      <JobDetailsModal
        job={selectedJob}
        isOpen={showJobDetails}
        onClose={() => {
          setShowJobDetails(false);
          setSelectedJob(null);
        }}
        onSave={handleSaveJob}
        technicians={technicians}
      />

      {/* New Job Panel */}
      <NewJobPanel
        isOpen={showNewJobPanel}
        onClose={() => setShowNewJobPanel(false)}
        customers={customers}
        technicians={technicians}
        onJobCreated={handleJobCreated}
        db={db}
        userId={userId}
      />

      {/* Shift Warning Modal */}
      <ShiftWarningModal
        isOpen={showShiftWarning}
        onConfirm={handleShiftWarningConfirm}
        onCancel={handleShiftWarningCancel}
        technicianName={pendingJobAssignment?.technicianName || ''}
      />
    </div>
  );
};

export default Dispatch;