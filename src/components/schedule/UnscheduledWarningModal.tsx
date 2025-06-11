import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface UnscheduledWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  technicianName: string;
}

const UnscheduledWarningModal: React.FC<UnscheduledWarningModalProps> = ({ isOpen, onClose, onConfirm, technicianName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <AlertTriangle size={24} className="text-yellow-500 mr-3" />
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
            Technician Not Scheduled
          </h3>
        </div>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          <strong>{technicianName}</strong> does not have a scheduled shift for this time period. 
          Are you sure you want to assign this job to them?
        </p>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
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
    </div>
  );
};

export default UnscheduledWarningModal; 