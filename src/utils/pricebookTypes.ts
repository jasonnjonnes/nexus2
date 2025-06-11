// Base types for all pricebook items
interface BasePricebookItem {
  id: string;
  userId: string;
  code: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  // Category fields (ServiceTitan style)
  categoryId?: string;
  category1?: string;
  category2?: string;
  category3?: string;
  // Common fields
  taxable: boolean;
  allowDiscounts: boolean;
  allowMembershipDiscounts: boolean;
  useDynamicPricing: boolean;
  staticPrice?: number;
  staticMemberPrice?: number;
  staticAddOnPrice?: number;
  staticMemberAddOnPrice?: number;
  crossSaleGroup?: string;
  generalLedgerAccount?: string;
  expenseAccount?: string;
  commissionPercentage?: number;
  bonusPercentage?: number;
  payTechSpecificBonus: boolean;
  paysCommission: boolean;
  tags?: string[];
}

// Service specific fields
export interface Service extends BasePricebookItem {
  type: 'service';
  warrantyDescription?: string;
  laborService: boolean;
  excludeFromPricebookWizard: boolean;
  hours: number;
  estimatedLaborCost?: number;
  // Linked items
  linkedMaterials?: string[]; // Array of material IDs
  linkedEquipment?: string[]; // Array of equipment IDs
  upgrades?: string[]; // Array of service IDs that are upgrades
  recommendations?: string[]; // Array of service IDs that are recommendations
  // Media
  images?: Array<{
    id: string;
    url: string;
    alt?: string;
    order: number;
  }>;
  videos?: Array<{
    id: string;
    url: string;
    title?: string;
    order: number;
  }>;
  // Conversion tracking
  conversionTags?: string[];
}

// Material specific fields
export interface Material extends BasePricebookItem {
  type: 'material';
  vendor?: string;
  vendorPartNumber?: string;
  cost: number;
  price: number;
  markup: number;
  unit: string;
  stockQuantity?: number;
  reorderPoint?: number;
  // Media
  images?: Array<{
    id: string;
    url: string;
    alt?: string;
    order: number;
  }>;
  notes?: string;
}

// Equipment specific fields
export interface Equipment extends BasePricebookItem {
  type: 'equipment';
  serialNumber?: string;
  modelNumber?: string;
  manufacturer?: string;
  purchaseDate?: string;
  warrantyExpiration?: string;
  location?: string;
  status?: 'active' | 'maintenance' | 'retired';
  // Media
  images?: Array<{
    id: string;
    url: string;
    alt?: string;
    order: number;
  }>;
  notes?: string;
}

// Category structure
export interface Category {
  id: string;
  userId: string;
  name: string;
  description?: string;
  type: 'service' | 'material' | 'equipment';
  parentId?: string;
  active: boolean;
  thumbnail?: string;
  priceRuleId?: string;
  createdAt: string;
  updatedAt: string;
}

// Discount and Fee structure
export interface DiscountOrFee extends BasePricebookItem {
  type: 'discount' | 'fee';
  discountType: 'percentage' | 'fixed' | 'flat';
  amount?: number;
  percentage?: number;
  minimumAmount?: number;
  maximumAmount?: number;
  applyTo: 'services' | 'materials' | 'both';
}

// Price Rule structure
export interface PriceRule {
  id: string;
  userId: string;
  name: string;
  description?: string;
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
  assignedCategories: string[]; // Array of category IDs
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Relationship types
export interface ServiceMaterialLink {
  id: string;
  userId: string;
  serviceId: string;
  materialId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceEquipmentLink {
  id: string;
  userId: string;
  serviceId: string;
  equipmentId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentMaterialLink {
  id: string;
  userId: string;
  equipmentId: string;
  materialId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

// Export types for use in other files
export type PricebookItem = Service | Material | Equipment | DiscountOrFee;
export type PricebookCollection = 'pricebook_services' | 'pricebook_materials' | 'pricebook_equipment' | 'pricebook_discounts_fees';
export type RelationshipCollection = 'service_material_links' | 'service_equipment_links' | 'equipment_material_links'; 