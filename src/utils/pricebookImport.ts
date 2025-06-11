import * as XLSX from 'xlsx';

// Types for import data
export interface ImportedItem {
  [key: string]: any;
}

export interface ImportOptions {
  skipRows?: number;
  sheetName?: string;
  validateData?: boolean;
  skipHeaderRows?: number;
}

export interface ImportResult {
  data: any[];
  errors: string[];
  warnings: string[];
  headers?: string[];  // Make headers optional
}

// Helper function to read file as ArrayBuffer
const readFile = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

// Define the category structure from ServiceTitan
interface ServiceTitanCategory {
  'Category ID': string;
  'Category 1'?: string;
  'Category 2'?: string;
  'Category 3'?: string;
  'Description'?: string;
  'Active'?: boolean;
}

// Define the base item structure from ServiceTitan
interface ServiceTitanBaseItem {
  'Category ID'?: string;
  'Category 1'?: string;
  'Category 2'?: string;
  'Category 3'?: string;
  'Name': string;
  'Code'?: string;
  'Description'?: string;
  'Active'?: boolean;
  'Taxable'?: boolean;
  'Allow Discounts'?: boolean;
  'Allow Membership Discounts'?: boolean;
  'Use Static Price'?: boolean;  // Changed from Use Dynamic Pricing
  'Static Price'?: number;
  'Static Member Price'?: number;
  'Static Add-On Price'?: number;
  'Static Member Add-On Price'?: number;
  'Cross Sale Group'?: string;
  'General Ledger Account'?: string;
  'Expense Account'?: string;
  'Commission Percentage'?: number;
  'Bonus Percentage'?: number;
  'Pay Tech Specific Bonus'?: boolean;
  'Pays Commission'?: boolean;
  'Tags'?: string;
}

// Define sheet types and their required fields
interface SheetConfig {
  requiredFields: string[];
  optionalFields: string[];
  validateRow: (row: any, rowIndex: number, categories: Map<string, ServiceTitanCategoryMapping>) => string[];
  transformRow?: (row: any, categories: Map<string, ServiceTitanCategoryMapping>) => any;
}

