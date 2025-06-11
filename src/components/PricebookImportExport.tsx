import React, { useState, ChangeEvent } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { parseFile, generateTemplate, mapImportedData, ImportedItem } from '../utils/pricebookImport';

export interface PricebookImportExportProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (data: ImportedItem[]) => void;
}

const destinationFields = [
  // Required fields
  'Name',
  'Price',
  // Category fields (at least one required)
  'Category ID',
  'Id',
  'Category 1',
  'Category 2',
  'Category 3',
  'Category 4',
  'Category 5',
  'Category 6',
  'Category 7',
  'Category 8',
  'Category 9',
  'Category 10',
  // Optional fields
  'Code',
  'Description',
  'Item Description',
  'Warranty Description',
  'Cost',
  'Estimated Labor Cost',
  'Unit',
  'Taxable',
  'Active',
  'Allow Discounts',
  'Allow Membership Discounts',
  'Labor Service',
  'Exclude From Pricebook Wizard',
  'Use Dynamic Pricing',
  'Static Price',
  'Static Member Price',
  'Static Add-On Price',
  'Static Member Add-On Price',
  'Cross Sale Group',
  'General Ledger Account',
  'Expense Account',
  'Commission Percentage',
  'Bonus Percentage',
  'Pay Tech Specific Bonus',
  'Pays Commission',
  'Tags',
  'hours',
];

