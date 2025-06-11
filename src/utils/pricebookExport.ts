import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Types for pricebook data
interface ServiceItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  cost?: number;
  unit: string;
  taxable: boolean;
  active: boolean;
  laborHours?: number;
  skillLevel?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface MaterialItem {
  id: string;
  name: string;
  description: string;
  category: string;
  cost: number;
  price: number;
  unit: string;
  sku?: string;
  vendor?: string;
  taxable: boolean;
  active: boolean;
  stockLevel?: number;
  reorderPoint?: number;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface PricebookData {
  services: ServiceItem[];
  materials: MaterialItem[];
  categories: string[];
  businessInfo?: {
    name: string;
    exportDate: string;
    version: string;
  };
}

// Export configuration options
interface ExportOptions {
  includeInactive?: boolean;
  includeMetadata?: boolean;
  separateSheets?: boolean;
  format?: 'detailed' | 'simple';
}

class PricebookExporter {
  private data: PricebookData;
  private options: ExportOptions;

  constructor(data: PricebookData, options: ExportOptions = {}) {
    this.data = data;
    this.options = {
      includeInactive: false,
      includeMetadata: true,
      separateSheets: true,
      format: 'detailed',
      ...options
    };
  }

  // Main export function
  public exportToXLSX(filename?: string): void {
    const workbook = XLSX.utils.book_new();
    
    if (this.options.separateSheets) {
      this.createSeparateSheets(workbook);
    } else {
      this.createCombinedSheet(workbook);
    }

    // Add metadata sheet if requested
    if (this.options.includeMetadata) {
      this.addMetadataSheet(workbook);
    }

    // Add categories sheet
    this.addCategoriesSheet(workbook);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const finalFilename = filename || `pricebook-export-${timestamp}.xlsx`;

    // Write and save the file
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    saveAs(blob, finalFilename);
  }

  // Create separate sheets for services and materials
  private createSeparateSheets(workbook: XLSX.WorkBook): void {
    // Services sheet
    const servicesData = this.prepareServicesData();
    const servicesWorksheet = XLSX.utils.json_to_sheet(servicesData);
    this.formatWorksheet(servicesWorksheet, 'services');
    XLSX.utils.book_append_sheet(workbook, servicesWorksheet, 'Services');

    // Materials sheet
    const materialsData = this.prepareMaterialsData();
    const materialsWorksheet = XLSX.utils.json_to_sheet(materialsData);
    this.formatWorksheet(materialsWorksheet, 'materials');
    XLSX.utils.book_append_sheet(workbook, materialsWorksheet, 'Materials');
  }

  // Create combined sheet with both services and materials
  private createCombinedSheet(workbook: XLSX.WorkBook): void {
    const combinedData = [
      // Services section
      { Type: 'SERVICES', Name: '', Description: '', Category: '', Price: '', Cost: '', Unit: '', Taxable: '', Active: '' },
      ...this.prepareServicesData().map(service => ({ Type: 'SERVICE', ...service })),
      { Type: '', Name: '', Description: '', Category: '', Price: '', Cost: '', Unit: '', Taxable: '', Active: '' }, // Empty row
      // Materials section
      { Type: 'MATERIALS', Name: '', Description: '', Category: '', Price: '', Cost: '', Unit: '', Taxable: '', Active: '' },
      ...this.prepareMaterialsData().map(material => ({ Type: 'MATERIAL', ...material }))
    ];

    const worksheet = XLSX.utils.json_to_sheet(combinedData);
    this.formatWorksheet(worksheet, 'combined');
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pricebook');
  }

  // Prepare services data for export
  private prepareServicesData(): any[] {
    let services = this.data.services;
    
    // Filter inactive items if not requested
    if (!this.options.includeInactive) {
      services = services.filter(service => service.active);
    }

    return services.map(service => {
      const baseData = {
        'Item ID': service.id,
        'Name': service.name,
        'Description': service.description,
        'Category': service.category,
        'Price': service.price,
        'Unit': service.unit,
        'Taxable': service.taxable ? 'Yes' : 'No',
        'Active': service.active ? 'Yes' : 'No'
      };

      if (this.options.format === 'detailed') {
        return {
          ...baseData,
          'Cost': service.cost || '',
          'Labor Hours': service.laborHours || '',
          'Skill Level': service.skillLevel || '',
          'Tags': service.tags?.join(', ') || '',
          'Created Date': service.createdAt ? new Date(service.createdAt).toLocaleDateString() : '',
          'Updated Date': service.updatedAt ? new Date(service.updatedAt).toLocaleDateString() : ''
        };
      }

      return baseData;
    });
  }

  // Prepare materials data for export
  private prepareMaterialsData(): any[] {
    let materials = this.data.materials;
    
    // Filter inactive items if not requested
    if (!this.options.includeInactive) {
      materials = materials.filter(material => material.active);
    }

    return materials.map(material => {
      const baseData = {
        'Item ID': material.id,
        'Name': material.name,
        'Description': material.description,
        'Category': material.category,
        'Cost': material.cost,
        'Price': material.price,
        'Unit': material.unit,
        'Taxable': material.taxable ? 'Yes' : 'No',
        'Active': material.active ? 'Yes' : 'No'
      };

      if (this.options.format === 'detailed') {
        return {
          ...baseData,
          'SKU': material.sku || '',
          'Vendor': material.vendor || '',
          'Stock Level': material.stockLevel || '',
          'Reorder Point': material.reorderPoint || '',
          'Tags': material.tags?.join(', ') || '',
          'Created Date': material.createdAt ? new Date(material.createdAt).toLocaleDateString() : '',
          'Updated Date': material.updatedAt ? new Date(material.updatedAt).toLocaleDateString() : ''
        };
      }

      return baseData;
    });
  }

  // Add metadata sheet with export information
  private addMetadataSheet(workbook: XLSX.WorkBook): void {
    const metadata = [
      { Property: 'Export Date', Value: new Date().toLocaleString() },
      { Property: 'Business Name', Value: this.data.businessInfo?.name || 'Unknown' },
      { Property: 'Total Services', Value: this.data.services.length },
      { Property: 'Active Services', Value: this.data.services.filter(s => s.active).length },
      { Property: 'Total Materials', Value: this.data.materials.length },
      { Property: 'Active Materials', Value: this.data.materials.filter(m => m.active).length },
      { Property: 'Total Categories', Value: this.data.categories.length },
      { Property: 'Export Format', Value: this.options.format },
      { Property: 'Include Inactive', Value: this.options.includeInactive ? 'Yes' : 'No' },
      { Property: 'Separate Sheets', Value: this.options.separateSheets ? 'Yes' : 'No' }
    ];

    const metadataWorksheet = XLSX.utils.json_to_sheet(metadata);
    this.formatWorksheet(metadataWorksheet, 'metadata');
    XLSX.utils.book_append_sheet(workbook, metadataWorksheet, 'Export Info');
  }

  // Add categories sheet
  private addCategoriesSheet(workbook: XLSX.WorkBook): void {
    const categoriesData = this.data.categories.map((category, index) => ({
      'Category ID': index + 1,
      'Category Name': category,
      'Services Count': this.data.services.filter(s => s.category === category).length,
      'Materials Count': this.data.materials.filter(m => m.category === category).length
    }));

    const categoriesWorksheet = XLSX.utils.json_to_sheet(categoriesData);
    this.formatWorksheet(categoriesWorksheet, 'categories');
    XLSX.utils.book_append_sheet(workbook, categoriesWorksheet, 'Categories');
  }

  // Format worksheet with proper column widths and styling
  private formatWorksheet(worksheet: XLSX.WorkSheet, type: string): void {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Set column widths based on content type
    const columnWidths = this.getColumnWidths(type);
    worksheet['!cols'] = columnWidths;

    // Format header row (make it bold and add background color)
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "E3F2FD" } },
          alignment: { horizontal: "center" }
        };
      }
    }

    // Format price/cost columns as currency
    this.formatCurrencyColumns(worksheet, type);
  }

  // Get appropriate column widths for different sheet types
  private getColumnWidths(type: string): any[] {
    const baseWidths = [
      { wch: 15 }, // ID
      { wch: 25 }, // Name
      { wch: 40 }, // Description
      { wch: 15 }, // Category
      { wch: 12 }, // Price/Cost
      { wch: 12 }, // Cost/Price
      { wch: 10 }, // Unit
      { wch: 10 }, // Taxable
      { wch: 10 }  // Active
    ];

    if (this.options.format === 'detailed') {
      return [
        ...baseWidths,
        { wch: 15 }, // Additional field 1
        { wch: 15 }, // Additional field 2
        { wch: 20 }, // Tags
        { wch: 12 }, // Created Date
        { wch: 12 }  // Updated Date
      ];
    }

    return baseWidths;
  }

  // Format currency columns
  private formatCurrencyColumns(worksheet: XLSX.WorkSheet, type: string): void {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Find price and cost columns
    const priceColIndex = this.findColumnIndex(worksheet, 'Price');
    const costColIndex = this.findColumnIndex(worksheet, 'Cost');

    // Format currency cells
    for (let row = 1; row <= range.e.r; row++) {
      if (priceColIndex !== -1) {
        const priceCellAddress = XLSX.utils.encode_cell({ r: row, c: priceColIndex });
        if (worksheet[priceCellAddress] && typeof worksheet[priceCellAddress].v === 'number') {
          worksheet[priceCellAddress].z = '$#,##0.00';
        }
      }
      
      if (costColIndex !== -1) {
        const costCellAddress = XLSX.utils.encode_cell({ r: row, c: costColIndex });
        if (worksheet[costCellAddress] && typeof worksheet[costCellAddress].v === 'number') {
          worksheet[costCellAddress].z = '$#,##0.00';
        }
      }
    }
  }

  // Find column index by header name
  private findColumnIndex(worksheet: XLSX.WorkSheet, headerName: string): number {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (worksheet[cellAddress] && worksheet[cellAddress].v === headerName) {
        return col;
      }
    }
    
    return -1;
  }
}

