import React, { useState } from 'react';
import { 
  GitBranch, 
  Play, 
  Pause,
  Plus,
  Edit,
  Trash2,
  Filter,
  MessageSquare,
  Mail,
  Bell,
  FileText,
  Calendar,
  DollarSign,
  ClipboardList
} from 'lucide-react';

// Sample automation rules
const automations = [
  {
    id: 1,
    name: "Job Confirmation Notification",
    description: "Send SMS and email to customer when job is scheduled",
    trigger: "Job Status Changed to 'Scheduled'",
    active: true,
    lastRun: "2 hours ago",
    conditions: [
      "All job types",
      "All business units"
    ],
    actions: [
      "Send customer SMS",
      "Send customer email"
    ]
  },
  {
    id: 2,
    name: "Technician En Route Alert",
    description: "Notify customer when technician is on the way",
    trigger: "Job Status Changed to 'En Route'",
    active: true,
    lastRun: "30 minutes ago",
    conditions: [
      "All job types",
      "All business units"
    ],
    actions: [
      "Send customer SMS with ETA"
    ]
  },
  {
    id: 3,
    name: "Follow-Up Task Creation",
    description: "Create follow-up task for HVAC maintenance jobs",
    trigger: "Job Status Changed to 'Completed'",
    active: true,
    lastRun: "1 day ago",
    conditions: [
      "Job Type is 'HVAC Maintenance'",
      "Business Unit is 'Residential'"
    ],
    actions: [
      "Create follow-up job in 6 months",
      "Add note to customer profile"
    ]
  },
  {
    id: 4,
    name: "Invoice Generation",
    description: "Automatically generate invoice when job is completed",
    trigger: "Job Status Changed to 'Completed'",
    active: false,
    lastRun: "Never",
    conditions: [
      "All job types",
      "All business units"
    ],
    actions: [
      "Generate invoice",
      "Send invoice to customer email"
    ]
  },
  {
    id: 5,
    name: "Customer Birthday Coupon",
    description: "Send special discount coupon on customer's birthday",
    trigger: "Date Matches Customer's Birthday",
    active: true,
    lastRun: "5 days ago",
    conditions: [
      "Customer has completed at least 1 job",
      "Customer not marked as 'Do Not Contact'"
    ],
    actions: [
      "Generate 10% off coupon",
      "Send email with coupon code"
    ]
  }
];

interface AutomationCardProps {
  automation: typeof automations[0];
  onToggle: (id: number) => void;
}

