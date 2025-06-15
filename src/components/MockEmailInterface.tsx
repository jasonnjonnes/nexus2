import React, { useState } from 'react';
import { Mail, Search, Star, Archive, Trash2, Reply, Forward, MoreHorizontal, Paperclip } from 'lucide-react';

const MockEmailInterface: React.FC = () => {
  const [selectedEmail, setSelectedEmail] = useState(null);

  const mockEmails = [
    {
      id: 1,
      from: 'sarah.johnson@customer.com',
      subject: 'Service Request - HVAC Maintenance',
      preview: 'Hi, I need to schedule maintenance for my HVAC system...',
      time: '2:30 PM',
      unread: true,
      starred: false,
      hasAttachment: false
    },
    {
      id: 2,
      from: 'mike.wilson@email.com',
      subject: 'Re: Invoice #1234',
      preview: 'Thank you for the quick service. Payment has been processed...',
      time: '1:15 PM',
      unread: true,
      starred: true,
      hasAttachment: false
    },
    {
      id: 3,
      from: 'emma.davis@company.com',
      subject: 'Quote Request - Plumbing Installation',
      preview: 'Could you please provide a quote for bathroom plumbing...',
      time: '11:45 AM',
      unread: false,
      starred: false,
      hasAttachment: true
    },
    {
      id: 4,
      from: 'support@supplier.com',
      subject: 'Parts Order Confirmation',
      preview: 'Your order #PO-2024-001 has been confirmed and will ship...',
      time: 'Yesterday',
      unread: false,
      starred: false,
      hasAttachment: true
    }
  ];

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Inbox</h3>
          <div className="flex items-center space-x-2">
            <button className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
              <Search size={16} />
            </button>
            <button className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
        
        {/* Demo Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-blue-900 dark:text-blue-100">Demo Email Interface</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">This is a mock interface. Configure Roundcube for real emails.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        {mockEmails.map((email) => (
          <div
            key={email.id}
            onClick={() => setSelectedEmail(email)}
            className={`p-3 border-b border-gray-100 dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
              selectedEmail?.id === email.id ? 'bg-blue-50 dark:bg-slate-700 border-l-4 border-l-blue-500' : ''
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className="flex items-center mt-1">
                {email.unread && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                )}
                <Star 
                  size={14} 
                  className={`${email.starred ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`} 
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm truncate ${email.unread ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                    {email.from}
                  </span>
                  <div className="flex items-center space-x-1">
                    {email.hasAttachment && (
                      <Paperclip size={12} className="text-gray-400" />
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {email.time}
                    </span>
                  </div>
                </div>
                
                <div className={`text-sm truncate ${email.unread ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
                  {email.subject}
                </div>
                
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                  {email.preview}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{mockEmails.filter(e => e.unread).length} unread of {mockEmails.length}</span>
          <span>Mock Data</span>
        </div>
      </div>
    </div>
  );
};

export default MockEmailInterface; 