// Define the sheet configurations
const SHEET_CONFIGS: { [key: string]: SheetConfig } = {
  'Categories': {
    requiredFields: ['Category ID'],
    optionalFields: ['Category 1', 'Category 2', 'Category 3', 'Description', 'Active', 'Exclude From Pricebook Wizard'],
    validateRow: (row, index) => {
      const errors: string[] = [];
      if (!row['Category ID']) {
        errors.push(`Row ${index + 2}: Missing required field "Category ID"`);
      }
      return errors;
    },
    transformRow: (row) => {
      const transformed = { ...row };
      // Normalize boolean fields
      if (transformed['Active'] !== undefined) {
        transformed['Active'] = ['yes', 'true', '1'].includes(String(transformed['Active']).toLowerCase());
      }
      if (transformed['Exclude From Pricebook Wizard'] !== undefined) {
        transformed['Exclude From Pricebook Wizard'] = ['yes', 'true', '1'].includes(String(transformed['Exclude From Pricebook Wizard']).toLowerCase());
      }
      return transformed;
    }
  },
  'Services': {
    requiredFields: ['Name'],
    optionalFields: [
      'Category ID', 'Category 1', 'Category 2', 'Category 3',
      'Code', 'Description', 'Warranty Description', 'Cost', 'Estimated Labor Cost',
      'Unit', 'Taxable', 'Active', 'Hours', 'Allow Discounts', 'Allow Membership Discounts',
      'Labor Service', 'Exclude From Pricebook Wizard', 'Use Static Price',
      'Static Price', 'Static Member Price', 'Static Add-On Price', 'Static Member Add-On Price',
      'Cross Sale Group', 'General Ledger Account', 'Expense Account',
      'Commission Percentage', 'Bonus Percentage', 'Pay Tech Specific Bonus', 'Pays Commission',
      'Tags', 'hours'
    ],
    validateRow: (row, index, categories) => {
      const errors: string[] = [];
      if (!row.Name) {
        errors.push(`Row ${index + 2}: Missing required field "Name"`);
      }
      
      // Validate category reference if provided
      if (row['Category ID'] && !categories.has(row['Category ID'])) {
        errors.push(`Row ${index + 2}: Invalid Category ID "${row['Category ID']}" - not found in Categories sheet`);
      }

      // Validate pricing
      const useStaticPrice = row['Use Static Price'] === true || row['Use Static Price'] === 1 || row['Use Static Price'] === '1' || row['Use Static Price']?.toLowerCase() === 'yes';
      if (useStaticPrice && (!row['Static Price'] || isNaN(Number(row['Static Price'])) || Number(row['Static Price']) < 0)) {
        errors.push(`Row ${index + 2}: Invalid or missing "Static Price" value when Use Static Price is enabled`);
      }
      
      return errors;
    },
    transformRow: (row, categories) => {
      const transformed = { ...row };
      
      // Handle category mapping
      if (row['Category ID'] && categories.has(row['Category ID'])) {
        const category = categories.get(row['Category ID'])!;
        const levels = getCategoryLevels(category.path);
        transformed['Category 1'] = levels['Category 1'];
        transformed['Category 2'] = levels['Category 2'];
        transformed['Category 3'] = levels['Category 3'];
      }

      // Handle pricing
      const useStaticPrice = row['Use Static Price'] === true || row['Use Static Price'] === 1 || row['Use Static Price'] === '1' || row['Use Static Price']?.toLowerCase() === 'yes';
      if (useStaticPrice) {
        transformed['Price'] = Number(row['Static Price']);
        transformed['Use Dynamic Pricing'] = false;
      } else {
        transformed['Use Dynamic Pricing'] = true;
        const basePrice = Number(row['Static Price']) || 0;
        transformed['Price'] = basePrice;
      }

      // Normalize boolean fields
      const booleanFields = [
        'Taxable', 'Active', 'Allow Discounts', 'Allow Membership Discounts',
        'Labor Service', 'Exclude From Pricebook Wizard', 'Use Static Price',
        'Pay Tech Specific Bonus', 'Pays Commission'
      ];
      booleanFields.forEach(field => {
        if (transformed[field] !== undefined) {
          transformed[field] = ['yes', 'true', '1'].includes(String(transformed[field]).toLowerCase());
        }
      });

      // Normalize numeric fields
      const numericFields = [
        'Static Price', 'Static Member Price', 'Static Add-On Price', 'Static Member Add-On Price',
        'Cost', 'Estimated Labor Cost', 'Hours', 'Commission Percentage', 'Bonus Percentage'
      ];
      numericFields.forEach(field => {
        if (transformed[field] !== undefined) {
          transformed[field] = Number(transformed[field]) || 0;
        }
      });

      // Map 'Hours' field
      if (row['Hours'] !== undefined) {
        transformed['hours'] = Number(row['Hours']) || 0;
      }

      return transformed;
    }
  },
  'Materials': {
    requiredFields: ['Name'],
    optionalFields: [
      'Category ID', 'Category 1', 'Category 2', 'Category 3',
      'Code', 'Description', 'Cost', 'Unit', 'Taxable', 'Active',
      'Stock Quantity', 'Reorder Point', 'Allow Discounts', 'Allow Membership Discounts',
      'Use Static Price', 'Static Price', 'Static Member Price',
      'Static Add-On Price', 'Static Member Add-On Price', 'Cross Sale Group',
      'General Ledger Account', 'Expense Account', 'Commission Percentage',
      'Bonus Percentage', 'Pay Tech Specific Bonus', 'Pays Commission', 'Tags'
    ],
    validateRow: (row, index, categories) => {
      const errors: string[] = [];
      if (!row.Name) {
        errors.push(`Row ${index + 2}: Missing required field "Name"`);
      }
      
      // Validate category reference if provided
      if (row['Category ID'] && !categories.has(row['Category ID'])) {
        errors.push(`Row ${index + 2}: Invalid Category ID "${row['Category ID']}" - not found in Categories sheet`);
      }

      // Validate pricing
      const useStaticPrice = row['Use Static Price'] === true || row['Use Static Price'] === 1 || row['Use Static Price'] === '1' || row['Use Static Price']?.toLowerCase() === 'yes';
      if (useStaticPrice && (!row['Static Price'] || isNaN(Number(row['Static Price'])) || Number(row['Static Price']) < 0)) {
        errors.push(`Row ${index + 2}: Invalid or missing "Static Price" value when Use Static Price is enabled`);
      }
      
      return errors;
    },
    transformRow: (row, categories) => {
      const transformed = { ...row };
      
      // Handle category mapping
      if (row['Category ID'] && categories.has(row['Category ID'])) {
        const category = categories.get(row['Category ID'])!;
        const levels = getCategoryLevels(category.path);
        transformed['Category 1'] = levels['Category 1'];
        transformed['Category 2'] = levels['Category 2'];
        transformed['Category 3'] = levels['Category 3'];
      }

      // Handle pricing
      const useStaticPrice = row['Use Static Price'] === true || row['Use Static Price'] === 1 || row['Use Static Price'] === '1' || row['Use Static Price']?.toLowerCase() === 'yes';
      if (useStaticPrice) {
        transformed['Price'] = Number(row['Static Price']);
        transformed['Use Dynamic Pricing'] = false;
      } else {
        transformed['Use Dynamic Pricing'] = true;
        const basePrice = Number(row['Static Price']) || 0;
        transformed['Price'] = basePrice;
      }

      // Normalize boolean fields
      const booleanFields = [
        'Taxable', 'Active', 'Allow Discounts', 'Allow Membership Discounts',
        'Use Static Price', 'Pay Tech Specific Bonus', 'Pays Commission'
      ];
      booleanFields.forEach(field => {
        if (transformed[field] !== undefined) {
          transformed[field] = ['yes', 'true', '1'].includes(String(transformed[field]).toLowerCase());
        }
      });

      // Normalize numeric fields
      const numericFields = [
        'Static Price', 'Static Member Price', 'Static Add-On Price', 'Static Member Add-On Price',
        'Cost', 'Stock Quantity', 'Reorder Point', 'Commission Percentage', 'Bonus Percentage'
      ];
      numericFields.forEach(field => {
        if (transformed[field] !== undefined) {
          transformed[field] = Number(transformed[field]) || 0;
        }
      });

      return transformed;
    }
  },
  'Equipment': {
    requiredFields: ['Name'],
    optionalFields: [
      'Category ID', 'Category 1', 'Category 2', 'Category 3',
      'Code', 'Description', 'Serial Number', 'Model Number', 'Manufacturer',
      'Purchase Date', 'Warranty Expiration', 'Location', 'Status', 'Active',
      'Tags'
    ],
    validateRow: (row, index, categories) => {
      const errors: string[] = [];
      if (!row.Name) {
        errors.push(`Row ${index + 2}: Missing required field "Name"`);
      }
      
      // Validate category reference if provided
      if (row['Category ID'] && !categories.has(row['Category ID'])) {
        errors.push(`Row ${index + 2}: Invalid Category ID "${row['Category ID']}" - not found in Categories sheet`);
      }
      
      return errors;
    },
    transformRow: (row, categories) => {
      const transformed = { ...row };
      
      // Handle category mapping
      if (row['Category ID'] && categories.has(row['Category ID'])) {
        const category = categories.get(row['Category ID'])!;
        const levels = getCategoryLevels(category.path);
        transformed['Category 1'] = levels['Category 1'];
        transformed['Category 2'] = levels['Category 2'];
        transformed['Category 3'] = levels['Category 3'];
      }

      // Normalize boolean fields
      const booleanFields = ['Active'];
      booleanFields.forEach(field => {
        if (transformed[field] !== undefined) {
          transformed[field] = ['yes', 'true', '1'].includes(String(transformed[field]).toLowerCase());
        }
      });

      return transformed;
    }
  }
};

