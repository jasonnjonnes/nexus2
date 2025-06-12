import React, { useState, ChangeEvent, useEffect } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { parseFile, generateTemplate, mapImportedData, ImportedItem, processServiceTitanServicesSheet, processServiceTitanMaterialsSheet, processServiceTitanEquipmentSheet, processServiceMaterialLinksSheet, processServiceEquipmentLinksSheet, processEquipmentMaterialLinksSheet } from '../utils/pricebookImport';
import * as XLSX from 'xlsx';

export interface PricebookImportExportProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (data: ImportedItem[]) => void;
  importSource?: string | null;
  initialStep?: 'upload' | 'map' | 'preview' | 'upload-materials' | 'preview-materials';
  onNext?: (data: ImportedItem[]) => void;
  isEquipmentImport?: boolean;
  linkImportType?: 'service-material' | 'service-equipment' | 'equipment-material';
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

const SERVICETITAN_FIELDS = [
  'categories', 'id', 'code', 'name', 'description', 'warrantyDescription', 'useStaticPrice', 'dynamicPrice', 'staticPrice', 'staticMemberPrice', 'staticAddOnPrice', 'staticMemberAddOnPrice', 'generalLedgerAccount', 'expenseAccount', 'recommendations', 'paysCommission', 'paySpecificTechBonus', 'taxable', 'laborService', 'hours', 'estimatedLaborCost', 'allowDiscounts', 'allowMembershipDiscounts', 'dollarBonus', 'bonusPercentage', 'active', 'materialCost', 'materialCount'
];

