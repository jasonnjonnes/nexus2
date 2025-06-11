import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, addWeeks, addMonths, startOfMonth, endOfMonth, isSameDay } from 'date-fns';

interface CalendarPickerProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onClose: () => void;
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({ currentDate, onDateChange, onClose }) => {
  const [viewDate, setViewDate] = useState(currentDate);
  const [viewMode, setViewMode] = useState('month'); // month, year

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (date: Date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const startWeek = startOfWeek(start, { weekStartsOn: 0 });
    const endWeek = endOfWeek(end, { weekStartsOn: 0 });
    
    const days = [];
    let current = startWeek;
    
    while (current <= endWeek) {
      days.push(new Date(current));
      current = addDays(current, 1);
    }
    
    return days;
  };

  const handleDateClick = (date: Date) => {
    onDateChange(date);
    onClose();
  };

  const handleMonthClick = (monthIndex: number) => {
    const newDate = new Date(viewDate.getFullYear(), monthIndex, 1);
    setViewDate(newDate);
    setViewMode('month');
  };

  const handleYearClick = (year: number) => {
    const newDate = new Date(year, viewDate.getMonth(), 1);
    setViewDate(newDate);
    setViewMode('month');
  };

  if (viewMode === 'year') {
    const currentYear = viewDate.getFullYear();
    const years = Array.from({ length: 12 }, (_, i) => currentYear - 6 + i);

    return (
      <div className="absolute top-full left-0 mt-2 p-4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg z-50 w-80">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setViewDate(new Date(currentYear - 12, viewDate.getMonth(), 1))}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
          >
            <ChevronLeft size={16} />
          </button>
          <h3 className="font-medium text-gray-800 dark:text-gray-100">
            {currentYear - 6} - {currentYear + 5}
          </h3>
          <button
            onClick={() => setViewDate(new Date(currentYear + 12, viewDate.getMonth(), 1))}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {years.map(year => (
            <button
              key={year}
              onClick={() => handleYearClick(year)}
              className={`p-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-slate-700 ${
                year === currentDate.getFullYear() 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (viewMode === 'months') {
    return (
      <div className="absolute top-full left-0 mt-2 p-4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg z-50 w-80">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setViewDate(addDays(viewDate, -365))}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setViewMode('year')}
            className="font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 px-2 py-1 rounded"
          >
            {viewDate.getFullYear()}
          </button>
          <button
            onClick={() => setViewDate(addDays(viewDate, 365))}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {monthNames.map((month, index) => (
            <button
              key={month}
              onClick={() => handleMonthClick(index)}
              className={`p-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-slate-700 ${
                index === currentDate.getMonth() && viewDate.getFullYear() === currentDate.getFullYear()
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {month.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const days = getDaysInMonth(viewDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="absolute top-full left-0 mt-2 p-4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg z-50 w-80">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewDate(addMonths(viewDate, -1))}
          className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => setViewMode('months')}
          className="font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 px-2 py-1 rounded"
        >
          {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
        </button>
        <button
          onClick={() => setViewDate(addMonths(viewDate, 1))}
          className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 p-1">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => (
          <button
            key={day.toISOString()}
            onClick={() => handleDateClick(day)}
            className={`p-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-slate-700 ${
              isSameDay(day, currentDate) 
                ? 'bg-blue-600 text-white' 
                : day.getMonth() === viewDate.getMonth()
                  ? 'text-gray-700 dark:text-gray-300'
                  : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {day.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CalendarPicker; 