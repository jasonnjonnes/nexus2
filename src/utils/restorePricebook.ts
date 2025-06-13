import { getFirestore, collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { SERVICETITAN_CATEGORY_MAPPING } from './pricebookImport';

// Default price rules
const DEFAULT_PRICE_RULES = [
  {
    id: 'PR-ROOT',
    name: 'Standard Pricing',
    description: 'Default pricing rule for all services',
    baseRate: 85,
    materialMarkup: 1.5,
    active: true,
    serviceTitanId: null
  },
  {
    id: 'PR-PM',
    name: 'Preventive Maintenance',
    description: 'Pricing rule for preventive maintenance services',
    baseRate: 75,
    materialMarkup: 1.4,
    active: true,
    serviceTitanId: null
  },
  {
    id: 'PR-EMG',
    name: 'Emergency Services',
    description: 'Pricing rule for emergency services',
    baseRate: 125,
    materialMarkup: 1.6,
    active: true,
    serviceTitanId: null
  }
];

// Default services
const DEFAULT_SERVICES = [
  {
    id: 'SVC-PM-BASIC',
    name: 'Basic Preventive Maintenance',
    description: 'Standard preventive maintenance service',
    code: 'PM-BASIC',
    categoryId: 'SVC-PM',
    categories: ['SVC-PM'],
    active: true,
    useDynamicPricing: true,
    hours: 1,
    estimatedLaborCost: 75,
    taxable: true,
    allowDiscounts: true,
    allowMembershipDiscounts: true,
    laborService: true,
    excludeFromPricebookWizard: false,
    warrantyDescription: '90-day labor warranty',
    commissionPercentage: 10,
    bonusPercentage: 5,
    payTechSpecificBonus: false,
    paysCommission: true,
    images: [],
    videos: [],
    conversionTags: ['pm', 'maintenance', 'preventive'],
    serviceTitanId: null,
    serviceTitanCategoryId: null,
    serviceTitanSubCategoryId: null,
    serviceTitanEquipmentId: null,
    serviceTitanWarrantyId: null
  },
  {
    id: 'SVC-EMG-BASIC',
    name: 'Emergency Service Call',
    description: 'Emergency service call with 2-hour response time',
    code: 'EMG-BASIC',
    categoryId: 'SVC-EMG',
    categories: ['SVC-EMG'],
    active: true,
    useDynamicPricing: true,
    hours: 2,
    estimatedLaborCost: 250,
    taxable: true,
    allowDiscounts: false,
    allowMembershipDiscounts: true,
    laborService: true,
    excludeFromPricebookWizard: false,
    warrantyDescription: '30-day labor warranty',
    commissionPercentage: 15,
    bonusPercentage: 10,
    payTechSpecificBonus: true,
    paysCommission: true,
    images: [],
    videos: [],
    conversionTags: ['emergency', 'urgent', 'same-day'],
    serviceTitanId: null,
    serviceTitanCategoryId: null,
    serviceTitanSubCategoryId: null,
    serviceTitanEquipmentId: null,
    serviceTitanWarrantyId: null
  }
];

// Default materials
const DEFAULT_MATERIALS = [
  {
    id: 'MAT-FILTER-1',
    name: 'Standard Air Filter',
    description: 'Standard 16x20x1 air filter',
    code: 'FILTER-1',
    categoryId: 'MAT-PARTS',
    categories: ['MAT-PARTS'],
    active: true,
    vendor: 'Generic',
    vendorPartNumber: 'AF-1620-1',
    cost: 8.99,
    price: 19.99,
    markup: 2.22,
    unit: 'each',
    taxable: true,
    excludeFromPricebookWizard: false,
    linkedEquipment: [],
    notes: 'Common size for residential systems',
    images: [],
    serviceTitanId: null,
    serviceTitanCategoryId: null,
    serviceTitanSubCategoryId: null,
    serviceTitanEquipmentId: null,
    serviceTitanWarrantyId: null,
    allowMembershipDiscounts: true,
    crossSaleGroup: 'Filters'
  },
  {
    id: 'MAT-REFRIGERANT-1',
    name: 'R-410A Refrigerant',
    description: 'R-410A refrigerant, 25lb cylinder',
    code: 'R410A-25',
    categoryId: 'MAT-PARTS',
    categories: ['MAT-PARTS'],
    active: true,
    vendor: 'Generic',
    vendorPartNumber: 'R410A-25',
    cost: 299.99,
    price: 499.99,
    markup: 1.67,
    unit: 'cylinder',
    taxable: true,
    excludeFromPricebookWizard: false,
    linkedEquipment: [],
    notes: 'For use with R-410A systems only',
    images: [],
    serviceTitanId: null,
    serviceTitanCategoryId: null,
    serviceTitanSubCategoryId: null,
    serviceTitanEquipmentId: null,
    serviceTitanWarrantyId: null,
    allowMembershipDiscounts: false,
    crossSaleGroup: 'Refrigerants'
  }
];

export const restorePricebookData = async (db: any, userId: string, tenantId: string) => {
  const batch = writeBatch(db);

  // Add categories
  for (const category of SERVICETITAN_CATEGORY_MAPPING) {
    const categoryRef = doc(collection(db, 'tenants', tenantId, 'categories'));
    batch.set(categoryRef, {
      ...category,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Add price rules
  for (const rule of DEFAULT_PRICE_RULES) {
    const ruleRef = doc(collection(db, 'tenants', tenantId, 'priceRules'));
    batch.set(ruleRef, {
      ...rule,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Add services
  for (const service of DEFAULT_SERVICES) {
    const serviceRef = doc(collection(db, 'tenants', tenantId, 'services'));
    batch.set(serviceRef, {
      ...service,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Add materials
  for (const material of DEFAULT_MATERIALS) {
    const materialRef = doc(collection(db, 'tenants', tenantId, 'materials'));
    batch.set(materialRef, {
      ...material,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Commit all changes
  await batch.commit();
}; 