const PricebookImportExport: React.FC<PricebookImportExportProps> = ({ isOpen, onClose, onImportComplete, importSource, initialStep, onNext, isEquipmentImport, linkImportType }) => {
  console.log('PricebookImportExport initialStep:', initialStep);
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'upload-materials' | 'preview-materials'>(initialStep || 'upload');
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
  const [showManualMap, setShowManualMap] = useState(false);
  const [serviceTitanPreview, setServiceTitanPreview] = useState<any[]>([]);
  const [materialPreview, setMaterialPreview] = useState<any[]>([]);

  const resetState = () => {
    setStep(initialStep || 'upload');
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

  useEffect(() => {
    console.log('PricebookImportExport step:', step);
    if (isOpen) {
      setStep(initialStep || 'upload');
      resetState();
    }
    // eslint-disable-next-line
  }, [isOpen, initialStep]);

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

  const handleServiceTitanFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setErrors([]);
    setFile(file);
    try {
      const data = await file.arrayBuffer();
      const workbook = await XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets['Services'];
      if (!sheet) {
        setErrors(['No Services sheet found!']);
        setIsLoading(false);
        return;
      }
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
      const headers: string[] = (rawData[0] as unknown[]).map((cell: unknown) => String(cell || ''));
      const rows: any[][] = rawData.slice(1) as any[][];
      const processed = processServiceTitanServicesSheet(rows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]]))));
      setServiceTitanPreview(processed);
      setStep('preview');
    } catch (error) {
      setErrors(['Failed to parse file.']);
    }
    setIsLoading(false);
  };

  const handleServiceTitanMaterialFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setErrors([]);
    setFile(file);
    try {
      const data = await file.arrayBuffer();
      const workbook = await XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets['Materials'];
      if (!sheet) {
        setErrors(['No Materials sheet found!']);
        setIsLoading(false);
        return;
      }
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
      const headers: string[] = (rawData[0] as unknown[]).map((cell: unknown) => String(cell || ''));
      const rows: any[][] = rawData.slice(1) as any[][];
      const processed = processServiceTitanMaterialsSheet(rows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]]))));
      setMaterialPreview(processed);
      setStep('preview-materials');
    } catch (error) {
      setErrors(['Failed to parse file.']);
    }
    setIsLoading(false);
  };

  const handleServiceTitanEquipmentFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setErrors([]);
    setFile(file);
    try {
      const data = await file.arrayBuffer();
      const workbook = await XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets['Equipment'];
      if (!sheet) {
        setErrors(['No Equipment sheet found!']);
        setIsLoading(false);
        return;
      }
      // Build service category map from Categories sheet
      const categoriesSheet = workbook.Sheets['Categories'] || workbook.Sheets['Category'];
      let serviceCategoryMap: { [id: string]: boolean } = {};
      if (categoriesSheet) {
        const rawData = XLSX.utils.sheet_to_json(categoriesSheet, { header: 1, defval: null }) as unknown[][];
        const headers: string[] = (rawData[0] as unknown[]).map((cell: unknown) => String(cell || ''));
        const rows: any[][] = rawData.slice(1) as any[][];
        const idIndex = headers.findIndex(h => h && h.trim().toLowerCase() === 'id' || h && h.trim().toLowerCase() === 'category id');
        const typeIndex = headers.findIndex(h => h && h.trim().toLowerCase() === 'type' || h && h.trim().toLowerCase() === 'categorytype');
        if (idIndex !== -1 && typeIndex !== -1) {
          rows.forEach(row => {
            const id = String(row[idIndex]).trim();
            const type = String(row[typeIndex]).trim().toLowerCase();
            if (id && type === 'service') serviceCategoryMap[id] = true;
          });
        }
      }
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
      const headers: string[] = (rawData[0] as unknown[]).map((cell: unknown) => String(cell || ''));
      const rows: any[][] = rawData.slice(1) as any[][];
      // Debug: log the map and each equipment row's category id
      rows.forEach(row => {
        const rawCategoryId = String(row[headers.findIndex(h => h.toLowerCase() === 'category.id' || h.toLowerCase() === 'categoryid' || h.toLowerCase() === 'category id')] || '').trim();
        console.log('Equipment row Category.Id:', rawCategoryId, 'Map has:', serviceCategoryMap[rawCategoryId], 'Full map:', serviceCategoryMap);
      });
      const processed = processServiceTitanEquipmentSheet(
        rows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]])))
      );
      setMaterialPreview(processed);
      setStep('preview-materials');
    } catch (error) {
      setErrors(['Failed to parse file.']);
    }
    setIsLoading(false);
  };

  // --- LINK IMPORT LOGIC ---
  useEffect(() => {
    if (linkImportType && file && step === 'upload') {
      setIsLoading(true);
      parseFile(file).then((sheets: any) => {
        let processed: any[] = [];
        if (linkImportType === 'service-material') {
          processed = processServiceMaterialLinksSheet(sheets['ServiceMaterialLinks']?.data || []);
        } else if (linkImportType === 'service-equipment') {
          processed = processServiceEquipmentLinksSheet(sheets['ServiceEquipmentLinks']?.data || []);
        } else if (linkImportType === 'equipment-material') {
          processed = processEquipmentMaterialLinksSheet(sheets['EquipmentMaterialLinks']?.data || []);
        }
        setParsedData(processed);
        setStep('preview');
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    }
    // eslint-disable-next-line
  }, [linkImportType, file, step]);

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

          {/* File Upload (always render for ServiceTitan step 3) */}
          {importSource === 'servicetitan' && (step === 'upload' || step === 'preview') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload XLSX
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-slate-600 border-dashed rounded-lg">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 dark:text-gray-400">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-slate-800 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none">
                      <span>Upload a file</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".xlsx" onChange={handleServiceTitanFileUpload} disabled={isLoading} />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">XLSX up to 10MB</p>
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
                          {destinationFields.map(destField => {
                            // Only allow a destination field to be selected if:
                            // 1. It is not already mapped to another source field, or
                            // 2. It is currently mapped to this source field
                            const isMappedElsewhere = Object.entries(fieldMaps['ALL'] || {}).some(
                              ([src, dst]) => dst === destField && src !== field
                            );
                            return (
                              <option
                                key={destField}
                                value={destField}
                                disabled={isMappedElsewhere}
                              >
                                {destField}
                              </option>
                            );
                          })}
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
          {importSource === 'servicetitan' && step === 'preview' && (
            <div>
              <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
                Something not look quite right?{' '}
                <button className="underline text-blue-600" onClick={() => setShowManualMap(true)}>
                  Click here to manually map.
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-600">
                  <thead>
                    <tr>
                      {SERVICETITAN_FIELDS.map(field => (
                        <th key={field} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {field === 'categories' ? 'CATEGORIES' : field.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
                    {serviceTitanPreview.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {SERVICETITAN_FIELDS.map(destField => (
                          <td key={`${rowIndex}-${destField}`} className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                            {destField === 'categories'
                              ? (Array.isArray(row.categories) && row.categories.length > 0
                                  ? row.categories.join(', ')
                                  : '—')
                              : String(row[destField] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {serviceTitanPreview.length > 5 && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Showing 5 of {serviceTitanPreview.length} rows</p>
                )}
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => setStep('upload')} className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700">Back</button>
                <button onClick={() => onNext?.(serviceTitanPreview)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700" disabled={isLoading}>Next</button>
              </div>
              {showManualMap && (
                <div className="mt-8">
                  {/* Mapping UI for only allowed fields */}
                  <h3 className="text-lg font-semibold mb-4">Manual Field Mapping (ServiceTitan Only)</h3>
                  {/* ...implement mapping UI for SERVICETITAN_FIELDS only... */}
                </div>
              )}
            </div>
          )}

          {/* File Upload for Materials (ServiceTitan step 4) */}
          {importSource === 'servicetitan' && step === 'upload-materials' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload XLSX ({isEquipmentImport ? 'Equipment' : 'Materials'})
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-slate-600 border-dashed rounded-lg">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 dark:text-gray-400">
                    <label htmlFor="file-upload-materials" className="relative cursor-pointer bg-white dark:bg-slate-800 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none">
                      <span>Upload a file</span>
                      <input id="file-upload-materials" name="file-upload-materials" type="file" className="sr-only" accept=".xlsx" onChange={isEquipmentImport ? handleServiceTitanEquipmentFileUpload : handleServiceTitanMaterialFileUpload} disabled={isLoading} />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">XLSX up to 10MB</p>
                </div>
              </div>
            </div>
          )}

          {/* Preview for Materials (ServiceTitan step 4) */}
          {importSource === 'servicetitan' && step === 'preview-materials' && (
            <div>
              <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
                Something not look quite right?{' '}
                <button className="underline text-blue-600" onClick={() => setShowManualMap(true)}>
                  Click here to manually map.
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-600">
                  <thead>
                    <tr>
                      {Object.keys(materialPreview[0] || {}).map(field => (
                        <th key={field} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{field}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
                    {materialPreview.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {Object.keys(materialPreview[0] || {}).map(destField => (
                          <td key={`${rowIndex}-${destField}`} className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{typeof row[destField] === 'object' ? JSON.stringify(row[destField]) : String(row[destField] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {materialPreview.length > 5 && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Showing 5 of {materialPreview.length} rows</p>
                )}
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => setStep('upload-materials')} className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700">Back</button>
                <button onClick={() => onNext?.(materialPreview)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700" disabled={isLoading}>Next</button>
              </div>
              {showManualMap && (
                <div className="mt-8">
                  {/* Mapping UI for only allowed fields */}
                  <h3 className="text-lg font-semibold mb-4">Manual Field Mapping (ServiceTitan Materials Only)</h3>
                  {/* ...implement mapping UI for material fields only... */}
                </div>
              )}
            </div>
          )}

          {/* LINK IMPORT UI */}
          {linkImportType && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold">Import {linkImportType === 'service-material' ? 'Service-Material' : linkImportType === 'service-equipment' ? 'Service-Equipment' : 'Equipment-Material'} Links</h2>
                  <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"><X size={18} /></button>
                </div>
                {step === 'upload' && (
                  <div>
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={e => setFile(e.target.files?.[0] || null)} className="mb-4" />
                    <button disabled={!file} onClick={() => setStep('preview')} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">Next</button>
                  </div>
                )}
                {step === 'preview' && (
                  <div>
                    <div className="mb-4 max-h-64 overflow-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr>
                            {parsedData[0] && Object.keys(parsedData[0]).map(h => <th key={h} className="px-2 py-1 text-left font-semibold">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {parsedData.map((row, i) => (
                            <tr key={i} className="border-t">
                              {Object.values(row).map((v, j) => <td key={j} className="px-2 py-1">{String(v)}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button onClick={() => { onImportComplete?.(parsedData); onNext?.(parsedData); onClose(); }} className="px-4 py-2 bg-green-600 text-white rounded">Confirm & Import</button>
                    <button onClick={onClose} className="ml-2 px-4 py-2 border rounded">Cancel</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PricebookImportExport; 