// Enhanced normalization for automap
function normalizeField(str: string): string {
  return str
    .toLowerCase()
    .replace(/category[ ._-]?/g, '')
    .replace(/service[ ._-]?/g, '')
    .replace(/material[ ._-]?/g, '')
    .replace(/equipment[ ._-]?/g, '')
    .replace(/variant[ ._-]?/g, '')
    .replace(/recommendations[ ._-]?/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Expanded synonyms for automap
const FIELD_SYNONYMS: { [key: string]: string[] } = {
  name: ['name', 'itemname', 'servicename', 'materialname', 'categoryname', 'variantname', 'alias'],
  code: ['code', 'itemcode', 'servicecode', 'materialcode', 'categorycode', 'variantcode', 'sku', 'skuid', 'skucode'],
  description: ['description', 'desc', 'itemdescription', 'servicedescription', 'materialdescription', 'warrantydescription'],
  price: ['price', 'amount', 'staticprice', 'dynamicprice', 'priceruleid', 'pricerulename', 'memberprice', 'addonprice', 'addonmemberprice'],
  id: ['id', 'itemid', 'serviceid', 'materialid', 'categoryid', 'variantid', 'externalid'],
  categoryid: ['categoryid', 'catid'],
  hours: ['hours', 'laborhours', 'time'],
  cost: ['cost', 'costofsaleaccount', 'materialcost'],
  unit: ['unit', 'unitofmeasure'],
  active: ['active'],
  taxable: ['taxable'],
  supplier: ['supplier', 'suppliercatalog'],
  manufacturer: ['manufacturer', 'brand'],
  model: ['model'],
  upgrades: ['upgrades'],
  recommendations: ['recommendations', 'recommendationsservices', 'recommendationsmaterials'],
  bonus: ['bonus', 'bonuspct', 'bonuspercentage', 'bonusdollar', 'bonusdollars', 'bonusamount', '%bonus', '$bonus'],
  commission: ['commission', 'commissionpercentage', 'payscommission'],
  paytechspecificbonus: ['paytechspecificbonus'],
  allowdiscounts: ['allowdiscounts'],
  allowmembershipdiscounts: ['allowmembershipdiscounts'],
  laborservice: ['laborservice', 'islabor'],
  exclude: ['excludefrompricebookwizard'],
  crosssale: ['crosssale', 'crosssalegroup'],
  generalledger: ['generalledger', 'generalledgeraccount'],
  expense: ['expense', 'expenseaccount'],
  tags: ['tags'],
  estimatedlaborcost: ['estimatedlaborcost'],
  // Add more as needed
};

function automapFields(incoming: string[], destination: string[]): { [key: string]: string } {
  const mapping: { [key: string]: string } = {};
  const destNormalized = destination.map(f => normalizeField(f));
  incoming.forEach(inField => {
    const inNorm = normalizeField(inField);
    // 1. Exact normalized match
    let idx = destNormalized.indexOf(inNorm);
    if (idx !== -1) {
      mapping[inField] = destination[idx];
      return;
    }
    // 2. Synonym match
    for (let destIdx = 0; destIdx < destination.length; destIdx++) {
      const dest = destination[destIdx];
      const destNorm = destNormalized[destIdx];
      const synonyms = FIELD_SYNONYMS[destNorm] || [];
      if (synonyms.includes(inNorm)) {
        mapping[inField] = dest;
        return;
      }
    }
    // 3. Partial match (normalized)
    for (let destIdx = 0; destIdx < destination.length; destIdx++) {
      const destNorm = destNormalized[destIdx];
      if (inNorm.startsWith(destNorm) || destNorm.startsWith(inNorm)) {
        mapping[inField] = destination[destIdx];
        return;
      }
    }
    // 4. No match
    mapping[inField] = '';
  });
  return mapping;
}

const PricebookImportExport: React.FC<PricebookImportExportProps> = ({ isOpen, onClose, onImportComplete }) => {
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [incomingFields, setIncomingFields] = useState<string[]>([]);
  const [fieldMaps, setFieldMaps] = useState<{ [sheet: string]: { [key: string]: string } }>({});
  const [parsedData, setParsedData] = useState<ImportedItem[]>([]);
  const [mappedData, setMappedData] = useState<ImportedItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [allSheets, setAllSheets] = useState<{ [sheet: string]: { headers: string[]; data: any[] } }>({});
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setIncomingFields([]);
    setFieldMaps({});
    setParsedData([]);
    setMappedData([]);
    setErrors([]);
    setImportSuccess(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Handle file upload and parsing
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrors([]);
    setFile(file);

    try {
      console.log('Starting file parse...');
      const result = await parseFile(file);
      // Remove Categories sheet from the result
      const filteredSheets = Object.fromEntries(
        Object.entries(result).filter(([sheetName]) => sheetName.toLowerCase() !== 'categories' && sheetName.toLowerCase() !== 'category')
      ) as { [sheet: string]: { headers: string[]; data: any[] } };
      setAllSheets(filteredSheets);
      const sheetNames = Object.keys(filteredSheets);
      // Combine all non-category sheets into one dataset for mapping
      const combinedHeaders: string[] = Array.from(new Set(sheetNames.flatMap(sheet => filteredSheets[sheet].headers)));
      const combinedData: any[] = sheetNames.flatMap(sheet => (filteredSheets[sheet].data as any[]).map((row: any) => ({ ...row, _sheet: sheet })));
      setSelectedSheet('ALL');
      setIncomingFields(combinedHeaders);
      setParsedData(combinedData);
      setFieldMaps({ ALL: automapFields(combinedHeaders, destinationFields) });
      setStep('map');
    } catch (error: any) {
      console.error('Import error:', error);
      setErrors([`Failed to parse file: ${error?.message || 'Unknown error'}`]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle template download
  const handleDownloadTemplate = () => {
    generateTemplate();
  };

  // Handle field mapping change
  const handleFieldMapChange = (sourceField: string, destField: string) => {
    setFieldMaps(prev => {
      const newMaps = { ...prev };
      // Only one mapping for ALL combined data
      const currentMap = { ...(newMaps['ALL'] || {}) };
      if (destField) {
        currentMap[sourceField] = destField;
      } else {
        delete currentMap[sourceField];
      }
      newMaps['ALL'] = currentMap;
      return newMaps;
    });
  };

  // Handle import completion
  const handleImport = () => {
    console.log('Starting import with mapped data:', mappedData.slice(0, 2));
    onImportComplete?.(mappedData);
    setImportSuccess(true);
    setTimeout(() => {
      setImportSuccess(false);
      handleClose();
    }, 2000);
  };

  const handleContinueToPreview = () => {
    const mapped = mapImportedData(parsedData, fieldMaps['ALL'] || {});
    setMappedData(mapped);
    setStep('preview');
  };

  if (!isOpen) return null;

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
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Import/Export Pricebook</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Import or download a template for your pricebook</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Download Template */}
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors mb-4"
          >
            <Download className="mr-2" size={18} />
            Download Template
          </button>

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="text-red-500 mt-0.5 mr-2" size={18} />
                <div>
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200">Import Errors</h4>
                  <ul className="mt-2 text-sm text-red-700 dark:text-red-300 list-disc list-inside">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {importSuccess && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="text-green-500 mr-2" size={18} />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Import completed successfully!
                </span>
              </div>
            </div>
          )}

          {/* File Upload */}
          {step === 'upload' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload XLSX or CSV
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-slate-600 border-dashed rounded-lg">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 dark:text-gray-400">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white dark:bg-slate-800 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none"
                    >
                      <span>Upload a file</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        accept=".xlsx,.csv"
                        onChange={handleFileUpload}
                        disabled={isLoading}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    XLSX or CSV up to 10MB
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Field Mapping */}
          {step === 'map' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Map Fields</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Incoming Fields</h4>
                  <div className="space-y-2">
                    {incomingFields.map(field => (
                      <div key={field} className="flex items-center space-x-2">
                        <select
                          value={fieldMaps['ALL'] && fieldMaps['ALL'][field] || ''}
                          onChange={(e) => handleFieldMapChange(field, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                        >
                          <option value="">-- Select Field --</option>
                          {destinationFields.map(destField => (
                            <option
                              key={destField}
                              value={destField}
                              disabled={Object.values(fieldMaps['ALL'] || {}).includes(destField) && fieldMaps['ALL'][field] !== destField}
                            >
                              {destField}
                            </option>
                          ))}
                        </select>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{field}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Destination Fields</h4>
                  <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                    <ul className="space-y-2">
                      {destinationFields.map(field => (
                        <li
                          key={field}
                          className={`py-1 px-2 rounded ${
                            Object.values(fieldMaps['ALL'] || {}).includes(field)
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {field}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Back
                </button>
                <button
                  onClick={handleContinueToPreview}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={Object.keys(fieldMaps['ALL'] || {}).length === 0}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Preview */}
          {step === 'preview' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Preview Import</h3>
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-600">
                  <thead>
                    <tr>
                      {destinationFields
                        .filter(field => Object.values(fieldMaps['ALL'] || {}).includes(field))
                        .map(field => (
                        <th
                          key={field}
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          {field}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
                    {mappedData.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {destinationFields
                          .filter(field => Object.values(fieldMaps['ALL'] || {}).includes(field))
                          .map(destField => (
                          <td
                            key={`${rowIndex}-${destField}`}
                            className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                          >
                            {String(row[destField] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mappedData.length > 5 && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Showing 5 of {mappedData.length} rows
                  </p>
                )}
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setStep('map')}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  disabled={isLoading}
                >
                  {isLoading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PricebookImportExport; 
