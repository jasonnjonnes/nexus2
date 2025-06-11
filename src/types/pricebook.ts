import { Timestamp, FieldValue } from 'firebase/firestore';

// Base interfaces
export interface BasePricebookItem {
  id: string;
  userId: string;
  code: string;
  name: string;
  description: string;
  serviceTitanId: string | null;
  categories: string[];
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Category interfaces
export interface Category {
  id: string;
  userId: string;
  name: string;
  description: string;
  type: 'service' | 'material' | 'equipment';
  serviceTitanId: string | null;
  serviceTitanPath: string | null;
  parentId: string | null;
  isExcludedFromPricebookWizard: boolean;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  priceRuleId?: string | null;
}

// Service interfaces
export interface Service extends BasePricebookItem {
  // Basic Information
  warrantyDescription: string;
  laborService: boolean;
  
  // Pricing
  useStaticPrice: boolean;
  staticPrice: number;
  staticMemberPrice: number;
  staticAddOnPrice: number;
  staticMemberAddOnPrice: number;
  useDynamicPricing: boolean;
  hours: number;
  estimatedLaborCost: number;
  
  // Service Settings
  allowDiscounts: boolean;
  allowMembershipDiscounts: boolean;
  taxable: boolean;
  excludeFromPricebookWizard: boolean;
  
  // Accounting
  crossSaleGroup: string;
  generalLedgerAccount: string;
  expenseAccount: string;
  
  // Linked Items
  linkedMaterials: string[];
  linkedEquipment: string[];
  upgrades: string[];
  recommendations: string[];
  
  // Media and Marketing
  images: ServiceImage[];
  videos: ServiceVideo[];
  conversionTags: string[];
  