const AutomationCard: React.FC<AutomationCardProps> = ({ automation, onToggle }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4 flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <h3 className="font-medium text-lg text-gray-800 dark:text-gray-100">{automation.name}</h3>
            <div className={`ml-3 px-2 py-0.5 text-xs font-medium rounded-full ${
              automation.active 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-200'
            }`}>
              {automation.active ? 'Active' : 'Inactive'}
            </div>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{automation.description}</p>
          
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <span>Last run: {automation.lastRun}</span>
            <span className="mx-2">•</span>
            <span>Trigger: {automation.trigger}</span>
          </div>
        </div>
        
        <div className="flex items-center">
          <button 
            onClick={() => onToggle(automation.id)} 
            className={`mr-2 p-1.5 rounded-full ${
              automation.active 
                ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600'
            } transition-colors`}
          >
            {automation.active ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className="mr-2 p-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600 transition-colors">
            <Edit size={18} />
          </button>
          <button className="p-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600 transition-colors">
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      
      <div className="border-t border-gray-200 dark:border-slate-700 px-4 py-3 bg-gray-50 dark:bg-slate-800/50 rounded-b-lg">
        <div className="flex flex-wrap gap-2">
          {automation.conditions.map((condition, index) => (
            <div key={`condition-${index}`} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs flex items-center">
              <Filter size={12} className="mr-1" />
              {condition}
            </div>
          ))}
          
          {automation.actions.map((action, index) => {
            let icon = <Bell size={12} />;
            if (action.includes('SMS')) icon = <MessageSquare size={12} />;
            if (action.includes('email')) icon = <Mail size={12} />;
            if (action.includes('invoice')) icon = <FileText size={12} />;
            if (action.includes('follow-up')) icon = <Calendar size={12} />;
            if (action.includes('note')) icon = <ClipboardList size={12} />;
            if (action.includes('coupon')) icon = <DollarSign size={12} />;
            
            return (
              <div key={`action-${index}`} className="px-2 py-1 bg-amber-50 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded text-xs flex items-center">
                {React.cloneElement(icon, { className: "mr-1" })}
                <span>{action}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Automations: React.FC = () => {
  const [automationList, setAutomationList] = useState(automations);
  const [filter, setFilter] = useState('all'); // all, active, inactive
  
  const toggleAutomation = (id: number) => {
    setAutomationList(prevList => 
      prevList.map(automation => 
        automation.id === id 
          ? { ...automation, active: !automation.active } 
          : automation
      )
    );
  };
  
  const filteredAutomations = automationList.filter(automation => {
    if (filter === 'all') return true;
    if (filter === 'active') return automation.active;
    if (filter === 'inactive') return !automation.active;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Automations</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Create and manage automated workflows for your business</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex items-center space-x-3">
          <div className="relative">
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
            >
              <option value="all">All Automations</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
          </div>
          
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={18} className="mr-2" />
            New Automation
          </button>
        </div>
      </div>
      
      {/* Automation templates section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Automation Templates</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Get started quickly with these pre-built automation templates</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md dark:hover:border-slate-600 transition-shadow cursor-pointer">
            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center mb-3">
              <MessageSquare size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-1">Customer Notifications</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Automatic SMS and email notifications for job updates</p>
          </div>
          
          <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md dark:hover:border-slate-600 transition-shadow cursor-pointer">
            <div className="h-10 w-10 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center mb-3">
              <FileText size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-1">Invoice Workflow</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Automate invoice generation and payment reminders</p>
          </div>
          
          <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md dark:hover:border-slate-600 transition-shadow cursor-pointer">
            <div className="h-10 w-10 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center mb-3">
              <Calendar size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-1">Maintenance Reminders</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Schedule recurring service reminders for clients</p>
          </div>
        </div>
      </div>
      
      {/* Active automations list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">Your Automations</h2>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center mr-4">
              <div className="h-3 w-3 rounded-full bg-green-400 mr-1.5"></div>
              Active ({automationList.filter(a => a.active).length})
            </div>
            <div className="flex items-center">
              <div className="h-3 w-3 rounded-full bg-gray-300 dark:bg-slate-600 mr-1.5"></div>
              Inactive ({automationList.filter(a => !a.active).length})
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          {filteredAutomations.length > 0 ? (
            filteredAutomations.map(automation => (
              <AutomationCard 
                key={automation.id} 
                automation={automation} 
                onToggle={toggleAutomation} 
              />
            ))
          ) : (
            <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6 text-center">
              <GitBranch size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-3" />
              <h3 className="text-gray-700 dark:text-gray-300 font-medium mb-2">No automations found</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                {filter !== 'all' 
                  ? `There are no ${filter} automations. Change your filter or create a new one.`
                  : 'Get started by creating your first automation rule.'}
              </p>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors inline-flex items-center">
                <Plus size={16} className="mr-1.5" />
                Create New Automation
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Automation Logs Section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Recent Automation Logs</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Automation</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trigger</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">2h ago</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-100">Job Confirmation Notification</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">Job #19423358 scheduled</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Success
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">SMS and Email sent to customer</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">30m ago</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-100">Technician En Route Alert</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">Job #19423356 status: En Route</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Success
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">SMS sent with ETA of 15 minutes</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">1d ago</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-100">Follow-Up Task Creation</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">Job #19423340 completed</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    Failed
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">Error: Invalid calendar access</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Automations;
