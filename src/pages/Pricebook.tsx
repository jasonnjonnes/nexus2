import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Plus, Search, Edit, Trash2, X, Upload, Download, 
  FileText, Package, Folder, Calculator, Camera, MoreHorizontal, ChevronDown, ChevronRight,
  RefreshCw, Filter, Save, Play, DollarSign, Settings, Image, Video, Tag, Copy, BarChart3, CopyPlus, Power
} from 'lucide-react';
import { auth as sharedAuth, db as sharedDb } from '../firebase';
import { 
  getFirestore, Firestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, 
  query, where, writeBatch, serverTimestamp, getDocs, setDoc, getDoc
} from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth';
import { Dialog } from '@headlessui/react';
import { Category, CategoryFormState, Service, ServiceFormState, Material, MaterialFormState, PriceRule, PriceRuleForm } from '../types/pricebook';
import { ImportedItem } from '../utils/pricebookImport';
import { restorePricebookData } from '../utils/restorePricebook';
import DynamicPricingModule from '../components/DynamicPricingModule';
import PriceRuleModal from '../components/PriceRuleModal';
import CategoryModal from '../components/CategoryModal';
import MaterialForm from '../components/MaterialForm';
import PricebookExportModal from '../components/PricebookExportModal';
import PricebookImportExport from '../components/PricebookImportExport';
import { parseCategoryHierarchy, parseServiceTitanCategoryHierarchy } from '../utils/pricebookImport';
import * as XLSX from 'xlsx';
import ServiceForm from '../components/ServiceForm';
import { GLAccount } from '../types/pricebook';
import EquipmentForm, { EquipmentFormState } from '../components/EquipmentForm';
import { Menu } from '@headlessui/react';
import CustomerImportModal from '../components/CustomerImportModal';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { useCache } from '../contexts/CacheContext';
import { db } from '../firebase';

// Declare firebase config if it's coming from an external script
declare const __firebase_config: any;

// Helper functions
const generateServiceCode = () => `T-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
const generateMaterialCode = () => `M-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

const BATCH_LIMIT = 500;

// Utility to fill down parent columns
function fillDownParentColumns(rows: any[][], headers: string[]): any[][] {
  const filledRows = [];
  let lastValues = Array(headers.length).fill('');
  for (const row of rows) {
    const newRow = [...row];
    for (let i = 0; i < headers.length; i++) {
      if (!newRow[i] || newRow[i] === '') {
        newRow[i] = lastValues[i];
      } else {
        lastValues[i] = newRow[i];
      }
    }
    filledRows.push(newRow);
  }
  return filledRows;
}

// Utility to clean undefined values from Firestore data
function cleanFirestoreData(obj: any) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}

// Helper to chunk an array into batches of 500
function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// Add a utility function to strip HTML tags
function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

// Helper to update or add a link in an array
function upsertLink<T extends { [key: string]: any }>(array: T[], idKey: string, id: string, data: Partial<T>): T[] {
  const idx = array.findIndex((item: T) => item[idKey] === id);
  if (idx !== -1) {
    array[idx] = { ...array[idx], ...data };
  } else {
    array.push(data as T);
  }
  return array;
}