  // Commission
  commissionPercentage: number;
  bonusPercentage: number;
  payTechSpecificBonus: boolean;
  paysCommission: boolean;
}

// Material interfaces
export interface Material extends BasePricebookItem {
  vendor: string;
  vendorPartNumber: string;
  cost: number;
  price: number;
  markup: number;
  unit: string;
  excludeFromPricebookWizard: boolean;
  linkedEquipment: string[];
  notes: string;
}

// Equipment interfaces
export interface Equipment extends BasePricebookItem {
  serialNumber: string;
  model: string;
  manufacturer: string;
  warrantyExpiration: Timestamp | null;
  status: 'active' | 'maintenance' | 'retired';
  lastServiceDate: Timestamp | null;
  nextServiceDate: Timestamp | null;
  notes: string;
}

// Media interfaces
export interface ServiceImage {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
}

export interface ServiceVideo {
  id: string;
  name: string;
  url: string;
  uploadedAt: Timestamp;
}

// Price Rule interfaces
export interface PriceRule {
  id: string;
  userId: string;
  name: string;
  description: string;
  baseRate: number;
  afterHoursMultiplier: number;
  emergencyMultiplier: number;
  weekendSurcharge: number;
  holidaySurcharge: number;
  afterHoursSurcharge: number;
  minimumCharge: number;
  travelTime: boolean;
  mileageRate: number;
  materialMarkup: number;
  laborMarkup: number;
  markupTiers: MarkupTier[];
  assignedCategories: string[];
  assignedServices: string[];
  active: boolean;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

export interface PriceRuleForm {
  name: string;
  description: string;
  baseRate: number;
  afterHoursMultiplier: number;
  emergencyMultiplier: number;
  weekendSurcharge: number;
  holidaySurcharge: number;
  afterHoursSurcharge: number;
  minimumCharge: number;
  travelTime: boolean;
  mileageRate: number;
  materialMarkup: number;
  laborMarkup: number;
  markupTiers: MarkupTier[];
  assignedCategories: string[];
  assignedServices: string[];
  active: boolean;
}

// Form state interfaces
export interface ServiceFormState {
  code: string;
  name: string;
  itemDescription: string;
  description: string;
  categories: string[];
  assignedCategories: string[];
  linkedMaterials: string[];
  linkedEquipment?: string[];
  upgrades?: string[];
  recommendations?: string[];
  videos?: ServiceVideo[];
  useDynamicPricing: boolean;
  staticPrice: number;
  hours: number;
  billableRate: number;
  materialMarkup: number;
  commissionPercentage: number;
  bonusPercentage: number;
  payTechSpecificBonus: boolean;
  paysCommission: boolean;
  active: boolean;
  images: ServiceImage[];
  serviceTitanId: string;
  staticMemberPrice: number;
  generalLedgerAccount: string;
  expenseAccount: string;
  taxable: boolean;
  allowDiscounts: boolean;
  laborService: boolean;
  conversionTags: string[];
  warrantyDescription: string;
  useStaticPrice: boolean;
  staticAddOnPrice: number;
  staticMemberAddOnPrice: number;
  estimatedLaborCost: number;
  allowMembershipDiscounts: boolean;
  excludeFromPricebookWizard: boolean;
  crossSaleGroup: string;
  serviceTitanCategoryId: string;
  serviceTitanSubCategoryId: string;
  serviceTitanEquipmentId: string;
  serviceTitanWarrantyId: string;
}

export interface MaterialFormState extends Omit<Material, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

export interface CategoryFormState {
  name: string;
  description: string;
  type: 'service' | 'material' | 'equipment';
  parentId: string | null;
  priceRuleId: string | null;
  active: boolean;
  serviceTitanId: string;
  serviceTitanParentId: string | null;
  serviceTitanPath?: string;
  isExcludedFromPricebookWizard?: boolean;
}

export interface MarkupTier {
  min: number;
  max: number | null;
  percent: number;
}

// Import/Export interfaces
export interface ImportResult {
  data: any[];
  errors: string[];
  warnings: string[];
  headers?: string[];
}

export interface ExportOptions {
  format: 'xlsx' | 'csv';
  includeInactive: boolean;
  separateSheets: boolean;
}

// ServiceTitan specific interfaces
export interface ServiceTitanCategory {
  id: string;
  name: string;
  type: 'service' | 'material' | 'equipment';
  parentId: string | null;
  path: string;
  description: string;
  isActive: boolean;
  isExcludedFromPricebookWizard: boolean;
}

export interface ServiceTitanBaseItem {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  useStaticPrice: boolean;
  staticPrice: number;
  staticMemberPrice: number;
  staticAddOnPrice: number;
  staticMemberAddOnPrice: number;
  excludeFromPricebookWizard: boolean;
  active: boolean;
}

export interface ServiceTitanService extends ServiceTitanBaseItem {
  warrantyDescription: string;
  laborService: boolean;
  allowDiscounts: boolean;
  allowMembershipDiscounts: boolean;
  taxable: boolean;
  hours: number;
  estimatedLaborCost: number;
  crossSaleGroup: string;
  generalLedgerAccount: string;
  expenseAccount: string;
  linkedMaterials: string[];
  linkedEquipment: string[];
  upgrades: string[];
  recommendations: string[];
  conversionTags: string[];
  commissionPercentage: number;
  bonusPercentage: number;
  payTechSpecificBonus: boolean;
  paysCommission: boolean;
}

export interface ServiceTitanMaterial extends ServiceTitanBaseItem {
  vendor: string;
  vendorPartNumber: string;
  cost: number;
  price: number;
  markup: number;
  unit: string;
  linkedEquipment: string[];
  notes: string;
}

export interface ServiceTitanEquipment extends ServiceTitanBaseItem {
  serialNumber: string;
  model: string;
  manufacturer: string;
  warrantyExpiration: string | null;
  status: 'active' | 'maintenance' | 'retired';
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  notes: string;
}

export type CategoryId = string;
export type MaterialId = string;

export interface MaterialImage {
  id: string;
  url: string;
  name: string;
  uploadedAt: string;
}

export interface MaterialFormState {
  code: string;
  name: string;
  description: string;
  vendor: string;
  vendorPartNumber: string;
  cost: number;
  price: number;
  markup: number;
  unit: string;
  taxable: boolean;
  active: boolean;
  categories: CategoryId[];
  images: ServiceImage[];
  notes: string;
  excludeFromPricebookWizard: boolean;
  linkedEquipment: string[];
  serviceTitanId: string;
  serviceTitanCategoryId: string;
  serviceTitanSubCategoryId: string;
  serviceTitanEquipmentId: string;
  serviceTitanWarrantyId: string;
  allowMembershipDiscounts: boolean;
  crossSaleGroup: string;
}

export interface CategoryFormState {
  name: string;
  description: string;
  type: 'service' | 'material' | 'equipment';
  parentId: string | null;
  priceRuleId: string | null;
  active: boolean;
  serviceTitanId: string;
  serviceTitanParentId: string | null;
  serviceTitanPath?: string;
  isExcludedFromPricebookWizard?: boolean;
} 