// Utility functions for easy use
export const exportPricebook = (data: PricebookData, options?: ExportOptions, filename?: string): void => {
  const exporter = new PricebookExporter(data, options);
  exporter.exportToXLSX(filename);
};

// Export services only
export const exportServices = (services: ServiceItem[], businessInfo?: any, filename?: string): void => {
  const data: PricebookData = {
    services,
    materials: [],
    categories: [...new Set(services.map(s => s.category))],
    businessInfo
  };
  
  const exporter = new PricebookExporter(data, { separateSheets: false });
  exporter.exportToXLSX(filename || `services-export-${new Date().toISOString().split('T')[0]}.xlsx`);
};

// Export materials only
export const exportMaterials = (materials: MaterialItem[], businessInfo?: any, filename?: string): void => {
  const data: PricebookData = {
    services: [],
    materials,
    categories: [...new Set(materials.map(m => m.category))],
    businessInfo
  };
  
  const exporter = new PricebookExporter(data, { separateSheets: false });
  exporter.exportToXLSX(filename || `materials-export-${new Date().toISOString().split('T')[0]}.xlsx`);
};

// Export with custom template for specific software compatibility
export const exportForSoftware = (data: PricebookData, targetSoftware: string, filename?: string): void => {
  let options: ExportOptions = {};
  
  switch (targetSoftware.toLowerCase()) {
    case 'servicetitan':
      options = { format: 'simple', separateSheets: true, includeInactive: false };
      break;
    case 'housecall':
      options = { format: 'detailed', separateSheets: false, includeInactive: false };
      break;
    case 'jobber':
      options = { format: 'simple', separateSheets: true, includeInactive: true };
      break;
    default:
      options = { format: 'detailed', separateSheets: true, includeInactive: false };
  }
  
  const exporter = new PricebookExporter(data, options);
  const finalFilename = filename || `pricebook-${targetSoftware}-${new Date().toISOString().split('T')[0]}.xlsx`;
  exporter.exportToXLSX(finalFilename);
};

export default PricebookExporter;