const Pricebook: React.FC = () => {
  const [activeTab, setActiveTab] = useState('services');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showEditServiceModal, setShowEditServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [showEditMaterialModal, setShowEditMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  const [showAddPriceRuleModal, setShowAddPriceRuleModal] = useState(false);
  const [showPriceRuleMenu, setShowPriceRuleMenu] = useState<string | null>(null);

  const [expandedCategories, setExpandedCategories] = useState(new Set<string>());
  const [categoryType, setCategoryType] = useState('service');
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSource, setImportSource] = useState<'servicetitan' | 'housecall' | 'csv' | null>(null);
  
  const servicePhotoInputRef = useRef<HTMLInputElement>(null);
  const materialPhotoInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceRules, setPriceRules] = useState<PriceRule[]>([]);

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectAllServices, setSelectAllServices] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectAllMaterials, setSelectAllMaterials] = useState(false);
  const [showBulkDeleteMaterialsDialog, setShowBulkDeleteMaterialsDialog] = useState(false);
  const [isDeletingMaterials, setIsDeletingMaterials] = useState(false);

  const [showEditPriceRuleModal, setShowEditPriceRuleModal] = useState(false);
  const [editingPriceRule, setEditingPriceRule] = useState<PriceRule | null>(null);

  const [currentServicePage, setCurrentServicePage] = useState(1);
  const [currentMaterialPage, setCurrentMaterialPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  const initialServiceForm: ServiceFormState = {
    code: '',
    name: '',
    itemDescription: '',
    description: '',
    categories: [],
    assignedCategories: [],
    linkedMaterials: [],
    linkedEquipment: [],
    upgrades: [],
    recommendations: [],
    videos: [],
    useDynamicPricing: false,
    staticPrice: 0,
    hours: 0,
    billableRate: 0,
    materialMarkup: 0,
    commissionPercentage: 0,
    bonusPercentage: 0,
    payTechSpecificBonus: false,
    paysCommission: false,
    active: true,
    images: [],
    generalLedgerAccount: '',
    expenseAccount: '',
    taxable: false,
    allowDiscounts: true,
    laborService: false,
    conversionTags: [],
    warrantyDescription: '',
    useStaticPrice: false,
    estimatedLaborCost: 0,
    allowMembershipDiscounts: true,
    excludeFromPricebookWizard: false,
    crossSaleGroup: [],
    dollarBonus: 0,
    materialCost: 0,
    materialCount: 0,
  };
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(initialServiceForm);

  const initialMaterialFormState: MaterialFormState = {
    code: '',
    name: '',
    description: '',
    vendor: '',
    vendorPartNumber: '',
    cost: 0,
    price: 0,
    markup: 0,
    unit: 'each',
    taxable: true,
    active: true,
    categories: [],
    images: [],
    notes: '',
    excludeFromPricebookWizard: false,
    linkedEquipment: [],
    allowMembershipDiscounts: true,
    crossSaleGroup: [],
    generalLedgerAccount: '',
    expenseAccount: '',
  };
  const [materialForm, setMaterialForm] = useState<MaterialFormState>(initialMaterialFormState);

  const [categoryFormState, setCategoryFormState] = useState<CategoryFormState>({
    name: '',
    description: '',
    type: 'service',
    parentId: null,
    priceRuleId: null,
    active: true,
    serviceTitanId: '',
    serviceTitanParentId: null,
    isExcludedFromPricebookWizard: false,
  });

  // Add state for selected categories
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectAllCategories, setSelectAllCategories] = useState(false);
  const [showBulkDeleteCategoriesDialog, setShowBulkDeleteCategoriesDialog] = useState(false);
  const [isDeletingCategories, setIsDeletingCategories] = useState(false);

  // Add importStep state
  const [importStep, setImportStep] = useState(1);

  // Add state for loading and error feedback
  const [serviceSaving, setServiceSaving] = useState(false);
  const [materialSaving, setMaterialSaving] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [materialError, setMaterialError] = useState<string | null>(null);

  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);

  // Add at the top of the Pricebook component:
  const [pendingServices, setPendingServices] = useState<ImportedItem[]>([]);
  const [pendingMaterials, setPendingMaterials] = useState<ImportedItem[]>([]);
  const [pendingEquipment, setPendingEquipment] = useState<ImportedItem[]>([]);

  const initialEquipmentFormState: EquipmentFormState = {
    code: '',
    name: '',
    description: '',
    categoryId: '',
    linkedMaterials: [],
    categories: [],
    type: '',
    account: '',
    costOfSaleAccount: '',
    assetAccount: '',
    crossSaleGroup: '',
    upgrades: '',
    recommendationsServices: '',
    recommendationsMaterials: '',
    dollarBonus: 0,
    paysCommission: false,
    bonusPercentage: 0,
    hours: 0,
    payTechSpecificBonus: false,
    isConfigurable: false,
    taxable: false,
    brand: '',
    manufacturer: '',
    model: '',
    cost: 0,
    price: 0,
    memberPrice: 0,
    addOnPrice: 0,
    addOnMemberPrice: 0,
    unitOfMeasure: '',
    allowDiscounts: false,
    allowMembershipDiscounts: false,
    manufacturerWarrantyDuration: '',
    manufacturerWarrantyDescription: '',
    serviceProviderWarrantyDuration: '',
    serviceProviderWarrantyDescription: '',
    dimensionsH: '',
    dimensionsW: '',
    dimensionsD: '',
    active: true,
    replenishment: false,
    vendors: [],
    notes: '',
  };
  const [equipment, setEquipment] = useState<EquipmentFormState[]>([]);
  const [equipmentForm, setEquipmentForm] = useState<EquipmentFormState>(initialEquipmentFormState);
  const [showAddEquipmentModal, setShowAddEquipmentModal] = useState(false);
  const [showEditEquipmentModal, setShowEditEquipmentModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentFormState | null>(null);
  const [equipmentSaving, setEquipmentSaving] = useState(false);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);

  // Add state for ServiceTitan import file
  const [serviceTitanImportFile, setServiceTitanImportFile] = useState<File | null>(null);

  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [selectAllEquipment, setSelectAllEquipment] = useState(false);
  const [showBulkDeleteEquipmentDialog, setShowBulkDeleteEquipmentDialog] = useState(false);
  const [isDeletingEquipment, setIsDeletingEquipment] = useState(false);

  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);

  // 1. Add state for multi-select delete warning:
  const [showMultiDeleteWarning, setShowMultiDeleteWarning] = useState(false);
  const [showMultiDeleteMaterialsWarning, setShowMultiDeleteMaterialsWarning] = useState(false);

  const [showImportMaterialLinks, setShowImportMaterialLinks] = useState(false);
  const [showImportEquipmentLinks, setShowImportEquipmentLinks] = useState(false);
  const [showImportEquipmentMaterialLinks, setShowImportEquipmentMaterialLinks] = useState(false);

  const [showCustomerImport, setShowCustomerImport] = useState(false);

  // Use auth context instead of direct Firebase
  const { user, tenantId } = useFirebaseAuth();
  const userId = user?.uid;
  const cache = useCache();

  // Cached data fetching functions
  const fetchCategoriesWithCache = useCallback(async () => {
    if (!db || !userId || !tenantId) {
      console.error('Cannot fetch categories: db, userId, or tenantId is missing');
      return;
    }

    const cacheKey = `categories_${tenantId}_${userId}`;
    
    // Check cache first
    const cachedCategories = cache.get<Category[]>(cacheKey);
    if (cachedCategories) {
      console.log('Categories loaded from cache:', cachedCategories.length);
      setCategories(cachedCategories);
      return;
    }

    // If not in cache, fetch from Firebase
    try {
      console.log('Fetching categories from Firebase...');
      const categoriesRef = collection(db, 'tenants', tenantId, 'categories');
      const q = query(categoriesRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      
      console.log('Categories fetched from Firebase:', categoriesData.length);
      setCategories(categoriesData);
      
      // Cache the result
      cache.set(cacheKey, categoriesData, 120); // Cache for 2 hours
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('Failed to load categories');
    }
  }, [db, userId, tenantId, cache]);

  const fetchServicesWithCache = useCallback(async () => {
    if (!db || !userId || !tenantId) {
      console.error('Cannot fetch services: db, userId, or tenantId is missing');
      return;
    }

    const cacheKey = `services_${tenantId}_${userId}`;
    
    // Check cache first
    const cachedServices = cache.get<Service[]>(cacheKey);
    if (cachedServices) {
      console.log('Services loaded from cache:', cachedServices.length);
      setServices(cachedServices);
      return;
    }

    // If not in cache, fetch from Firebase
    try {
      console.log('Fetching services from Firebase...');
      const servicesRef = collection(db, 'tenants', tenantId, 'services');
      const q = query(servicesRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      const servicesData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          categories: Array.isArray(data.categories) ? data.categories.map(String) : [],
        };
      }) as Service[];
      
      console.log('Services fetched from Firebase:', servicesData.length);
      setServices(servicesData);
      
      // Cache the result
      cache.set(cacheKey, servicesData, 60); // Cache for 1 hour
    } catch (error) {
      console.error('Error fetching services:', error);
      setError('Failed to load services');
    }
  }, [db, userId, tenantId, cache]);

  const fetchMaterialsWithCache = useCallback(async () => {
    if (!db || !userId || !tenantId) {
      console.error('Cannot fetch materials: db, userId, or tenantId is missing');
      return;
    }

    const cacheKey = `materials_${tenantId}_${userId}`;
    
    // Check cache first
    const cachedMaterials = cache.get<Material[]>(cacheKey);
    if (cachedMaterials) {
      console.log('Materials loaded from cache:', cachedMaterials.length);
      setMaterials(cachedMaterials);
      return;
    }

    // If not in cache, fetch from Firebase
    try {
      console.log('Fetching materials from Firebase...');
      const materialsRef = collection(db, 'tenants', tenantId, 'materials');
      const q = query(materialsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      const materialsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          categories: Array.isArray(data.categories) ? data.categories.map(String) : [],
        };
      }) as Material[];
      
      console.log('Materials fetched from Firebase:', materialsData.length);
      setMaterials(materialsData);
      
      // Cache the result
      cache.set(cacheKey, materialsData, 60); // Cache for 1 hour
    } catch (error) {
      console.error('Error fetching materials:', error);
      setError('Failed to load materials');
    }
  }, [db, userId, tenantId, cache]);

  const fetchPriceRulesWithCache = useCallback(async () => {
    if (!db || !userId || !tenantId) return;

    const cacheKey = `priceRules_${tenantId}_${userId}`;
    
    // Check cache first
    const cachedPriceRules = cache.get<PriceRule[]>(cacheKey);
    if (cachedPriceRules) {
      console.log('Price rules loaded from cache:', cachedPriceRules.length);
      setPriceRules(cachedPriceRules);
      return;
    }

    // If not in cache, fetch from Firebase
    try {
      console.log('Fetching price rules from Firebase...');
      const q = query(collection(db, 'tenants', tenantId, 'priceRules'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const rules = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
      })) as PriceRule[];
      
      console.log('Price rules fetched from Firebase:', rules.length);
      setPriceRules(rules);
      
      // Cache the result
      cache.set(cacheKey, rules, 120); // Cache for 2 hours
    } catch (error) {
      console.error("Error fetching price rules:", error);
    }
  }, [db, userId, tenantId, cache]);

  // Function to invalidate cache when data changes
  const invalidateCache = useCallback((dataType: 'categories' | 'services' | 'materials' | 'priceRules' | 'all') => {
    if (dataType === 'all') {
      cache.invalidate(`${tenantId}_${userId}`);
    } else {
      cache.remove(`${dataType}_${tenantId}_${userId}`);
    }
  }, [cache, tenantId, userId]);

  // Function to refresh data (bypass cache)
  const refreshData = useCallback(async (dataType?: 'categories' | 'services' | 'materials' | 'priceRules') => {
    if (dataType) {
      invalidateCache(dataType);
      switch (dataType) {
        case 'categories':
          await fetchCategoriesWithCache();
          break;
        case 'services':
          await fetchServicesWithCache();
          break;
        case 'materials':
          await fetchMaterialsWithCache();
          break;
        case 'priceRules':
          await fetchPriceRulesWithCache();
          break;
      }
    } else {
      // Refresh all data
      invalidateCache('all');
      await Promise.all([
        fetchCategoriesWithCache(),
        fetchServicesWithCache(),
        fetchMaterialsWithCache(),
        fetchPriceRulesWithCache()
      ]);
    }
  }, [invalidateCache, fetchCategoriesWithCache, fetchServicesWithCache, fetchMaterialsWithCache, fetchPriceRulesWithCache]);

  const fetchEquipment = useCallback(() => {
    if (!db || !userId || !tenantId) {
      console.error('Cannot fetch equipment: db, userId, or tenantId is missing', { db: !!db, userId: !!userId, tenantId });
      return () => {};
    }
    try {
      console.log('Setting up equipment listener...');
      const equipmentRef = collection(db, 'tenants', tenantId, 'equipment');
      const q = query(equipmentRef, where('userId', '==', userId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const equipmentData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            code: data.code || '',
            name: data.name || '',
            description: data.description || '',
            categoryId: data.categoryId || '',
            categories: Array.isArray(data.categories) ? data.categories.map(String) : [],
            type: data.type || '',
            account: data.account || '',
            costOfSaleAccount: data.costOfSaleAccount || '',
            assetAccount: data.assetAccount || '',
            crossSaleGroup: data.crossSaleGroup || '',
            upgrades: data.upgrades || '',
            recommendationsServices: data.recommendationsServices || '',
            recommendationsMaterials: data.recommendationsMaterials || '',
            dollarBonus: data.dollarBonus || 0,
            paysCommission: data.paysCommission || false,
            bonusPercentage: data.bonusPercentage || 0,
            hours: data.hours || 0,
            payTechSpecificBonus: data.payTechSpecificBonus || false,
            isConfigurable: data.isConfigurable || false,
            taxable: data.taxable || false,
            brand: data.brand || '',
            manufacturer: data.manufacturer || '',
            model: data.model || '',
            cost: data.cost || 0,
            price: data.price || 0,
            memberPrice: data.memberPrice || 0,
            addOnPrice: data.addOnPrice || 0,
            addOnMemberPrice: data.addOnMemberPrice || 0,
            unitOfMeasure: data.unitOfMeasure || '',
            allowDiscounts: data.allowDiscounts || false,
            allowMembershipDiscounts: data.allowMembershipDiscounts || false,
            manufacturerWarrantyDuration: data.manufacturerWarrantyDuration || '',
            manufacturerWarrantyDescription: data.manufacturerWarrantyDescription || '',
            serviceProviderWarrantyDuration: data.serviceProviderWarrantyDuration || '',
            serviceProviderWarrantyDescription: data.serviceProviderWarrantyDescription || '',
            dimensionsH: data.dimensionsH || '',
            dimensionsW: data.dimensionsW || '',
            dimensionsD: data.dimensionsD || '',
            active: data.active !== undefined ? data.active : true,
            replenishment: data.replenishment || false,
            vendors: Array.isArray(data.vendors) ? data.vendors : [],
            notes: data.notes || '',
          };
        });
        // Add linkedMaterials property to each equipment item to fix type error
        const equipmentWithLinkedMaterials = equipmentData.map(item => ({
          ...item,
          linkedMaterials: []
        }));
        setEquipment(equipmentWithLinkedMaterials);
      }, (error) => {
        console.error('Error in equipment listener:', error);
        setError('Failed to load equipment');
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up equipment listener:', error);
      setError('Failed to load equipment');
      return () => {};
    }
  }, [db, userId, tenantId]);

  useEffect(() => {
    if (db && userId && tenantId) {
      const ref = collection(db, 'tenants', tenantId, 'glAccounts');
      const unsub = onSnapshot(ref, snap => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GLAccount[];
        setGlAccounts(data);
      });
      return () => unsub();
    }
  }, [db, userId, tenantId]);

  const fetchCategories = useCallback(() => {
    if (!db || !userId || !tenantId) {
      console.error('Cannot fetch categories: db, userId, or tenantId is missing', { db: !!db, userId: !!userId, tenantId });
      return () => {};
    }
    try {
      console.log('Setting up categories listener...');
      const categoriesRef = collection(db, 'tenants', tenantId, 'categories');
      const q = query(categoriesRef, where('userId', '==', userId));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log('Categories snapshot update:', {
          empty: snapshot.empty,
          size: snapshot.size,
          docs: snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
        });
        
        const categoriesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Category[];
        
        console.log('Processed categories:', categoriesData);
        setCategories(categoriesData);
      }, (error) => {
        console.error('Error in categories listener:', error);
        setError('Failed to load categories');
      });
      
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up categories listener:', error);
      setError('Failed to load categories');
      return () => {};
    }
  }, [db, userId, tenantId]);

  const fetchServices = useCallback(() => {
    if (!db || !userId || !tenantId) {
      console.error('Cannot fetch services: db, userId, or tenantId is missing', { db: !!db, userId: !!userId, tenantId });
      return () => {};
    }
    try {
      console.log('Setting up services listener...');
      const servicesRef = collection(db, 'tenants', tenantId, 'services');
      const q = query(servicesRef, where('userId', '==', userId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const servicesData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            categories: Array.isArray(data.categories) ? data.categories.map(String) : [],
          };
        }) as Service[];
        console.log('Processed services:', servicesData);
        setServices(servicesData);
      }, (error) => {
        console.error('Error in services listener:', error);
        setError('Failed to load services');
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up services listener:', error);
      setError('Failed to load services');
      return () => {};
    }
  }, [db, userId, tenantId]);

  const fetchMaterials = useCallback(() => {
    if (!db || !userId || !tenantId) {
      console.error('Cannot fetch materials: db, userId, or tenantId is missing', { db: !!db, userId: !!userId, tenantId });
      return () => {};
    }
    try {
      console.log('Setting up materials listener...');
      const materialsRef = collection(db, 'tenants', tenantId, 'materials');
      const q = query(materialsRef, where('userId', '==', userId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const materialsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            categories: Array.isArray(data.categories) ? data.categories.map(String) : [],
          };
        }) as Material[];
        console.log('Processed materials:', materialsData);
        setMaterials(materialsData);
      }, (error) => {
        console.error('Error in materials listener:', error);
        setError('Failed to load materials');
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up materials listener:', error);
      setError('Failed to load materials');
      return () => {};
    }
  }, [db, userId, tenantId]);

  const fetchPriceRules = async () => {
    if (!db || !userId || !tenantId) return;
    try {
      const q = query(collection(db, 'tenants', tenantId, 'priceRules'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const rules = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
      })) as PriceRule[];
      setPriceRules(rules);
    } catch (error) {
      console.error("Error fetching price rules:", error);
    }
  };

  // Load data on component mount using cached functions
  useEffect(() => {
    if (db && userId && tenantId) {
      setIsLoading(true);
      const loadData = async () => {
        try {
          console.log('Loading pricebook data with caching...');
          await Promise.all([
            fetchCategoriesWithCache(),
            fetchServicesWithCache(),
            fetchMaterialsWithCache(),
            fetchPriceRulesWithCache()
          ]);
          console.log('All pricebook data loaded');
        } catch (error) {
          console.error('Error loading pricebook data:', error);
          setError('Failed to load pricebook data');
        } finally {
          setIsLoading(false);
        }
      };
      
      loadData();
    } else {
      console.error('Cannot load data: db, userId, or tenantId is missing', { db: !!db, userId: !!userId, tenantId });
    }
  }, [db, userId, tenantId, fetchCategoriesWithCache, fetchServicesWithCache, fetchMaterialsWithCache, fetchPriceRulesWithCache]);

  const handleAddService = () => {
    setServiceForm(initialServiceForm);
    setShowAddServiceModal(true);
  };

  const handleEditService = (service: Service) => {
    setServiceForm({
      ...initialServiceForm,
      ...service,
      categories: Array.isArray(service.categories) ? service.categories : [],
      crossSaleGroup: Array.isArray(service.crossSaleGroup) ? service.crossSaleGroup : [],
    });
    setEditingService(service);
    setShowEditServiceModal(true);
  };

  const handleUpdateService = async () => {
    if (!db || !editingService || !tenantId) return;
    setServiceSaving(true);
    setServiceError(null);
    try {
      const serviceRef = doc(db, 'tenants', tenantId, 'services', editingService.id);
      await updateDoc(serviceRef, {
        ...serviceForm,
        categories: Array.isArray(serviceForm.categories) ? serviceForm.categories.map(String) : [],
        updatedAt: serverTimestamp(),
      });
      
      // Invalidate cache and refresh services
      invalidateCache('services');
      await fetchServicesWithCache();
      
      setShowEditServiceModal(false);
      setEditingService(null);
      setServiceForm(initialServiceForm);
    } catch (error: any) {
      setServiceError(error.message || 'Error updating service');
    } finally {
      setServiceSaving(false);
    }
  };

  const handleAddMaterial = async () => {
    if (!db || !userId || !tenantId) return;
    setMaterialSaving(true);
    setMaterialError(null);
    try {
      await addDoc(collection(db, 'tenants', tenantId, 'materials'), {
        ...materialForm,
        categories: Array.isArray(materialForm.categories) ? materialForm.categories.map(String) : [],
        code: generateMaterialCode(),
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Invalidate cache and refresh materials
      invalidateCache('materials');
      await fetchMaterialsWithCache();
      
      setShowAddMaterialModal(false);
      setMaterialForm(initialMaterialFormState);
    } catch (error: any) {
      setMaterialError(error.message || 'Error saving material');
    } finally {
      setMaterialSaving(false);
    }
  };

  const handleUpdateMaterial = async () => {
    if (!db || !editingMaterial || !tenantId) return;
    setMaterialSaving(true);
    setMaterialError(null);
    try {
      const materialRef = doc(db, 'tenants', tenantId, 'materials', editingMaterial.id);
      await updateDoc(materialRef, {
        ...materialForm,
        categories: Array.isArray(materialForm.categories) ? materialForm.categories.map(String) : [],
        updatedAt: serverTimestamp(),
      });
      await fetchMaterials();
      setShowEditMaterialModal(false);
      setEditingMaterial(null);
      setMaterialForm(initialMaterialFormState);
    } catch (error: any) {
      setMaterialError(error.message || 'Error updating material');
    } finally {
      setMaterialSaving(false);
    }
  };

  // Generic form change handler
  const handleFormChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (field: keyof T, value: any) => {
    setter(prev => ({...prev, [field]: value}));
  };

  const handleServiceFormChange = handleFormChange(setServiceForm);
  const handleMaterialFormChange = handleFormChange(setMaterialForm);
  const handleCategoryFormChange = handleFormChange(setCategoryFormState);

  const handleImportComplete = useCallback(async (data: ImportedItem[]) => {
    if (!db || !userId) {
      console.error('Cannot import: db or userId is missing', { db: !!db, userId: !!userId });
      return;
    }
    setIsLoading(true);

    try {
      console.log('DEBUG: First 5 imported items:', data.slice(0, 5));
      console.log('Starting import with data:', {
        totalItems: data.length,
        sheets: [...new Set(data.map(item => item._sheet))],
        sampleData: data.slice(0, 2)
      });

      // Prepare all writes
      const writes: { collection: string; docId: string; docData: any }[] = [];

      // Categories
      let categoryItems = data.filter(item => item._sheet === 'Categories');
      // Filter out blank/empty rows
      categoryItems = categoryItems.filter(item => Object.values(item).some(val => val !== null && val !== undefined && val !== ''));
      console.log('Categories to import:', categoryItems.slice(0, 3));
      categoryItems.forEach(item => {
        try {
                      const docId = item['Category ID'] || (tenantId ? doc(collection(db, 'tenants', tenantId, 'categories')).id : '');
          const docData: any = { userId };
          Object.keys(item).forEach(key => {
            if (key !== '_sheet' && key !== '_row') {
              docData[key] = item[key] === undefined ? null : item[key];
            }
          });
          writes.push({ collection: 'categories', docId, docData });
        } catch (error) {
          console.error('Error processing category item:', { item, error });
        }
      });

      // Services
      let serviceItems = data.filter(item => item._sheet === 'Services');
      serviceItems = serviceItems.filter(item => Object.values(item).some(val => val !== null && val !== undefined && val !== ''));
      console.log('Services to import:', serviceItems.slice(0, 3));
      serviceItems.forEach(item => {
        try {
                      const docId = item['serviceTitanId'] || doc(collection(db, 'tenants', tenantId, 'services')).id;
          const docData: any = { userId };
          Object.keys(item).forEach(key => {
            if (key !== '_sheet' && key !== '_row') {
              docData[key] = item[key] === undefined ? null : item[key];
            }
          });
          writes.push({ collection: 'services', docId, docData });
        } catch (error) {
          console.error('Error processing service item:', { item, error });
        }
      });

      // Materials
      let materialItems = data.filter(item => item._sheet === 'Materials');
      materialItems = materialItems.filter(item => Object.values(item).some(val => val !== null && val !== undefined && val !== ''));
      console.log('Materials to import:', materialItems.slice(0, 3));
      materialItems.forEach(item => {
        try {
                      const docId = item['serviceTitanId'] || doc(collection(db, 'tenants', tenantId, 'materials')).id;
          const docData: any = { userId };
          Object.keys(item).forEach(key => {
            if (key !== '_sheet' && key !== '_row') {
              docData[key] = item[key] === undefined ? null : item[key];
            }
          });
          writes.push({ collection: 'materials', docId, docData });
        } catch (error) {
          console.error('Error processing material item:', { item, error });
        }
      });

      // Split writes into batches of 500
      const totalBatches = Math.ceil(writes.length / BATCH_LIMIT);
      console.log(`Total writes: ${writes.length}, batching into ${totalBatches} batches...`);
      for (let i = 0; i < totalBatches; i++) {
        const batch = writeBatch(db);
        const batchWrites = writes.slice(i * BATCH_LIMIT, (i + 1) * BATCH_LIMIT);
        batchWrites.forEach(({ collection, docId, docData }) => {
          // Check if collection already contains the full path
          const docRef = collection.includes('tenants/') 
            ? doc(db, collection, docId)
            : doc(db, 'tenants', tenantId, collection, docId);
          batch.set(docRef, docData);
        });
        try {
          console.log(`Committing batch ${i + 1} of ${totalBatches} (${batchWrites.length} writes)...`);
          await batch.commit();
          console.log(`Batch ${i + 1} committed successfully.`);
        } catch (error) {
          console.error(`Error committing batch ${i + 1}:`, error);
        }
      }

      setShowImportModal(false);
      // Refresh the data
      console.log('Refreshing data after import...');
      await Promise.all([
        fetchCategories(),
        fetchServices(),
        fetchMaterials()
      ]);
      console.log('Data refresh complete');
    } catch (error) {
      console.error('Error during import process:', error);
      setError('An error occurred during the import.');
    } finally {
      setIsLoading(false);
    }
  }, [db, userId, fetchCategories, fetchServices, fetchMaterials]);

  const handleRestoreData = async () => {
    if (!db || !userId) return;
    
    if (!window.confirm('This will restore the default pricebook data. Any existing data will be overwritten. Continue?')) {
      return;
    }

    try {
      if (tenantId) {
        await restorePricebookData(db, userId, tenantId);
      }
      alert('Pricebook data restored successfully!');
    } catch (error) {
      console.error('Error restoring pricebook data:', error);
      alert('Failed to restore pricebook data. Please try again.');
    }
  };

  // Add filtering logic
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const searchMatch = (service.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (service.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (service.code || '').toLowerCase().includes(searchTerm.toLowerCase());
      const categoryMatch = selectedCategory === 'all' || 
                          (service.categories || []).includes(selectedCategory);
      return searchMatch && categoryMatch;
    });
  }, [services, searchTerm, selectedCategory]);

  const filteredMaterials = useMemo(() => {
    return materials.filter(material => {
      const searchMatch = (material.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (material.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (material.code || '').toLowerCase().includes(searchTerm.toLowerCase());
      const categoryMatch = selectedCategory === 'all' || 
                          (material.categories || []).includes(selectedCategory);
      return searchMatch && categoryMatch;
    });
  }, [materials, searchTerm, selectedCategory]);

  // Add debug logging for filtered data
  useEffect(() => {
    console.log('Current state:', {
      services: {
        total: services.length,
        filtered: filteredServices.length,
        items: filteredServices
      },
      materials: {
        total: materials.length,
        filtered: filteredMaterials.length,
        items: filteredMaterials
      },
      categories: {
        total: categories.length,
        items: categories
      },
      searchTerm,
      selectedCategory
    });
  }, [services, materials, categories, filteredServices, filteredMaterials, searchTerm, selectedCategory]);

  // Handle select all
  const handleSelectAllServices = (checked: boolean) => {
    setSelectAllServices(checked);
    if (checked) {
      setSelectedServiceIds(filteredServices.map(s => s.id));
    } else {
      setSelectedServiceIds([]);
    }
  };

  // Handle individual select
  const handleSelectService = (id: string, checked: boolean) => {
    setSelectedServiceIds(prev =>
      checked ? [...prev, id] : prev.filter(sid => sid !== id)
    );
  };

  // Bulk delete handler
  const handleBulkDeleteServices = async () => {
    if (!db || selectedServiceIds.length === 0) return;
    setIsDeleting(true);
    try {
      const totalBatches = Math.ceil(selectedServiceIds.length / BATCH_LIMIT);
      for (let i = 0; i < totalBatches; i++) {
        const batch = writeBatch(db);
        const batchIds = selectedServiceIds.slice(i * BATCH_LIMIT, (i + 1) * BATCH_LIMIT);
        batchIds.forEach(id => {
          console.log('Bulk delete doc id:', id, 'type:', typeof id);
          const docRef = doc(db, 'tenants', tenantId, 'services', String(id));
          batch.delete(docRef);
        });
        await batch.commit();
      }
      setSelectedServiceIds([]);
      setSelectAllServices(false);
      await fetchServices();
    } catch (error) {
      console.error('Bulk delete error:', error);
      setError('Failed to delete selected services.');
    } finally {
      setIsDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  // Handle select all for materials
  const handleSelectAllMaterials = (checked: boolean) => {
    setSelectAllMaterials(checked);
    if (checked) {
      setSelectedMaterialIds(filteredMaterials.map(m => m.id));
    } else {
      setSelectedMaterialIds([]);
    }
  };

  // Handle individual select for materials
  const handleSelectMaterial = (id: string, checked: boolean) => {
    setSelectedMaterialIds(prev =>
      checked ? [...prev, id] : prev.filter(mid => mid !== id)
    );
  };

  // Bulk delete handler for materials
  const handleBulkDeleteMaterials = async () => {
    if (!db || selectedMaterialIds.length === 0) return;
    setIsDeletingMaterials(true);
    try {
      const totalBatches = Math.ceil(selectedMaterialIds.length / BATCH_LIMIT);
      for (let i = 0; i < totalBatches; i++) {
        const batch = writeBatch(db);
        const batchIds = selectedMaterialIds.slice(i * BATCH_LIMIT, (i + 1) * BATCH_LIMIT);
        batchIds.forEach(id => {
          const docRef = doc(db, 'tenants', tenantId, 'materials', String(id));
          batch.delete(docRef);
        });
        await batch.commit();
      }
      setSelectedMaterialIds([]);
      setSelectAllMaterials(false);
      await fetchMaterials();
    } catch (error) {
      console.error('Bulk delete error:', error);
      setError('Failed to delete selected materials.');
    } finally {
      setIsDeletingMaterials(false);
      setShowBulkDeleteMaterialsDialog(false);
    }
  };

  const handleAddCategory = async (formData: CategoryFormState) => {
    if (!db || !userId) return;

    try {
      const categoryRef = await addDoc(collection(db, 'tenants', tenantId, 'categories'), {
        ...formData,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update any services/materials that should be in this category
      if (formData.type === 'service') {
        const servicesRef = collection(db, 'tenants', tenantId, 'services');
        const q = query(servicesRef, where('userId', '==', userId));
        const servicesSnapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        servicesSnapshot.docs.forEach(doc => {
          const service = doc.data();
          if (service.categories.includes(formData.serviceTitanId)) {
            batch.update(doc.ref, {
              categories: [...service.categories, categoryRef.id],
              updatedAt: serverTimestamp(),
            });
          }
        });
        await batch.commit();
      } else if (formData.type === 'material') {
        const materialsRef = collection(db, 'tenants', tenantId, 'materials');
        const q = query(materialsRef, where('userId', '==', userId));
        const materialsSnapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        materialsSnapshot.docs.forEach(doc => {
          const material = doc.data();
          if (material.categories.includes(formData.serviceTitanId)) {
            batch.update(doc.ref, {
              categories: [...material.categories, categoryRef.id],
              updatedAt: serverTimestamp(),
            });
          }
        });
        await batch.commit();
      }
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  };

  const handleUpdateCategory = async (formData: CategoryFormState) => {
    if (!db || !userId || !editingCategory) return;

    try {
      const categoryRef = doc(db, 'tenants', tenantId, 'categories', editingCategory.id);
      await updateDoc(categoryRef, {
        ...formData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!db || !userId) return;

    if (!window.confirm(`Are you sure you want to delete the category "${category.name}"? This will also remove it from all associated services and materials.`)) {
      return;
    }

    try {
      // First, update all services and materials that reference this category
      const batch = writeBatch(db);
      
      // Update services
      const servicesRef = collection(db, 'tenants', tenantId, 'services');
      const servicesQuery = query(servicesRef, where('userId', '==', userId));
      const servicesSnapshot = await getDocs(servicesQuery);
      
      servicesSnapshot.docs.forEach(doc => {
        const service = doc.data();
        if (service.categories.includes(category.id)) {
          batch.update(doc.ref, {
            categories: service.categories.filter((id: string) => id !== category.id),
            updatedAt: serverTimestamp(),
          });
        }
      });

      // Update materials
              const materialsRef = collection(db, 'tenants', tenantId, 'materials');
      const materialsQuery = query(materialsRef, where('userId', '==', userId));
      const materialsSnapshot = await getDocs(materialsQuery);
      
      materialsSnapshot.docs.forEach(doc => {
        const material = doc.data();
        if (material.categories.includes(category.id)) {
          batch.update(doc.ref, {
            categories: material.categories.filter((id: string) => id !== category.id),
            updatedAt: serverTimestamp(),
          });
        }
      });

      // Delete the category
              batch.delete(doc(db, 'tenants', tenantId, 'categories', category.id));
      
      await batch.commit();
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  };

  // Move CategoryTree inside Pricebook component
  const CategoryTree: React.FC<{ cat: Category; categories: Category[]; onAddSub: (parentId: string) => void; onEdit: (cat: Category) => void; onDelete: (cat: Category) => void; }> = ({ cat, categories, onAddSub, onEdit, onDelete }) => {
    const [expanded, setExpanded] = useState(false);
    const subcats = categories.filter(c => c.parentId === cat.id);
    const hasSubcats = subcats.length > 0;
    const assignedRule = cat.priceRuleId ? priceRules.find((r: PriceRule) => r.id === cat.priceRuleId) : null;

    return (
      <div className="pl-4 border-l border-gray-200 dark:border-slate-700">
        <div className="flex items-center py-1">
          {hasSubcats && (
            <button onClick={() => setExpanded(!expanded)} className="p-1 mr-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700">
              <ChevronRight size={16} className={expanded ? "rotate-90" : ""} />
            </button>
          )}
          <Folder size={16} className="mr-2 text-gray-500" />
          <span className="font-medium">{cat.name}</span>
          {cat.description && <span className="ml-2 text-sm text-gray-500"> – {cat.description}</span>}
          {assignedRule && <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full"> {assignedRule.name} </span>}
          <div className="ml-auto flex space-x-1">
            <button onClick={() => onAddSub(cat.id)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700" title="Add Subcategory">
              <Plus size={16} />
            </button>
            <button onClick={() => onEdit(cat)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700" title="Edit">
              <Edit size={16} />
            </button>
            <button onClick={() => onDelete(cat)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700" title="Delete">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        {expanded && hasSubcats && (
          <div className="mt-1">
            {subcats.map(sub => (
              <CategoryTree key={sub.id} cat={sub} categories={categories} onAddSub={onAddSub} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Add handleAddPriceRule function
  const handleAddPriceRule = async (formData: PriceRuleForm) => {
    if (!db || !userId) return;
    try {
      await addDoc(collection(db, 'tenants', tenantId, 'priceRules'), {
        ...formData,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowAddPriceRuleModal(false);
    } catch (error) {
      console.error("Error adding price rule:", error);
      throw error;
    }
  };

  // Add handleUpdatePriceRule function
  const handleUpdatePriceRule = async (formData: PriceRuleForm) => {
    if (!db || !editingPriceRule) return;
    try {
      const priceRuleRef = doc(db, 'priceRules', editingPriceRule.id);
      await updateDoc(priceRuleRef, {
        ...formData,
        updatedAt: serverTimestamp(),
      });
      await fetchPriceRules();
      setShowEditPriceRuleModal(false);
      setEditingPriceRule(null);
    } catch (error) {
      console.error("Error updating price rule:", error);
      throw error;
    }
  };

  // Add handleDeletePriceRule function
  const handleDeletePriceRule = async (priceRule: PriceRule) => {
    if (!db || !userId) return;

    if (!window.confirm(`Are you sure you want to delete the price rule "${priceRule.name}"? This will remove it from all associated categories.`)) {
      return;
    }

    try {
      // First, update all categories that reference this price rule
      const batch = writeBatch(db);
      
      // Update categories
              const categoriesRef = collection(db, 'tenants', tenantId, 'categories');
      const categoriesQuery = query(categoriesRef, where('userId', '==', userId));
      const categoriesSnapshot = await getDocs(categoriesQuery);
      
      categoriesSnapshot.docs.forEach(doc => {
        const category = doc.data();
        if (category.priceRuleId === priceRule.id) {
          batch.update(doc.ref, {
            priceRuleId: null,
            updatedAt: serverTimestamp(),
          });
        }
      });

      // Delete the price rule
      batch.delete(doc(db, 'priceRules', priceRule.id));
      
      await batch.commit();
    } catch (error) {
      console.error('Error deleting price rule:', error);
      throw error;
    }
  };

  // Add this wrapper before the return statement in Pricebook
  const handleSetServiceForm = (form: typeof serviceForm) => setServiceForm(form);

  const handleDeleteService = async (serviceId: string) => {
    if (!db || !userId) return;
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    try {
      await deleteDoc(doc(db, 'tenants', tenantId, 'services', String(serviceId)));
      await fetchServices(); // Refresh list
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!db || !userId) return;
    if (!window.confirm('Are you sure you want to delete this material?')) return;
    try {
      await deleteDoc(doc(db, 'tenants', tenantId, 'materials', String(materialId)));
      await fetchMaterials(); // Refresh list
    } catch (error) {
      console.error('Error deleting material:', error);
    }
  };

  // Update the service calculation to avoid variable redeclaration
  const calculateServicePrice = (service: Service) => {
    if (!service.useDynamicPricing) return service.staticPrice || 0;

    // Find the most specific price rule: assigned to service, then to category
    let applicablePriceRule = priceRules.find(rule => rule.active && rule.assignedServices.includes(service.id));
    if (!applicablePriceRule) {
      applicablePriceRule = priceRules.find(rule => rule.active && rule.assignedCategories.some(catId => service.categories.includes(catId)));
    }
    if (!applicablePriceRule) return service.staticPrice || 0;

    // Labor cost
    const laborCost = (applicablePriceRule.baseRate || 0) * (service.hours || 0);
    // Materials cost
    const materialsCost = (service.linkedMaterials || []).reduce((sum, materialId) => {
      const material = materials.find(m => m.id === materialId);
      return sum + (material?.cost || 0);
    }, 0);
    // Markups
    const materialMarkup = materialsCost * ((applicablePriceRule.materialMarkup || 0) / 100);
    const laborMarkup = laborCost * ((applicablePriceRule.laborMarkup || 0) / 100);

    return laborCost + materialsCost + materialMarkup + laborMarkup;
  };

  // Implement handleSaveService for Add Service modal
  const handleSaveService = async () => {
    if (!db || !userId || !tenantId) return;
    setServiceSaving(true);
    setServiceError(null);
    try {
      await addDoc(collection(db, 'tenants', tenantId, 'services'), {
        ...serviceForm,
        categoryID: Array.isArray(serviceForm.categories) && serviceForm.categories.length > 0 ? serviceForm.categories[0] : '',
        categories: undefined, // Remove categories array for services
        code: generateServiceCode(),
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowAddServiceModal(false);
      setServiceForm(initialServiceForm);
      await fetchServices();
    } catch (error: any) {
      setServiceError(error.message || 'Error saving service');
    } finally {
      setServiceSaving(false);
    }
  };

  const paginatedServices = filteredServices.slice((currentServicePage - 1) * ITEMS_PER_PAGE, currentServicePage * ITEMS_PER_PAGE);
  const paginatedMaterials = filteredMaterials.slice((currentMaterialPage - 1) * ITEMS_PER_PAGE, currentMaterialPage * ITEMS_PER_PAGE);

  // Handle select all for categories
  const handleSelectAllCategories = (checked: boolean) => {
    setSelectAllCategories(checked);
    if (checked) {
      setSelectedCategoryIds(categories.map(c => c.id));
    } else {
      setSelectedCategoryIds([]);
    }
  };

  // Handle individual select for categories
  const handleSelectCategory = (id: string, checked: boolean) => {
    setSelectedCategoryIds(prev =>
      checked ? [...prev, id] : prev.filter(cid => cid !== id)
    );
  };

  // Bulk delete handler for categories
  const handleBulkDeleteCategories = async () => {
    if (!db || selectedCategoryIds.length === 0) return;
    setIsDeletingCategories(true);
    try {
      const totalBatches = Math.ceil(selectedCategoryIds.length / BATCH_LIMIT);
      for (let i = 0; i < totalBatches; i++) {
        const batch = writeBatch(db);
        const batchIds = selectedCategoryIds.slice(i * BATCH_LIMIT, (i + 1) * BATCH_LIMIT);
        batchIds.forEach(id => {
          const docRef = doc(db, 'tenants', tenantId, 'categories', String(id));
          batch.delete(docRef);
        });
        await batch.commit();
      }
      setSelectedCategoryIds([]);
      setSelectAllCategories(false);
      await fetchCategories();
    } catch (error) {
      console.error('Bulk delete error:', error);
      setError('Failed to delete selected categories.');
    } finally {
      setIsDeletingCategories(false);
      setShowBulkDeleteCategoriesDialog(false);
    }
  };

  const handleSelectAllEquipment = (checked: boolean) => {
    setSelectAllEquipment(checked);
    setSelectedEquipmentIds(checked ? equipment.map(e => e.code) : []);
  };
  const handleSelectEquipment = (id: string, checked: boolean) => {
    setSelectedEquipmentIds(prev => checked ? [...prev, id] : prev.filter(eid => eid !== id));
  };
  const handleBulkDeleteEquipment = async () => {
    if (!db || selectedEquipmentIds.length === 0) return;
    setIsDeletingEquipment(true);
    try {
      const totalBatches = Math.ceil(selectedEquipmentIds.length / BATCH_LIMIT);
      for (let i = 0; i < totalBatches; i++) {
        const batch = writeBatch(db);
        const batchIds = selectedEquipmentIds.slice(i * BATCH_LIMIT, (i + 1) * BATCH_LIMIT);
        batchIds.forEach(id => {
          const docRef = doc(db, 'tenants', tenantId, 'equipment', String(id));
          batch.delete(docRef);
        });
        await batch.commit();
      }
      setSelectedEquipmentIds([]);
      setSelectAllEquipment(false);
      await fetchEquipment();
    } catch (error) {
      console.error('Bulk delete error:', error);
      setError('Failed to delete selected equipment.');
    } finally {
      setIsDeletingEquipment(false);
      setShowBulkDeleteEquipmentDialog(false);
    }
  };

  const handleAddEquipment = async () => {
    if (!db || !userId || !tenantId) return;
    setEquipmentSaving(true);
    setEquipmentError(null);
    try {
      await addDoc(collection(db, 'tenants', tenantId, 'equipment'), {
        ...equipmentForm,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowAddEquipmentModal(false);
      setEquipmentForm(initialEquipmentFormState);
      await fetchEquipment();
    } catch (error) {
      console.error('Error adding equipment:', error);
      setEquipmentError('Failed to add equipment. Please try again.');
    } finally {
      setEquipmentSaving(false);
    }
  };

  const handleUpdateEquipment = async () => {
    if (!db || !editingEquipment || !tenantId) return;
    setEquipmentSaving(true);
    setEquipmentError(null);
    try {
      const equipmentRef = doc(db, 'tenants', tenantId, 'equipment', editingEquipment.code);
      await updateDoc(equipmentRef, {
        ...equipmentForm,
        updatedAt: serverTimestamp(),
      });
      setShowEditEquipmentModal(false);
      setEditingEquipment(null);
      setEquipmentForm(initialEquipmentFormState);
      await fetchEquipment();
    } catch (error) {
      console.error('Error updating equipment:', error);
      setEquipmentError('Failed to update equipment. Please try again.');
    } finally {
      setEquipmentSaving(false);
    }
  };

  const handleDeleteEquipment = async (equipmentCode: string) => {
    if (!db || !tenantId) return;
    if (!window.confirm('Are you sure you want to delete this equipment?')) return;
    try {
      await deleteDoc(doc(db, 'tenants', tenantId, 'equipment', String(equipmentCode)));
      await fetchEquipment();
    } catch (error) {
      console.error('Error deleting equipment:', error);
      setError('Failed to delete equipment.');
    }
  };

  const handleDeactivateService = async (service: Service) => {
    if (!db) return;
    await updateDoc(doc(db, 'tenants', tenantId, 'services', service.id), { active: false, updatedAt: serverTimestamp() });
    await fetchServices();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pricebook data...</p>
        </div>
      </div>
    );
  }
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  const equipmentCategories = categories.filter(cat => cat.type === 'equipment');

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Pricebook</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage services, materials, and pricing</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => refreshData()}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-800 dark:text-gray-200 flex items-center"
            title="Refresh all data from Firebase"
          >
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </button>
          <Menu as="div" className="relative inline-block text-left">
            <Menu.Button className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-800 dark:text-gray-200 flex items-center">
              <Upload size={16} className="mr-2 inline" />
              Import
              <ChevronDown size={16} className="ml-1" />
            </Menu.Button>
            <Menu.Items className="absolute right-0 mt-2 w-64 origin-top-right bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg z-20 focus:outline-none">
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`w-full text-left px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                    onClick={() => setShowImportModal(true)}
                  >
                    Import Pricebook Data
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`w-full text-left px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                    onClick={() => setShowImportMaterialLinks(true)}
                  >
                    Import Material Links
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`w-full text-left px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                    onClick={() => setShowImportEquipmentLinks(true)}
                  >
                    Import Equipment Links
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`w-full text-left px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                    onClick={() => setShowImportEquipmentMaterialLinks(true)}
                  >
                    Import Equipment Material Links
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Menu>
          <button className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-800 dark:text-gray-200">
            <Download size={16} className="mr-2 inline" />
            Export
          </button>
          <button
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-800 dark:text-gray-200"
            onClick={() => setShowCustomerImport(true)}
          >
            Import Customers
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('services')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'services'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            <FileText size={16} className="mr-2 inline" />
            Services
          </button>
          <button
            onClick={() => setActiveTab('materials')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'materials'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            <Package size={16} className="mr-2 inline" />
            Materials
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'equipment'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            <Settings size={16} className="mr-2 inline" />
            Equipment
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            <Folder size={16} className="mr-2 inline" />
            Categories
          </button>
          <button
            onClick={() => setActiveTab('priceBuilder')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'priceBuilder'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            <Calculator size={16} className="mr-2 inline" />
            Price Builder
          </button>
        </nav>
      </div>

      {/* Services Tab Content */}
      {activeTab === 'services' && (
        <div>
          {/* Search and Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
            </div>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
            >
              <option value="all">All Categories</option>
              {categories.filter(cat => cat.type === 'service').map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <button
              onClick={handleAddService}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} className="mr-2 inline" />
              Add Service
            </button>
          </div>

          {/* Services Table */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {/* Checkbox header */}
                        <input type="checkbox" checked={selectAllServices} onChange={e => handleSelectAllServices(e.target.checked)} />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Hours
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {paginatedServices.map(service => {
                      const displayPrice = calculateServicePrice(service);

                      return (
                        <tr key={service.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                          {/* Add a checkbox for selecting this service */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <input
                              type="checkbox"
                              checked={selectedServiceIds.includes(service.id)}
                              onChange={e => handleSelectService(service.id, e.target.checked)}
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                            {service.code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{service.name}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{service.description}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                            <div className="flex items-center">
                              ${displayPrice.toFixed(2)}
                              {service.useDynamicPricing && (
                                <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                                  Dynamic
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                            {service.hours}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                            <Menu as="div" className="relative inline-block text-left">
                              <Menu.Button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none">
                                <MoreHorizontal size={20} />
                              </Menu.Button>
                              <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg z-20 focus:outline-none">
                                <Menu.Item>
                                  {({ active }) => (
                                    <button
                                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                                      onClick={() => handleEditService(service)}
                                    >
                                      <Edit size={16} /> View/Edit Service
                                    </button>
                                  )}
                                </Menu.Item>
                                <Menu.Item>
                                  {({ active }) => (
                                    <button
                                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                                      onClick={async () => {
                                        if (!db || !userId) return;
                                        let baseCode = service.code.replace(/ \(\d+\)$/, '');
                                        let count = 1;
                                        let newCode = `${baseCode} (${count})`;
                                        while (services.some(s => s.code === newCode)) {
                                          count++;
                                          newCode = `${baseCode} (${count})`;
                                        }
                                        await addDoc(collection(db, 'tenants', tenantId, 'services'), {
                                          ...service,
                                          code: newCode,
                                          active: true,
                                          createdAt: serverTimestamp(),
                                          updatedAt: serverTimestamp(),
                                          userId,
                                        });
                                        await fetchServices();
                                      }}
                                    >
                                      <CopyPlus size={16} /> Duplicate
                                    </button>
                                  )}
                                </Menu.Item>
                                <Menu.Item>
                                  {({ active }) => (
                                    <button
                                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                                      onClick={() => handleDeactivateService(service)}
                                    >
                                      <Power size={16} /> Deactivate
                                    </button>
                                  )}
                                </Menu.Item>
                                <Menu.Item>
                                  {({ active }) => (
                                    <button
                                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 ${active ? 'bg-red-50 dark:bg-red-900' : ''}`}
                                      onClick={() => { setServiceToDelete(service); setShowDeleteWarning(true); }}
                                    >
                                      <Trash2 size={16} /> Delete
                                    </button>
                                  )}
                                </Menu.Item>
                              </Menu.Items>
                            </Menu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          {/* Add pagination controls */}
          <div className="flex justify-center items-center gap-4 mt-2">
            <button disabled={currentServicePage === 1} onClick={() => setCurrentServicePage(currentServicePage - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
            <span>Page {currentServicePage} of {Math.max(1, Math.ceil(filteredServices.length / ITEMS_PER_PAGE))}</span>
            <button disabled={currentServicePage === Math.ceil(filteredServices.length / ITEMS_PER_PAGE) || filteredServices.length === 0} onClick={() => setCurrentServicePage(currentServicePage + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {showImportModal && (
        <Dialog open={showImportModal} onClose={() => { setShowImportModal(false); setImportStep(1); setImportSource(null); }}>
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
              <Dialog.Title className="text-lg font-bold mb-4">Import Pricebook Data</Dialog.Title>
              
              {/* Step 1: Import Source Selection */}
              {!importSource && (
                <div className="space-y-4">
                  <button
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-2"
                    onClick={() => { setImportSource('servicetitan'); setImportStep(1); }}
                  >
                    Import from ServiceTitan
                  </button>
                  <button
                    className="w-full px-4 py-3 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors mb-2"
                    onClick={() => setImportSource('housecall')}
                  >
                    Import from Housecall Pro
                  </button>
                  <button
                    className="w-full px-4 py-3 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                    onClick={() => setImportSource('csv')}
                  >
                    Import from CSV/XLSX
                  </button>
                  <button
                    className="w-full px-4 py-2 mt-2 border rounded text-gray-600 dark:text-gray-300"
                    onClick={() => setShowImportModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Step 1: ServiceTitan Categories Import */}
              {(importSource === 'servicetitan' && importStep === 1) && (
                <div className="text-center p-8">
                  <h3 className="text-lg font-semibold mb-2">Import Categories from ServiceTitan</h3>
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setServiceTitanImportFile(file); // Store file for later steps
                      const data = await file.arrayBuffer();
                      const workbook = XLSX.read(data, { type: 'array' });
                      const sheet = workbook.Sheets['Categories'] || workbook.Sheets['Category'];
                      if (!sheet) {
                        alert('No Categories sheet found!');
                        return;
                      }
                      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
                      const headers: string[] = (rawData[0] as unknown[]).map((cell: unknown) => String(cell || ''));
                      const rows: any[][] = rawData.slice(1) as any[][];
                      const categoryColumns = ['Id', 'Category1', 'Category2', 'Category3', 'Category4', 'Category5', 'Category6', 'Category7', 'Category8', 'CategoryType'];
                      const headerIndexes = categoryColumns.map(col =>
                        headers.findIndex(h => h && h.trim().toLowerCase() === col.toLowerCase())
                      );
                      const filteredHeaders = headerIndexes.map(i => headers[i]);
                      const filteredRows = rows.map(row => row.slice(0, 9));
                      const parsedCategories = parseServiceTitanCategoryHierarchy(filteredRows, filteredHeaders);
                      const categoryTypeIndex = headers.findIndex(h => h && h.trim().toLowerCase() === 'categorytype');
                      // Sync to Firebase
                      if (db && userId) {
                        const batch = writeBatch(db);
                        parsedCategories.forEach((cat, idx) => {
                          // Get CategoryType from the original row (not just the first 11 columns)
                          const typeRaw = categoryTypeIndex !== -1 ? rows[idx][categoryTypeIndex] : '';
                          const type = String(typeRaw).trim().toLowerCase() === 'materials' ? 'material' : 'service';
                          const docRef = doc(db, 'tenants', tenantId, 'categories', String(cat.id));
                          batch.set(docRef, {
                            id: cat.id,
                            name: cat.name,
                            parentId: cat.parentId,
                            level: cat.level,
                            path: cat.path,
                            userId,
                            type,
                            active: true,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                          });
                        });
                        await batch.commit();
                        await fetchCategories();
                        setImportStep(2); // Proceed to next step
                      } else {
                        alert('Database not initialized.');
                      }
                    }}
                  />
                  <p className="text-gray-600 dark:text-gray-300 mt-4">Only the Categories sheet will be imported at this step.</p>
                  <button
                    className="w-full px-4 py-2 mt-4 border rounded text-gray-600 dark:text-gray-300"
                    onClick={() => { setImportSource(null); setImportStep(1); }}
                  >
                    Back
                  </button>
                </div>
              )}

              {/* Step 2: Category Type Sync */}
              {(importSource === 'servicetitan' && importStep === 2) && (
                <div className="text-center p-8">
                  <h3 className="text-lg font-semibold mb-2">Sync Category Types</h3>
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    value={''}
                    onChange={async (e) => {
                      // Use the stored file if available
                      const file = serviceTitanImportFile;
                      if (!file) return;
                      const data = await file.arrayBuffer();
                      const workbook = XLSX.read(data, { type: 'array' });
                      const sheet = workbook.Sheets['Categories'] || workbook.Sheets['Category'];
                      if (!sheet) {
                        alert('No Categories sheet found!');
                        return;
                      }
                      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
                      const headers: string[] = (rawData[0] as unknown[]).map((cell: unknown) => String(cell || ''));
                      const rows: any[][] = rawData.slice(1) as any[][];
                      const idIndex = headers.findIndex(h => h && h.trim().toLowerCase() === 'id');
                      const typeIndex = headers.findIndex(h => h && h.trim().toLowerCase() === 'categorytype');
                      if (idIndex === -1 || typeIndex === -1) {
                        alert('Id or CategoryType column not found!');
                        return;
                      }
                      if (db && userId) {
                        const batch = writeBatch(db);
                        rows.forEach(row => {
                          const id = String(row[idIndex]).trim();
                          const typeRaw = row[typeIndex] || '';
                          const type = String(typeRaw).trim().toLowerCase() === 'materials' ? 'material' : 'service';
                          if (id) {
                            const docRef = doc(db, 'tenants', tenantId, 'categories', id);
                            batch.update(docRef, { type });
                          }
                        });
                        await batch.commit();
                        await fetchCategories();
                        setImportStep(3); // Go to pricebook data import step
                      } else {
                        alert('Database not initialized.');
                      }
                    }}
                  />
                  <p className="text-gray-600 dark:text-gray-300 mt-4">This will update the type (service/material) for each category based on the CategoryType column.</p>
                  <button
                    className="w-full px-4 py-2 mt-4 border rounded text-gray-600 dark:text-gray-300"
                    onClick={() => { setShowImportModal(false); setImportStep(1); }}
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Step 3: ServiceTitan Services Import */}
              {importSource === 'servicetitan' && importStep === 3 && (
                <PricebookImportExport
                  isOpen={true}
                  onClose={() => { setShowImportModal(false); setImportStep(1); setImportSource(null); setPendingServices([]); setPendingMaterials([]); }}
                  onNext={async (data: ImportedItem[]) => {
                    setPendingServices(data);
                    setImportStep(4); // Advance to material import step
                  }}
                  importSource="servicetitan"
                />
              )}

              {/* Step 4: ServiceTitan Materials Import */}
              {(() => {
                if (importSource === 'servicetitan' && importStep === 4) {
                  return (
                    <PricebookImportExport
                      key="materials-import"
                      isOpen={true}
                      onClose={() => { setShowImportModal(false); setImportStep(1); setImportSource(null); setPendingServices([]); setPendingMaterials([]); setPendingEquipment([]); }}
                      onNext={async (data: ImportedItem[]) => {
                        setPendingMaterials(data);
                        setImportStep(5); // Advance to equipment import step
                      }}
                      importSource="servicetitan"
                      initialStep="upload-materials"
                      isEquipmentImport={false}
                    />
                  );
                }
                return null;
              })()}

              {/* Step 5: ServiceTitan Equipment Import */}
              {(() => {
                if (importSource === 'servicetitan' && importStep === 5) {
                  return (
                    <PricebookImportExport
                      key="equipment-import"
                      isOpen={true}
                      onClose={() => { setShowImportModal(false); setImportStep(1); setImportSource(null); setPendingServices([]); setPendingMaterials([]); setPendingEquipment([]); }}
                      onNext={async (data: ImportedItem[]) => {
                        setPendingEquipment(data);
                        setImportStep(6); // Advance to final confirmation step
                      }}
                      importSource="servicetitan"
                      initialStep="upload-materials"
                      isEquipmentImport={true}
                    />
                  );
                }
                return null;
              })()}

              {/* Step 6: Final Confirmation */}
              {importSource === 'servicetitan' && importStep === 6 && (
                <div className="text-center p-8">
                  <h3 className="text-lg font-semibold mb-2">Ready to Import?</h3>
                  <p className="mb-4">You are about to import {pendingServices.length} services, {pendingMaterials.length} materials, and {pendingEquipment.length} equipment items. This action cannot be undone.</p>
                  <button
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors mb-2"
                    onClick={async () => {
                      if (!db || !userId) return;
                      try {
                        setIsLoading(true);
                        // Chunk services, materials, and equipment into batches of 500
                        const serviceChunks = chunkArray(pendingServices, 500);
                        const materialChunks = chunkArray(pendingMaterials, 500);
                        const equipmentChunks = chunkArray(pendingEquipment, 500);
                        // Helper to get or create a GL account
                        async function getOrCreateGLAccount(accountName: string, type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense' | 'Other'): Promise<string> {
                          if (!accountName) return '';
                          // Try to find by accountNumber first
                          let acc = glAccounts.find(a => a.accountNumber === accountName && a.type === type);
                          if (acc) return acc.accountNumber;
                          // Try to find by name
                          acc = glAccounts.find(a => a.accountName === accountName && a.type === type);
                          if (acc) return acc.accountNumber;
                          // Generate a new account number
                          const prefix = type === 'Revenue' ? '4-' : type === 'Expense' ? '5-' : '9-';
                          let maxNum = 0;
                          glAccounts.filter(a => a.type === type && a.accountNumber.startsWith(prefix)).forEach(a => {
                            const num = parseInt(a.accountNumber.replace(prefix, '').replace(/-.*/, ''));
                            if (!isNaN(num) && num > maxNum) maxNum = num;
                          });
                          const newNum = (maxNum + 1).toString().padStart(3, '0');
                          const newAccountNumber = `${prefix}${newNum}`;
                          // Create in Firestore
                          if (!db) throw new Error('Database not initialized');
                          const docRef = doc(collection(db, 'tenants', tenantId, 'glAccounts'));
                          await setDoc(docRef, {
                            accountNumber: newAccountNumber,
                            accountName,
                            type,
                            subtype: '',
                            description: '',
                            active: true,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                          });
                          // Add to local state for this import
                          glAccounts.push({
                            id: docRef.id,
                            accountNumber: newAccountNumber,
                            accountName,
                            type,
                            subtype: '',
                            description: '',
                            active: true,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                          });
                          return newAccountNumber;
                        }
                        // Services
                        for (const chunk of serviceChunks) {
                          const batch = writeBatch(db);
                          for (const item of chunk) {
                            const docId = item['id'] || doc(collection(db, 'tenants', tenantId, 'services')).id;
                            const docRef = doc(db, 'tenants', tenantId, 'services', docId);
                            // Revenue/Expense account logic
                            let generalLedgerAccount = item.generalLedgerAccount || '';
                            let expenseAccount = item.expenseAccount || '';
                            if (generalLedgerAccount) generalLedgerAccount = await getOrCreateGLAccount(generalLedgerAccount, 'Revenue');
                            if (expenseAccount) expenseAccount = await getOrCreateGLAccount(expenseAccount, 'Expense');
                            // Ensure categories are strings
                            const categories = Array.isArray(item.categories) ? item.categories.map(String) : [];
                            batch.set(docRef, { ...item, userId, categories, generalLedgerAccount, expenseAccount });
                          }
                          await batch.commit();
                        }
                        // Materials
                        for (const chunk of materialChunks) {
                          const batch = writeBatch(db);
                          for (const item of chunk) {
                            const docId = item['id'] || doc(collection(db, 'tenants', tenantId, 'materials')).id;
                            const docRef = doc(db, 'tenants', tenantId, 'materials', docId);
                            // Revenue/Expense account logic
                            let generalLedgerAccount = item.generalLedgerAccount || '';
                            let expenseAccount = item.expenseAccount || '';
                            if (generalLedgerAccount) generalLedgerAccount = await getOrCreateGLAccount(generalLedgerAccount, 'Revenue');
                            if (expenseAccount) expenseAccount = await getOrCreateGLAccount(expenseAccount, 'Expense');
                            const categories = Array.isArray(item.categories) ? item.categories.map(String) : [];
                            batch.set(docRef, { ...item, userId, categories, generalLedgerAccount, expenseAccount });
                          }
                          await batch.commit();
                        }
                        // Equipment
                        for (const chunk of equipmentChunks) {
                          const batch = writeBatch(db);
                          for (const item of chunk) {
                            const docId = item['id'] || doc(collection(db, 'tenants', tenantId, 'equipment')).id;
                            const docRef = doc(db, 'tenants', tenantId, 'equipment', docId);
                            // Revenue/Expense account logic
                            let generalLedgerAccount = item.generalLedgerAccount || '';
                            let expenseAccount = item.expenseAccount || '';
                            if (generalLedgerAccount) generalLedgerAccount = await getOrCreateGLAccount(generalLedgerAccount, 'Revenue');
                            if (expenseAccount) expenseAccount = await getOrCreateGLAccount(expenseAccount, 'Expense');
                            // Ensure categories are strings
                            const categories = Array.isArray(item.categories) ? item.categories.map(String) : [];
                            batch.set(docRef, { ...item, userId, categories, generalLedgerAccount, expenseAccount });
                          }
                          await batch.commit();
                        }
                        await fetchServices();
                        await fetchMaterials();
                        if (typeof fetchEquipment === 'function') await fetchEquipment();
                        setShowImportModal(false);
                        setImportStep(1);
                        setImportSource(null);
                        setPendingServices([]);
                        setPendingMaterials([]);
                        setPendingEquipment([]);
                      } catch (error) {
                        console.error('Error importing data:', error);
                        alert('Error importing data. Please check the console for details.');
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  >
                    Confirm & Import
                  </button>
                  <button
                    className="w-full px-4 py-2 mt-2 border rounded text-gray-600 dark:text-gray-300"
                    onClick={() => { setShowImportModal(false); setImportStep(1); setImportSource(null); setPendingServices([]); setPendingMaterials([]); setPendingEquipment([]); }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </Dialog>
      )}

      {showAddServiceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add Service</h2>
            <ServiceForm
              formData={serviceForm}
              onChange={handleServiceFormChange}
              categories={categories}
              materials={materials}
              equipment={[]}
              onSubmit={e => { e.preventDefault(); handleSaveService(); }}
              onCancel={() => setShowAddServiceModal(false)}
              isSubmitting={isLoading}
              isSaving={serviceSaving}
              error={serviceError}
              glAccounts={glAccounts.filter(acc => acc.active)}
              allServices={services.map(svc => ({ id: svc.id, name: svc.name }))}
            />
          </div>
        </div>
      )}

      {showEditServiceModal && editingService && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Service</h2>
            <ServiceForm
              formData={serviceForm}
              onChange={handleServiceFormChange}
              categories={categories}
              materials={materials}
              equipment={[]}
              onSubmit={e => { e.preventDefault(); handleUpdateService(); }}
              onCancel={() => setShowEditServiceModal(false)}
              isSubmitting={isLoading}
              isSaving={serviceSaving}
              error={serviceError}
              glAccounts={glAccounts.filter(acc => acc.active)}
              allServices={services.filter(svc => svc.id !== editingService.id).map(svc => ({ id: svc.id, name: svc.name }))}
            />
          </div>
        </div>
      )}

      {showAddMaterialModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add New Material</h2>
            <MaterialForm
              formData={materialForm}
              onChange={handleMaterialFormChange}
              categories={categories}
              onSubmit={e => { e.preventDefault(); handleAddMaterial(); }}
              onCancel={() => setShowAddMaterialModal(false)}
              isSubmitting={isLoading}
              isSaving={materialSaving}
              error={materialError}
              glAccounts={glAccounts.filter(acc => acc.active)}
            />
          </div>
        </div>
      )}

      {showEditMaterialModal && editingMaterial && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Material</h2>
            <MaterialForm
              formData={materialForm}
              onChange={handleMaterialFormChange}
              categories={categories}
              onSubmit={e => { e.preventDefault(); handleUpdateMaterial(); }}
              onCancel={() => setShowEditMaterialModal(false)}
              isSubmitting={isLoading}
              isSaving={materialSaving}
              error={materialError}
              glAccounts={glAccounts.filter(acc => acc.active)}
            />
          </div>
        </div>
      )}

      {/* Price Builder Tab Content */}
      {activeTab === 'priceBuilder' && (
        <div>
          {/* Price Rules Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Price Rules</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Configure dynamic pricing rules and assign them to categories</p>
            </div>
            <button
              onClick={() => setShowAddPriceRuleModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} className="mr-2 inline" />
              Create Price Rule
            </button>
          </div>

          {/* Debug log for priceRules */}
          {(() => { console.log('Price rules in state:', priceRules); return null; })()}

          {/* Price Rules List or Empty State */}
          {priceRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Calculator size={48} className="text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">No Price Rules Yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first price rule to enable dynamic pricing for services.</p>
              <button
                onClick={() => setShowAddPriceRuleModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create First Price Rule
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {priceRules.map(rule => (
                <div key={rule.id} className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">{rule.name}</h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">{rule.description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        rule.active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {rule.active ? 'Active' : 'Inactive'}
                      </span>
                      <button 
                        onClick={() => {
                          setEditingPriceRule(rule ? { ...rule } : null);
                          setShowEditPriceRuleModal(true);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeletePriceRule(rule)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Base Rate</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">${rule.baseRate}/hr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Material Markup</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">{rule.materialMarkup}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <PriceRuleModal
        isOpen={showEditPriceRuleModal}
        onClose={() => setShowEditPriceRuleModal(false)}
        onSave={handleUpdatePriceRule}
        priceRule={editingPriceRule || undefined}
        categories={categories}
        services={services}
      />

      {/* Add modal for creating a new price rule */}
      <PriceRuleModal
        isOpen={showAddPriceRuleModal}
        onClose={() => setShowAddPriceRuleModal(false)}
        onSave={handleAddPriceRule}
        categories={categories}
        services={services}
      />

      {/* Categories Tab Content */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setShowAddCategoryModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
              >
                <Plus size={16} />
                <span>Add Category</span>
              </button>
              <select
                value={categoryType}
                onChange={(e) => setCategoryType(e.target.value)}
                className="rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2"
              >
                <option value="service">Service Categories</option>
                <option value="material">Material Categories</option>
                <option value="equipment">Equipment Categories</option>
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={selectAllCategories} onChange={e => handleSelectAllCategories(e.target.checked)} />
              <span className="text-gray-700 dark:text-gray-200">Select All</span>
              <Menu as="div" className="relative inline-block text-left mr-2">
                <Menu.Button
                  className={`px-4 py-2 rounded bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 font-medium border border-gray-300 dark:border-slate-600 focus:outline-none ${selectedCategoryIds.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300 dark:hover:bg-slate-600'}`}
                  disabled={selectedCategoryIds.length === 0}
                >
                  Actions
                </Menu.Button>
                <Menu.Items className="absolute left-0 mt-2 w-48 origin-top-left bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg z-10 focus:outline-none">
                  <Menu.Item disabled={selectedCategoryIds.length === 0}>
                    {({ active, disabled }) => (
                      <button
                        className={`w-full text-left px-4 py-2 ${disabled ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-slate-700'} text-sm`}
                        disabled={disabled}
                        onClick={() => {
                          const cat = categories.find(c => c.id === selectedCategoryIds[0]);
                          if (cat) {
                            setEditingCategory(cat);
                            setShowEditCategoryModal(true);
                          }
                        }}
                      >
                        <Edit size={16} className="inline mr-2" /> Edit
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active, disabled }) => (
                      <button
                        className={`w-full text-left px-4 py-2 text-red-600 dark:text-red-400 ${active ? 'bg-red-50 dark:bg-red-900' : ''} text-sm`}
                        disabled={disabled}
                        onClick={() => setShowBulkDeleteCategoriesDialog(true)}
                      >
                        <Trash2 size={16} className="inline mr-2" /> Delete
                      </button>
                    )}
                  </Menu.Item>
                </Menu.Items>
              </Menu>
            </div>
            {categories
              .filter(cat => cat.type === categoryType && !cat.parentId)
              .map(cat => (
                <div key={cat.id}>
                  <CategoryTree
                    cat={cat}
                    categories={categories}
                    onAddSub={(parentId) => {
                      setEditingCategory(null);
                      setShowAddCategoryModal(true);
                      setCategoryFormState(prev => ({
                        ...prev,
                        parentId,
                        type: categoryType as 'service' | 'material' | 'equipment',
                      }));
                    }}
                    onEdit={(cat) => {
                      setEditingCategory(cat);
                      setShowEditCategoryModal(true);
                    }}
                    onDelete={handleDeleteCategory}
                  />
                  {/* Linked services/materials */}
                  <div className="ml-8 mt-2 text-xs text-gray-600 dark:text-gray-300">
                    {services.filter(svc => (svc.categories || []).includes(cat.id)).length > 0 && (
                      <div><b>Services:</b> {services.filter(svc => (svc.categories || []).includes(cat.id)).map(svc => svc.name).join(', ')}</div>
                    )}
                    {materials.filter(mat => (mat.categories || []).includes(cat.id)).length > 0 && (
                      <div><b>Materials:</b> {materials.filter(mat => (mat.categories || []).includes(cat.id)).map(mat => mat.name).join(', ')}</div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Category Modals */}
      <CategoryModal
        isOpen={showAddCategoryModal}
        onClose={() => setShowAddCategoryModal(false)}
        onSave={handleAddCategory}
        categories={categories}
        priceRules={priceRules.map(rule => ({ id: rule.id, name: rule.name }))}
      />

      <CategoryModal
        isOpen={showEditCategoryModal}
        onClose={() => setShowEditCategoryModal(false)}
        onSave={handleUpdateCategory}
        category={editingCategory}
        categories={categories}
        priceRules={priceRules.map(rule => ({ id: rule.id, name: rule.name }))}
      />

      {/* Materials Tab Content */}
      {activeTab === 'materials' && (
        <div>
          {/* Search and Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="Search materials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
            </div>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
            >
              <option value="all">All Categories</option>
              {categories.filter(cat => cat.type === 'material').map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <button
              onClick={() => { setMaterialForm(initialMaterialFormState); setShowAddMaterialModal(true); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} className="mr-2 inline" />
              Add Material
            </button>
          </div>
          {/* Multi-select Actions button */}
          {selectedMaterialIds.length > 0 && (
            <div className="flex mb-2">
              <Menu as="div" className="relative inline-block text-left">
                <Menu.Button className="px-4 py-2 rounded bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 font-medium border border-gray-300 dark:border-slate-600 focus:outline-none">
                  Actions
                </Menu.Button>
                <Menu.Items className="absolute left-0 mt-2 w-48 origin-top-left bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg z-10 focus:outline-none">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={`w-full text-left px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                        onClick={async () => {
                          // Multi-deactivate
                          if (!db) return;
                          await Promise.all(selectedMaterialIds.map(id => updateDoc(doc(db, 'tenants', tenantId, 'materials', id), { active: false, updatedAt: serverTimestamp() })));
                          setSelectedMaterialIds([]);
                          setSelectAllMaterials(false);
                          await fetchMaterials();
                        }}
                      >
                        <Power size={16} className="inline mr-2" /> Deactivate
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={`w-full text-left px-4 py-2 text-sm ${active ? 'bg-gray-100 dark:bg-slate-700' : ''}`}
                        onClick={async () => {
                          // Multi-duplicate
                          if (!db || !userId) return;
                          for (const id of selectedMaterialIds) {
                            const orig = materials.find(m => m.id === id);
                            if (!orig) continue;
                            let baseCode = orig.code.replace(/ \(\d+\)$/, '');
                            let count = 1;
                            let newCode = `${baseCode} (${count})`;
                            while (materials.some(m => m.code === newCode)) {
                              count++;
                              newCode = `${baseCode} (${count})`;
                            }
                            await addDoc(collection(db, 'tenants', tenantId, 'materials'), {
                              ...orig,
                              code: newCode,
                              active: true,
                              createdAt: serverTimestamp(),
                              updatedAt: serverTimestamp(),
                              userId,
                            });
                          }
                          await fetchMaterials();
                          setSelectedMaterialIds([]);
                          setSelectAllMaterials(false);
                        }}
                      >
                        <CopyPlus size={16} className="inline mr-2" /> Duplicate
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={`w-full text-left px-4 py-2 text-red-600 dark:text-red-400 ${active ? 'bg-red-50 dark:bg-red-900' : ''} text-sm`}
                        onClick={() => setShowMultiDeleteMaterialsWarning(true)}
                      >
                        <Trash2 size={16} className="inline mr-2" /> Delete
                      </button>
                    )}
                  </Menu.Item>
                </Menu.Items>
              </Menu>
            </div>
          )}
          {/* Materials Table */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <input type="checkbox" checked={selectAllMaterials} onChange={e => handleSelectAllMaterials(e.target.checked)} />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {paginatedMaterials.map(material => (
                      <tr key={material.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <input
                            type="checkbox"
                            checked={selectedMaterialIds.includes(material.id)}
                            onChange={e => handleSelectMaterial(material.id, e.target.checked)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">{material.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{material.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{stripHtml(material.description)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${material.price?.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">{material.unit}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${material.active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>{material.active ? 'Active' : 'Inactive'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button 
                            onClick={() => { 
                              setEditingMaterial(material); 
                              setShowEditMaterialModal(true); 
                              setMaterialForm({ ...initialMaterialFormState, ...material }); 
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                          >
                            <Edit size={16} />
                          </button>
                          <button className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300" onClick={() => handleDeleteMaterial(material.id)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="flex justify-center items-center gap-4 mt-2">
            <button disabled={currentMaterialPage === 1} onClick={() => setCurrentMaterialPage(currentMaterialPage - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
            <span>Page {currentMaterialPage} of {Math.max(1, Math.ceil(filteredMaterials.length / ITEMS_PER_PAGE))}</span>
            <button disabled={currentMaterialPage === Math.ceil(filteredMaterials.length / ITEMS_PER_PAGE) || filteredMaterials.length === 0} onClick={() => setCurrentMaterialPage(currentMaterialPage + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {activeTab === 'equipment' && (
        <div>
          {/* Search and Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
              <input
                type="text"
                placeholder="Search equipment..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
            >
              <option value="all">All Categories</option>
              {categories.filter(cat => cat.type === 'equipment').map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <button
              onClick={() => { setEquipmentForm(initialEquipmentFormState); setShowAddEquipmentModal(true); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} className="mr-2 inline" />
              Add Equipment
            </button>
          </div>
          {/* Equipment Table */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <input type="checkbox" checked={selectAllEquipment} onChange={e => handleSelectAllEquipment(e.target.checked)} />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {equipment.map(eq => (
                      <tr key={eq.code} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <input
                            type="checkbox"
                            checked={selectedEquipmentIds.includes(eq.code)}
                            onChange={e => handleSelectEquipment(eq.code, e.target.checked)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">{eq.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">{eq.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{stripHtml(eq.description)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${eq.price?.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">{eq.unitOfMeasure}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${eq.active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>{eq.active ? 'Active' : 'Inactive'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => { setEditingEquipment(eq); setShowEditEquipmentModal(true); setEquipmentForm(eq); }}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                          >
                            <Edit size={16} />
                          </button>
                          <button className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300" onClick={() => handleDeleteEquipment(eq.code)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          {/* Add/Edit Equipment Modals */}
          {showAddEquipmentModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Add New Equipment</h2>
                <EquipmentForm
                  formData={equipmentForm}
                  onChange={(field, value) => setEquipmentForm(prev => ({ ...prev, [field]: value }))}
                  categories={equipmentCategories}
                  onSubmit={e => { e.preventDefault(); handleAddEquipment(); }}
                  materials={[]}
                  onCancel={() => setShowAddEquipmentModal(false)}
                  isSubmitting={false}
                  isSaving={equipmentSaving}
                  error={equipmentError}
                  glAccounts={glAccounts}
                  isEdit={false}
                />
              </div>
            </div>
          )}
          {showEditEquipmentModal && editingEquipment && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Edit Equipment</h2>
                <EquipmentForm
                  formData={equipmentForm}
                  onChange={(field, value) => setEquipmentForm(prev => ({ ...prev, [field]: value }))}
                  categories={equipmentCategories}
                  onSubmit={e => { e.preventDefault(); handleUpdateEquipment(); }}
                  materials={[]}
                  onCancel={() => setShowEditEquipmentModal(false)}
                  isSubmitting={false}
                  isSaving={equipmentSaving}
                  error={equipmentError}
                  glAccounts={glAccounts}
                  isEdit={true}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {showBulkDeleteDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
          <div className="bg-white p-6 rounded shadow-lg">
            <h2 className="text-lg font-bold mb-2">Confirm Bulk Delete</h2>
            <p>Are you sure you want to delete {selectedServiceIds.length} selected services? This action cannot be undone.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={handleBulkDeleteServices} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
              <button onClick={() => setShowBulkDeleteDialog(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showBulkDeleteMaterialsDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
          <div className="bg-white p-6 rounded shadow-lg">
            <h2 className="text-lg font-bold mb-2">Confirm Bulk Delete</h2>
            <p>Are you sure you want to delete {selectedMaterialIds.length} selected materials? This action cannot be undone.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={handleBulkDeleteMaterials} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
              <button onClick={() => setShowBulkDeleteMaterialsDialog(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showBulkDeleteCategoriesDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
          <div className="bg-white p-6 rounded shadow-lg">
            <h2 className="text-lg font-bold mb-2">Confirm Bulk Delete</h2>
            <p>Are you sure you want to delete {selectedCategoryIds.length} selected categories? This action cannot be undone.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={handleBulkDeleteCategories} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
              <button onClick={() => setShowBulkDeleteCategoriesDialog(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showBulkDeleteEquipmentDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
          <div className="bg-white p-6 rounded shadow-lg">
            <h2 className="text-lg font-bold mb-2">Confirm Bulk Delete</h2>
            <p>Are you sure you want to delete {selectedEquipmentIds.length} selected equipment items? This action cannot be undone.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={handleBulkDeleteEquipment} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
              <button onClick={() => setShowBulkDeleteEquipmentDialog(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showDeleteWarning && serviceToDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
          <div className="bg-white dark:bg-slate-800 p-6 rounded shadow-lg max-w-md w-full">
            <h2 className="text-lg font-bold mb-2 text-red-600 dark:text-red-400">Warning</h2>
            <p className="mb-4 text-gray-700 dark:text-gray-200">It is recommended to deactivate services over deleting them as if this service is attached to a job it will be removed and can cause reporting issues.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={async () => { await handleDeleteService(serviceToDelete.id); setShowDeleteWarning(false); setServiceToDelete(null); }} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
              <button onClick={() => { setShowDeleteWarning(false); setServiceToDelete(null); }} className="px-4 py-2 bg-gray-200 dark:bg-slate-700 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showMultiDeleteWarning && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
          <div className="bg-white dark:bg-slate-800 p-6 rounded shadow-lg max-w-md w-full">
            <h2 className="text-lg font-bold mb-2 text-red-600 dark:text-red-400">Warning</h2>
            <p className="mb-4 text-gray-700 dark:text-gray-200">It is recommended to deactivate services over deleting them as if any service is attached to a job it will be removed and can cause reporting issues.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={async () => { await Promise.all(selectedServiceIds.map(id => handleDeleteService(id))); setShowMultiDeleteWarning(false); setSelectedServiceIds([]); setSelectAllServices(false); }} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
              <button onClick={() => setShowMultiDeleteWarning(false)} className="px-4 py-2 bg-gray-200 dark:bg-slate-700 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImportMaterialLinks && (
        <PricebookImportExport
          isOpen={showImportMaterialLinks}
          onClose={() => setShowImportMaterialLinks(false)}
          linkImportType="service-material"
          onImportComplete={async (data) => {
            if (!db) return;
            setIsLoading(true);
            let success = 0, fail = 0;
            const errors: string[] = [];
            
            console.log('\n=== SERVICE-MATERIAL LINK IMPORT START ===');
            console.log('Total rows to process:', data.length);
            console.log('Raw import data:', JSON.stringify(data, null, 2));
            console.log('Current tenantId:', tenantId);
            console.log('Database instance:', db ? 'Available' : 'Not available');
            console.log('Available services count:', services.length);
            console.log('Available materials count:', materials.length);
            console.log('Sample services:', services.slice(0, 3).map(s => ({ id: s.id, code: s.code, name: s.name })));
            console.log('Sample materials:', materials.slice(0, 3).map(m => ({ id: m.id, code: m.code, name: m.name })));
            
            for (let i = 0; i < data.length; i++) {
              const row = data[i];
              console.log(`\n--- Processing Service-Material Link Row ${i + 1}/${data.length} ---`);
              console.log('Row data:', JSON.stringify(row, null, 2));
              
              try {
                // Validate serviceId
                if (!row.serviceId) {
                  const error = `❌ FAIL: Missing serviceId in row: ${JSON.stringify(row)}`;
                  console.error(error);
                  errors.push(error);
                  fail++;
                  continue;
                }
                
                // Validate materialId
                if (!row.materialId) {
                  const error = `❌ FAIL: Missing materialId in row: ${JSON.stringify(row)}`;
                  console.error(error);
                  errors.push(error);
                  fail++;
                  continue;
                }
                
                console.log(`🔍 Looking for service with ID: "${row.serviceId}" (type: ${typeof row.serviceId})`);
                
                // Check if service exists in memory first
                const serviceInMemory = services.find(s => s.id === String(row.serviceId));
                console.log('Service found in memory:', serviceInMemory ? { id: serviceInMemory.id, code: serviceInMemory.code, name: serviceInMemory.name } : 'Not found');
                
                // Check if material exists in memory (materials will be defined after fetching service data)
                // const materialInMemory = materials.find(m => m.id === String(row.materialId));
                // console.log('Material found in memory:', materialInMemory ? { id: materialInMemory.id, code: materialInMemory.code, name: materialInMemory.name } : 'Not found');
                
                const serviceDocPath = `tenants/${tenantId}/services/${String(row.serviceId)}`;
                console.log('Service document path:', serviceDocPath);
                
                const ref = doc(db, 'tenants', tenantId, 'services', String(row.serviceId));
                console.log('Service document reference created');
                
                const snap = await getDoc(ref);
                console.log('Service document fetch result - exists:', snap.exists());
                
                if (!snap.exists()) { 
                  const error = `❌ FAIL: Service not found with ID: "${row.serviceId}"`;
                  console.error(error);
                  console.error('Available service IDs:', services.map(s => s.id));
                  errors.push(error);
                  fail++; 
                  continue; 
                }
                
                const svc = snap.data();
                console.log('✅ Found service:', {
                  id: svc.id,
                  code: svc.code,
                  name: svc.name,
                  currentMaterials: svc.materials?.length || 0,
                  currentLinkedMaterials: svc.linkedMaterials?.length || 0
                });
                
                const materials = Array.isArray(svc.materials) ? [...svc.materials] : [];
                const linkedMaterials = Array.isArray(svc.linkedMaterials) ? [...svc.linkedMaterials] : [];
                
                console.log('Current service materials array:', materials);
                console.log('Current service linkedMaterials array:', linkedMaterials);
                
                // Create the material link object
                const materialLink = {
                  materialId: row.materialId,
                  materialCode: row.materialCode,
                  quantity: row.quantity,
                  active: row.active,
                };
                console.log('Material link to add:', materialLink);
                
                // Update materials array using upsertLink
                console.log('Before upsertLink - materials array:', materials);
                upsertLink(materials, 'materialId', row.materialId, materialLink);
                console.log('After upsertLink - materials array:', materials);
                
                // Update linkedMaterials array
                const wasAlreadyLinked = linkedMaterials.includes(row.materialId);
                if (!wasAlreadyLinked) {
                  linkedMaterials.push(row.materialId);
                  console.log('✅ Added materialId to linkedMaterials array');
                } else {
                  console.log('ℹ️ MaterialId already in linkedMaterials array');
                }
                console.log('Final linkedMaterials array:', linkedMaterials);
                
                // Update the service document
                console.log('🔄 Updating service document...');
                const updateData = { materials, linkedMaterials, updatedAt: serverTimestamp() };
                console.log('Update data:', { materials, linkedMaterials, updatedAt: 'serverTimestamp()' });
                
                await updateDoc(ref, updateData);
                console.log(`✅ SUCCESS: Updated service "${row.serviceId}" with material "${row.materialId}"`);
                success++;
                
              } catch (e) { 
                const error = `❌ ERROR processing row ${i + 1}: ${e}`;
                console.error('Error linking material to service:', e);
                console.error('Row that caused error:', row);
                console.error('Error stack:', e instanceof Error ? e.stack : String(e));
                errors.push(`Error processing row ${JSON.stringify(row)}: ${e}`);
                fail++; 
              }
            }
            
            console.log('\n=== SERVICE-MATERIAL LINK IMPORT COMPLETE ===');
            console.log(`Total processed: ${data.length}`);
            console.log(`Successful: ${success}`);
            console.log(`Failed: ${fail}`);
            console.log('All errors:', errors);
            console.log('==============================================\n');
            
            setIsLoading(false);
            
            if (errors.length > 0) {
              console.error('Service-Material Link Import Errors:', errors);
            }
            
            alert(`Linked materials to services: ${success} succeeded, ${fail} failed.${errors.length > 0 ? '\nCheck console for details.' : ''}`);
            setShowImportMaterialLinks(false);
            await fetchServices();
          }}
        />
      )}
      {showImportEquipmentLinks && (
        <PricebookImportExport
          isOpen={showImportEquipmentLinks}
          onClose={() => setShowImportEquipmentLinks(false)}
          linkImportType="service-equipment"
          onImportComplete={async (data) => {
            if (!db) return;
            setIsLoading(true);
            let success = 0, fail = 0;
            const errors: string[] = [];
            
            console.log('Service-Equipment Link Import Data:', data);
            
            for (const row of data) {
              try {
                console.log('Processing service-equipment link:', row);
                
                if (!row.serviceId) {
                  errors.push(`Missing serviceId in row: ${JSON.stringify(row)}`);
                  fail++;
                  continue;
                }
                
                if (!row.equipmentId) {
                  errors.push(`Missing equipmentId in row: ${JSON.stringify(row)}`);
                  fail++;
                  continue;
                }
                
                const ref = doc(db, 'tenants', tenantId, 'services', String(row.serviceId));
                const snap = await getDoc(ref);
                
                if (!snap.exists()) { 
                  errors.push(`Service not found: ${row.serviceId}`);
                  fail++; 
                  continue; 
                }
                
                const svc = snap.data();
                const equipment = Array.isArray(svc.equipment) ? [...svc.equipment] : [];
                const linkedEquipment = Array.isArray(svc.linkedEquipment) ? [...svc.linkedEquipment] : [];
                
                upsertLink(equipment, 'equipmentId', row.equipmentId, {
                  equipmentId: row.equipmentId,
                  equipmentCode: row.equipmentCode,
                  quantity: row.quantity,
                  active: row.active,
                });
                
                if (!linkedEquipment.includes(row.equipmentId)) linkedEquipment.push(row.equipmentId);
                
                await updateDoc(ref, { equipment, linkedEquipment, updatedAt: serverTimestamp() });
                success++;
              } catch (e) { 
                console.error('Error linking equipment to service:', e, row);
                errors.push(`Error processing row ${JSON.stringify(row)}: ${e}`);
                fail++; 
              }
            }
            setIsLoading(false);
            
            if (errors.length > 0) {
              console.error('Service-Equipment Link Import Errors:', errors);
            }
            
            alert(`Linked equipment to services: ${success} succeeded, ${fail} failed.${errors.length > 0 ? '\nCheck console for details.' : ''}`);
            setShowImportEquipmentLinks(false);
            await fetchServices();
          }}
        />
      )}
      {showImportEquipmentMaterialLinks && (
        <PricebookImportExport
          isOpen={showImportEquipmentMaterialLinks}
          onClose={() => setShowImportEquipmentMaterialLinks(false)}
          linkImportType="equipment-material"
          onImportComplete={async (data) => {
            if (!db) return;
            setIsLoading(true);
            let success = 0, fail = 0;
            const errors: string[] = [];
            
            console.log('Equipment-Material Link Import Data:', data);
            
            for (const row of data) {
              try {
                console.log('Processing equipment-material link:', row);
                
                if (!row.equipmentId) {
                  errors.push(`Missing equipmentId in row: ${JSON.stringify(row)}`);
                  fail++;
                  continue;
                }
                
                if (!row.materialId) {
                  errors.push(`Missing materialId in row: ${JSON.stringify(row)}`);
                  fail++;
                  continue;
                }
                
                const ref = doc(db, 'tenants', tenantId, 'equipment', String(row.equipmentId));
                const snap = await getDoc(ref);
                
                if (!snap.exists()) { 
                  errors.push(`Equipment not found: ${row.equipmentId}`);
                  fail++; 
                  continue; 
                }
                
                const eq = snap.data();
                const materials = Array.isArray(eq.materials) ? [...eq.materials] : [];
                const linkedMaterials = Array.isArray(eq.linkedMaterials) ? [...eq.linkedMaterials] : [];
                
                upsertLink(materials, 'materialId', row.materialId, {
                  materialId: row.materialId,
                  materialCode: row.materialCode,
                  quantity: row.quantity,
                  active: row.active,
                });
                
                if (!linkedMaterials.includes(row.materialId)) linkedMaterials.push(row.materialId);
                
                await updateDoc(ref, { materials, linkedMaterials, updatedAt: serverTimestamp() });
                success++;
              } catch (e) { 
                console.error('Error linking material to equipment:', e, row);
                errors.push(`Error processing row ${JSON.stringify(row)}: ${e}`);
                fail++; 
              }
            }
            setIsLoading(false);
            
            if (errors.length > 0) {
              console.error('Equipment-Material Link Import Errors:', errors);
            }
            
            alert(`Linked materials to equipment: ${success} succeeded, ${fail} failed.${errors.length > 0 ? '\nCheck console for details.' : ''}`);
            setShowImportEquipmentMaterialLinks(false);
            await fetchEquipment();
          }}
        />
      )}

      {showCustomerImport && (
        <CustomerImportModal
          isOpen={showCustomerImport}
          onClose={() => setShowCustomerImport(false)}
          onComplete={() => {/* Optionally refresh customers here */}}
          userId={userId}
          tenantId={tenantId || undefined}
        />
      )}

    </div>
  );
};

export default Pricebook;