// Define ServiceTitan category mapping
interface ServiceTitanCategoryMapping {
  id: string;
  name: string;
  type: 'service' | 'material' | 'equipment' | 'discount' | 'fee';
  parentId?: string;
  path: string[];
  description?: string;
  isActive: boolean;
  isExcludedFromPricebookWizard: boolean;
}

// ServiceTitan's standard category structure
export const SERVICETITAN_CATEGORY_MAPPING: ServiceTitanCategoryMapping[] = [
  // Services Categories
  { id: 'SVC-ROOT', name: 'Services', type: 'service', path: ['Services'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'SVC-PM', name: 'Preventive Maintenance', type: 'service', parentId: 'SVC-ROOT', path: ['Services', 'Preventive Maintenance'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'SVC-REP', name: 'Repairs', type: 'service', parentId: 'SVC-ROOT', path: ['Services', 'Repairs'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'SVC-INST', name: 'Installations', type: 'service', parentId: 'SVC-ROOT', path: ['Services', 'Installations'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'SVC-EMG', name: 'Emergency Services', type: 'service', parentId: 'SVC-ROOT', path: ['Services', 'Emergency Services'], isActive: true, isExcludedFromPricebookWizard: false },
  
  // Materials Categories
  { id: 'MAT-ROOT', name: 'Materials', type: 'material', path: ['Materials'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'MAT-PARTS', name: 'Parts', type: 'material', parentId: 'MAT-ROOT', path: ['Materials', 'Parts'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'MAT-SUP', name: 'Supplies', type: 'material', parentId: 'MAT-ROOT', path: ['Materials', 'Supplies'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'MAT-EQP', name: 'Equipment Parts', type: 'material', parentId: 'MAT-ROOT', path: ['Materials', 'Equipment Parts'], isActive: true, isExcludedFromPricebookWizard: false },
  
  // Equipment Categories
  { id: 'EQP-ROOT', name: 'Equipment', type: 'equipment', path: ['Equipment'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'EQP-RES', name: 'Residential', type: 'equipment', parentId: 'EQP-ROOT', path: ['Equipment', 'Residential'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'EQP-COM', name: 'Commercial', type: 'equipment', parentId: 'EQP-ROOT', path: ['Equipment', 'Commercial'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'EQP-INDUST', name: 'Industrial', type: 'equipment', parentId: 'EQP-ROOT', path: ['Equipment', 'Industrial'], isActive: true, isExcludedFromPricebookWizard: false },
  
  // Discount Categories
  { id: 'DISC-ROOT', name: 'Discounts', type: 'discount', path: ['Discounts'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'DISC-MEM', name: 'Membership Discounts', type: 'discount', parentId: 'DISC-ROOT', path: ['Discounts', 'Membership Discounts'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'DISC-PROMO', name: 'Promotional Discounts', type: 'discount', parentId: 'DISC-ROOT', path: ['Discounts', 'Promotional Discounts'], isActive: true, isExcludedFromPricebookWizard: false },
  
  // Fee Categories
  { id: 'FEE-ROOT', name: 'Fees', type: 'fee', path: ['Fees'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'FEE-SRV', name: 'Service Fees', type: 'fee', parentId: 'FEE-ROOT', path: ['Fees', 'Service Fees'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'FEE-TRIP', name: 'Trip Charges', type: 'fee', parentId: 'FEE-ROOT', path: ['Fees', 'Trip Charges'], isActive: true, isExcludedFromPricebookWizard: false },
  { id: 'FEE-LATE', name: 'Late Fees', type: 'fee', parentId: 'FEE-ROOT', path: ['Fees', 'Late Fees'], isActive: true, isExcludedFromPricebookWizard: false }
];

// Helper function to build category hierarchy
function buildCategoryHierarchy(categories: ServiceTitanCategoryMapping[]): Map<string, ServiceTitanCategoryMapping> {
  const categoryMap = new Map<string, ServiceTitanCategoryMapping>();
  
  // First pass: add all categories to map
  categories.forEach(category => {
    categoryMap.set(category.id, category);
  });
  
  // Second pass: build paths
  categories.forEach(category => {
    if (category.parentId) {
      const parent = categoryMap.get(category.parentId);
      if (parent) {
        category.path = [...parent.path, category.name];
      }
    }
  });
  
  return categoryMap;
}

// Helper function to get category levels from path
function getCategoryLevels(path: string[]): { 'Category 1': string, 'Category 2': string, 'Category 3': string } {
  return {
    'Category 1': path[0] || '',
    'Category 2': path[1] || '',
    'Category 3': path[2] || ''
  };
}

// Helper function to determine category type from path
function determineCategoryType(path: string[]): 'service' | 'material' | 'equipment' | 'discount' | 'fee' {
  const root = path[0]?.toLowerCase() || '';
  switch (root) {
    case 'services': return 'service';
    case 'materials': return 'material';
    case 'equipment': return 'equipment';
    case 'discounts': return 'discount';
    case 'fees': return 'fee';
    default: return 'service'; // Default to service if unknown
  }
}

// Helper function to generate category ID
function generateCategoryId(path: string[], type: 'service' | 'material' | 'equipment' | 'discount' | 'fee'): string {
  const prefix = {
    'service': 'SVC',
    'material': 'MAT',
    'equipment': 'EQP',
    'discount': 'DISC',
    'fee': 'FEE'
  }[type];

  // For root categories
  if (path.length === 1) {
    return `${prefix}-ROOT`;
  }

  // For subcategories, create a unique ID based on the path
  const suffix = path.slice(1).map(level => 
    level.split(/\s+/)
      .map(word => word.charAt(0).toUpperCase())
      .join('')
  ).join('-');

  return `${prefix}-${suffix}`;
}

// Helper function to find parent category
function findParentCategory(
  path: string[],
  categories: Map<string, ServiceTitanCategoryMapping>
): ServiceTitanCategoryMapping | undefined {
  if (path.length <= 1) return undefined;
  
  const parentPath = path.slice(0, -1);
  const parentId = generateCategoryId(parentPath, determineCategoryType(parentPath));
  return categories.get(parentId);
}

// Update the normalizeHeaders function to return headers as-is
const normalizeHeaders = (headers: string[]): string[] => headers;

// Add a helper to fill down parent category values for each row
function fillDownCategoryColumns(rows: unknown[][], headers: string[]): unknown[][] {
  const categoryCols: number[] = [];
  for (let i = 1; i <= 10; i++) {
    const colIdx = headers.indexOf(`Category${i}`);
    if (colIdx !== -1) categoryCols.push(colIdx);
  }
  let prev = Array(headers.length).fill('');
  return rows.map(row => {
    const newRow = [...row];
    categoryCols.forEach(idx => {
      if (!newRow[idx] || newRow[idx] === '') {
        newRow[idx] = prev[idx];
      }
    });
    prev = newRow;
    return newRow;
  });
}

// Update the parseFile function to use the new category processing
export const parseFile = async (file: File, options: ImportOptions = {}): Promise<any> => {
  try {
    const data = await readFile(file);
    const workbook = XLSX.read(data, { type: 'array' });
    const allSheets: Record<string, { headers: string[]; data: any[] }> = {};
    workbook.SheetNames.forEach(sheetName => {
      const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null }) as unknown[][];
      console.log(`Sheet: ${sheetName}, rawData:`, rawData);
      if (!rawData || rawData.length === 0 || !rawData[0]) return;
      const headers = rawData[0].map(cell => String(cell || ''));
      const rows = rawData.slice(1);
      const data = rows.map(row => {
        const item: any = {};
        headers.forEach((header, i) => {
          item[header] = row[i];
        });
        return item;
      });
      allSheets[sheetName] = { headers, data };
    });
    console.log('Parsed all sheets:', allSheets);
    return allSheets;
  } catch (error: any) {
    console.error('Parse error:', error);
    throw new Error(`Failed to parse file: ${error?.message || 'Unknown error'}`);
  }
};

// Update the generateTemplate function to show the pricing structure
export const generateTemplate = (): Blob => {
  const workbook = XLSX.utils.book_new();

  // Add README sheet
  const readmeData = [
    ['ServiceTitan Import Template'],
    [''],
    ['This template contains multiple sheets for different types of data:'],
    ['- Categories: Master list of categories with Category IDs'],
    ['- Services: Service items with Category ID references'],
    ['- Materials: Material items with Category ID references'],
    ['- Equipment: Equipment items with Category ID references'],
    [''],
    ['Required fields for each sheet:'],
    ['Categories: Category ID (and at least one category level)'],
    ['Services: Name (Category ID is optional)'],
    ['Materials: Name (Category ID is optional)'],
    ['Equipment: Name (Category ID is optional)'],
    [''],
    ['Category Structure:'],
    ['- Each category has a unique Category ID'],
    ['- Categories can have up to 3 levels (Category 1, 2, 3)'],
    ['- At least one category level must be provided'],
    ['- Items can optionally reference categories using their Category ID'],
    ['- Items without a Category ID will not appear in technician pricebooks'],
    [''],
    ['Pricing Structure:'],
    ['- Use Static Price: Set to Yes/1 to use Static Price, No/0 to use dynamic pricing'],
    ['- When Use Static Price is Yes:'],
    ['  * Static Price is used as the main price'],
    ['  * Dynamic pricing is disabled'],
    ['- When Use Static Price is No:'],
    ['  * Dynamic pricing is enabled'],
    ['  * Static Price is used as the base price for calculations'],
    [''],
    ['Note: When importing, the system will:'],
    ['1. First process the Categories sheet to build the category map'],
    ['2. Then process other sheets, validating Category ID references'],
    ['3. Automatically fill in category levels based on Category ID'],
    ['4. Transform pricing based on Use Static Price setting'],
    [''],
    ['Category Mapping:'],
    ['The system includes a standard set of ServiceTitan categories:'],
    [''],
    ['Services Categories:'],
    ...SERVICETITAN_CATEGORY_MAPPING
      .filter(cat => cat.type === 'service')
      .map(cat => [`- ${cat.id}: ${cat.path.join(' > ')}`]),
    [''],
    ['Materials Categories:'],
    ...SERVICETITAN_CATEGORY_MAPPING
      .filter(cat => cat.type === 'material')
      .map(cat => [`- ${cat.id}: ${cat.path.join(' > ')}`]),
    [''],
    ['Equipment Categories:'],
    ...SERVICETITAN_CATEGORY_MAPPING
      .filter(cat => cat.type === 'equipment')
      .map(cat => [`- ${cat.id}: ${cat.path.join(' > ')}`]),
    [''],
    ['Discount Categories:'],
    ...SERVICETITAN_CATEGORY_MAPPING
      .filter(cat => cat.type === 'discount')
      .map(cat => [`- ${cat.id}: ${cat.path.join(' > ')}`]),
    [''],
    ['Fee Categories:'],
    ...SERVICETITAN_CATEGORY_MAPPING
      .filter(cat => cat.type === 'fee')
      .map(cat => [`- ${cat.id}: ${cat.path.join(' > ')}`]),
    [''],
    ['When using these Category IDs:'],
    ['1. The system will automatically map to the correct category hierarchy'],
    ['2. You can override the standard categories by providing your own Category 1/2/3 values'],
    ['3. Items without a Category ID will not appear in technician pricebooks'],
    ['4. The system will validate that custom categories match the standard hierarchy']
  ];
  const readmeSheet = XLSX.utils.aoa_to_sheet(readmeData);
  XLSX.utils.book_append_sheet(workbook, readmeSheet, 'README');

  // Add Categories sheet
  const categoriesHeaders = ['Category ID', 'Category 1', 'Category 2', 'Category 3', 'Description', 'Active'];
  const categoriesData = [
    categoriesHeaders,
    ['CAT-001', 'Plumbing', 'Repair', 'Leaks', 'Plumbing leak repairs', 'Yes'],
    ['CAT-002', 'Plumbing', 'Installation', 'Fixtures', 'Plumbing fixture installation', 'Yes'],
    ['CAT-003', 'HVAC', 'Maintenance', 'Regular', 'Regular HVAC maintenance', 'Yes']
  ];
  const categoriesSheet = XLSX.utils.aoa_to_sheet(categoriesData);
  XLSX.utils.book_append_sheet(workbook, categoriesSheet, 'Categories');

  // Add example sheets
  Object.entries(SHEET_CONFIGS).forEach(([sheetName, config]) => {
    if (sheetName === 'Categories') return; // Skip Categories as it's already added
    
    const headers = [...config.requiredFields, ...config.optionalFields];
    const exampleData = [
      headers,
      // Add example row based on sheet type
      headers.map(header => {
        switch (header) {
          case 'Name': return 'Example Item';
          case 'Price': return '99.99';
          case 'Category ID': return 'CAT-001';
          case 'Code': return 'AUTO-GENERATED';
          case 'Description': return 'Example description';
          case 'Cost': return '50.00';
          case 'Unit': return 'each';
          case 'Taxable': return 'Yes';
          case 'Active': return 'Yes';
          default: return '';
        }
      })
    ];
    const sheet = XLSX.utils.aoa_to_sheet(exampleData);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  });

  // Generate the file
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

// Helper to convert a string to camelCase
function toCamelCase(str: string): string {
  return str
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '') // trim non-alphanum from ends
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^([A-Z])/, (m) => m.toLowerCase());
}

// Map imported data to destination format, normalizing field names to camelCase
export const mapImportedData = (
  data: ImportedItem[],
  fieldMap: { [key: string]: string }
): ImportedItem[] => {
  return data.map(item => {
    const mappedItem: ImportedItem = {};
    Object.entries(fieldMap).forEach(([sourceField, destField]) => {
      if (sourceField && destField) {
        mappedItem[toCamelCase(destField)] = item[sourceField];
      }
    });
    // Always copy _sheet and _row for downstream logic
    if (item._sheet) mappedItem._sheet = item._sheet;
    if (item._row) mappedItem._row = item._row;
    return mappedItem;
  });
};

/**
 * Parse a category hierarchy from a sheet where each column is a level (Category 1, 2, 3, ...)
 * and the placement of names in columns/rows determines the parent-child relationship.
 * Returns an array of category objects: { id, name, parentId, path, level }
 */
export function parseCategoryHierarchy(rows: any[][], headers: string[]): Array<{
  id: string;
  name: string;
  parentId: string | null;
  path: string[];
  level: number;
}> {
  const categories: Array<{
    id: string;
    name: string;
    parentId: string | null;
    path: string[];
    level: number;
  }> = [];
  // Track the current parent/category at each level
  const current: (null | { id: string; name: string; path: string[] })[] = [];
  let idCounter = 1;

  for (const row of rows) {
    // Find the deepest non-empty column (level)
    let level = -1;
    for (let i = 0; i < headers.length; i++) {
      if (row[i] && String(row[i]).trim() !== '') {
        level = i;
      }
    }
    if (level === -1) continue; // skip empty rows
    const name = String(row[level]).trim();
    if (!name) continue;
    // Build the path for this category
    const path = [];
    for (let i = 0; i < level; i++) {
      if (current[i]) path.push(current[i]!.name);
    }
    path.push(name);
    // Generate a unique id for this category (could use a hash of path or a counter)
    const id = row[0] && String(row[0]).match(/^\d+$/) ? String(row[0]) : `cat_${idCounter++}`;
    // Parent is the last non-empty at the previous level
    const parentId = level > 0 && current[level - 1] ? current[level - 1]!.id : null;
    // Save this category
    const cat = { id, name, parentId, path: [...path], level: level + 1 };
    categories.push(cat);
    // Update the current parent for this level
    current[level] = { id, name, path: [...path] };
    // Clear deeper levels
    for (let i = level + 1; i < headers.length; i++) {
      current[i] = null;
    }
  }
  return categories;
}

/**
 * Parse a ServiceTitan-style category hierarchy from a sheet (NO fill-down!).
 * Each row has a unique id in the first column, and category levels in subsequent columns.
 * The deepest non-blank column is the category's level.
 * The parent is the most recent row above with the same path up to the previous level.
 */
export function parseServiceTitanCategoryHierarchy(rows: any[][], headers: string[]): Array<{
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  path: string[];
}> {
  const categories: Array<{
    id: string;
    name: string;
    parentId: string | null;
    level: number;
    path: string[];
  }> = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    // Find the deepest non-blank category column (skip col 0, which is ID)
    let level = -1;
    for (let i = 1; i < headers.length; i++) {
      if (row[i] && String(row[i]).trim() !== '') {
        level = i;
      }
    }
    if (level === -1) continue; // skip empty rows

    const id = String(row[0]).trim();
    const name = String(row[level]).trim();
    const path: string[] = [];
    for (let i = 1; i <= level; i++) {
      path.push(String(row[i]).trim());
    }

    // Improved parent search: compare only non-empty values in the path up to previous level
    let parentId: string | null = null;
    if (level > 1) {
      for (let j = rowIndex - 1; j >= 0; j--) {
        const prevRow = rows[j];
        let match = true;
        for (let k = 1; k < level; k++) {
          const currentVal = String(row[k] || '').trim();
          const prevVal = String(prevRow[k] || '').trim();
          if (currentVal && prevVal && currentVal !== prevVal) {
            match = false;
            break;
          }
        }
        if (match && prevRow[level - 1] && String(prevRow[level - 1]).trim() !== '') {
          parentId = String(prevRow[0]).trim();
          break;
        }
      }
    }

    categories.push({ id, name, parentId, level: level - 1, path });
  }
  return categories;
} 