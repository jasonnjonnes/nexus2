import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, Settings, Info, CheckCircle } from 'lucide-react';
import { exportPricebook, exportServices, exportMaterials, exportForSoftware } from '../utils/pricebookExport';

interface PricebookExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  pricebookData: {
    services: any[];
    materials: any[];
    categories: string[];
    businessInfo?: {
      name: string;
      exportDate: string;
      version: string;
    };
  };
}

const PricebookExportModal: React.FC<PricebookExportModalProps> = ({
  isOpen,
  onClose,
  pricebookData
}) => {
  // Safely destructure pricebookData with default empty arrays
  const {
    services = [],
    materials = [],
    categories = [],
    businessInfo
  } = pricebookData || {};

  const [exportType, setExportType] = useState<'all' | 'services' | 'materials'>('all');
  const [format, setFormat] = useState<'detailed' | 'simple'>('detailed');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [separateSheets, setSeparateSheets] = useState(true);
  const [targetSoftware, setTargetSoftware] = useState<string>('standard');
  const [customFilename, setCustomFilename] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const options = {
        includeInactive,
        includeMetadata: true,
        separateSheets,
        format
      };

      const filename = customFilename || undefined;
      const exportData = { services, materials, categories, businessInfo };

      switch (exportType) {
        case 'services':
          exportServices(services, businessInfo, filename);
          break;
        case 'materials':
          exportMaterials(materials, businessInfo, filename);
          break;
        case 'all':
        default:
          if (targetSoftware !== 'standard') {
            exportForSoftware(exportData, targetSoftware, filename);
          } else {
            exportPricebook(exportData, options, filename);
          }
          break;
      }

      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const getExportPreview = () => {
    const activeServices = services.filter(s => s?.active).length;
    const inactiveServices = services.length - activeServices;
    const activeMaterials = materials.filter(m => m?.active).length;
    const inactiveMaterials = materials.length - activeMaterials;

    let itemCount = 0;
    let description = '';

    switch (exportType) {
      case 'services':
        itemCount = includeInactive ? services.length : activeServices;
        description = `${itemCount} service${itemCount !== 1 ? 's' : ''}`;
        break;
      case 'materials':
        itemCount = includeInactive ? materials.length : activeMaterials;
        description = `${itemCount} material${itemCount !== 1 ? 's' : ''}`;
        break;
      case 'all':
      default:
        const totalServices = includeInactive ? services.length : activeServices;
        const totalMaterials = includeInactive ? materials.length : activeMaterials;
        itemCount = totalServices + totalMaterials;
        description = `${totalServices} services, ${totalMaterials} materials`;
        break;
    }

    return { itemCount, description };
  };

  if (!isOpen) return null;

  const preview = getExportPreview();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg mr-3">
              <FileSpreadsheet size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Export Pricebook</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Export your pricebook data to Excel format</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Export Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              What would you like to export?
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setExportType('all')}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  exportType === 'all'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                }`}
              >
                <div className="font-medium text-gray-800 dark:text-gray-200">Complete Pricebook</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Services & Materials</div>
              </button>
              <button
                onClick={() => setExportType('services')}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  exportType === 'services'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                }`}
              >
                <div className="font-medium text-gray-800 dark:text-gray-200">Services Only</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{services.length} items</div>
              </button>
              <button
                onClick={() => setExportType('materials')}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  exportType === 'materials'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                }`}
              >
                <div className="font-medium text-gray-800 dark:text-gray-200">Materials Only</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{materials.length} items</div>
              </button>
            </div>
          </div>

          {/* Target Software Selection */}
          {exportType === 'all' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Export Format
              </label>
              <select
                value={targetSoftware}
                onChange={(e) => setTargetSoftware(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              >
                <option value="standard">Standard Excel Format</option>
                <option value="servicetitan">ServiceTitan Compatible</option>
                <option value="housecall">HouseCall Pro Compatible</option>
                <option value="jobber">Jobber Compatible</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Choose a format optimized for importing into specific field service software
              </p>
            </div>
          )}

          {/* Export Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Export Options</span>
              <Settings size={16} className="text-gray-400" />
            </div>

            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Include inactive items</span>
              </label>

              {targetSoftware === 'standard' && (
                <>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={separateSheets}
                      onChange={(e) => setSeparateSheets(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Use separate sheets for services and materials</span>
                  </label>

                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Detail Level</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="format"
                          value="simple"
                          checked={format === 'simple'}
                          onChange={(e) => setFormat(e.target.value as 'simple' | 'detailed')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Simple (basic fields only)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="format"
                          value="detailed"
                          checked={format === 'detailed'}
                          onChange={(e) => setFormat(e.target.value as 'simple' | 'detailed')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Detailed (all fields)</span>
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Custom Filename */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Filename (optional)
            </label>
            <input
              type="text"
              value={customFilename}
              onChange={(e) => setCustomFilename(e.target.value)}
              placeholder="Leave blank for auto-generated name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
            />
          </div>

          {/* Export Preview */}
          <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <Info size={16} className="text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Export Preview</span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>Will export: <span className="font-medium text-gray-800 dark:text-gray-200">{preview.description}</span></p>
              <p>Total items: <span className="font-medium text-gray-800 dark:text-gray-200">{preview.itemCount}</span></p>
              <p>Categories: <span className="font-medium text-gray-800 dark:text-gray-200">{categories.length}</span></p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleExport}
            disabled={isExporting || exportSuccess}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Exporting...
              </>
            ) : exportSuccess ? (
              <>
                <CheckCircle size={16} className="mr-2" />
                Exported!
              </>
            ) : (
              <>
                <Download size={16} className="mr-2" />
                Export to Excel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PricebookExportModal;