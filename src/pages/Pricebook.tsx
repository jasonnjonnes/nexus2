import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Plus, Search, Edit, Trash2, X, Upload, Download, 
  FileText, Package, Folder, Calculator, Camera, MoreHorizontal, ChevronDown, ChevronRight,
  RefreshCw, Filter, Save, Play, DollarSign, Settings, Image, Video, Tag, Copy, BarChart3
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, Firestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, 
  query, where, writeBatch, serverTimestamp, getDocs, setDoc
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
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

  const [db, setDb] = useState<Firestore | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
  const ITEMS_PER_PAGE = 50;

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
    serviceTitanId: '',
    staticMemberPrice: 0,
    generalLedgerAccount: '',
    expenseAccount: '',
    taxable: false,
    allowDiscounts: true,
    laborService: false,
    conversionTags: [],
    warrantyDescription: '',
    useStaticPrice: false,
    staticAddOnPrice: 0,
    staticMemberAddOnPrice: 0,
    estimatedLaborCost: 0,
    allowMembershipDiscounts: true,
    excludeFromPricebookWizard: false,
    crossSaleGroup: '',
    serviceTitanCategoryId: '',
    serviceTitanSubCategoryId: '',
    serviceTitanEquipmentId: '',
    serviceTitanWarrantyId: '',
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
    serviceTitanId: '',
    serviceTitanCategoryId: '',
    serviceTitanSubCategoryId: '',
    serviceTitanEquipmentId: '',
    serviceTitanWarrantyId: '',
    allowMembershipDiscounts: true,
    crossSaleGroup: '',
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

  useEffect(() => {
    try {
      if (typeof __firebase_config !== 'undefined' && __firebase_config) {
        const app = initializeApp(__firebase_config);
        const auth = getAuth(app);
        setDb(getFirestore(app));
        
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            const userCredential = await signInAnonymously(auth);
            setUserId(userCredential.user.uid);
          }
        });
      } else {
        setError("Firebase config not found.");
      }
    } catch(e) {
      console.error(e);
      setError("Firebase initialization failed.");
    }
  }, []);

  const fetchCategories = useCallback(() => {
    if (!db || !userId) {
      console.error('Cannot fetch categories: db or userId is missing', { db: !!db, userId: !!userId });
      return () => {};
    }
    try {
      console.log('Setting up categories listener...');
      const categoriesRef = collection(db, 'categories');
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
  }, [db, userId]);

  const fetchServices = useCallback(() => {
    if (!db || !userId) {
      console.error('Cannot fetch services: db or userId is missing', { db: !!db, userId: !!userId });
      return () => {};
    }
    try {
      console.log('Setting up services listener...');
      const servicesRef = collection(db, 'services');
      const q = query(servicesRef, where('userId', '==', userId));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log('Services snapshot update:', {
          empty: snapshot.empty,
          size: snapshot.size,
          docs: snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
        });
        
        const servicesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Service[];
        
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
  }, [db, userId]);

  const fetchMaterials = useCallback(() => {
    if (!db || !userId) {
      console.error('Cannot fetch materials: db or userId is missing', { db: !!db, userId: !!userId });
      return () => {};
    }
    try {
      console.log('Setting up materials listener...');
      const materialsRef = collection(db, 'materials');
      const q = query(materialsRef, where('userId', '==', userId));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log('Materials snapshot update:', {
          empty: snapshot.empty,
          size: snapshot.size,
          docs: snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
        });
        
        const materialsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Material[];
        
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
  }, [db, userId]);

  const fetchPriceRules = async () => {
    if (!db || !userId) return;
    try {
      const q = query(collection(db, 'priceRules'), where('userId', '==', userId));
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

  useEffect(() => {
    if (db && userId) {
      setIsLoading(true);
      try {
        console.log('Setting up data listeners...');
        const unsubscribes = [
          fetchCategories(),
          fetchServices(),
          fetchMaterials()
        ];
        fetchPriceRules(); // fetch once, not a listener
        console.log('All data listeners set up');
        setIsLoading(false);
        // Cleanup function to unsubscribe from all listeners
        return () => {
          console.log('Cleaning up data listeners...');
          unsubscribes
            .filter(fn => typeof fn === 'function')
            .forEach(unsubscribe => unsubscribe());
        };
      } catch (error) {
        console.error('Error setting up data listeners:', error);
        setError('Failed to load initial data');
        setIsLoading(false);
      }
    } else {
      console.error('Cannot set up data listeners: db or userId is missing', { db: !!db, userId: !!userId });
    }
  }, [db, userId, fetchCategories, fetchServices, fetchMaterials]);

  const handleAddService = () => {
    setServiceForm(initialServiceForm);
    setShowAddServiceModal(true);
  };

  const handleEditService = (service: Service) => {
    setServiceForm({
      ...initialServiceForm,
      ...service,
      serviceTitanId: service.serviceTitanId || '',
    });
    setEditingService(service);
    setShowEditServiceModal(true);
  };

  const handleUpdateService = async () => {
    if (!db || !editingService) return;
    try {
      const serviceRef = doc(db, 'services', editingService.id);
      await updateDoc(serviceRef, {
        ...serviceForm,
        updatedAt: serverTimestamp(),
      });
      setShowEditServiceModal(false);
      setEditingService(null);
      setServiceForm(initialServiceForm);
      await fetchServices(); // Refresh list
    } catch (error) {
      console.error('Error updating service:', error);
    }
  };

  const handleAddMaterial = async () => {
    if (!db || !userId) return;
    try {
      await addDoc(collection(db, 'materials'), {
        ...materialForm,
        code: generateMaterialCode(),
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowAddMaterialModal(false);
      setMaterialForm(initialMaterialFormState);
      await fetchMaterials(); // Refresh list
    } catch (error) {
      console.error('Error adding material: ', error);
    }
  };

  const handleUpdateMaterial = async () => {
    if (!db || !editingMaterial) return;
    try {
      const materialRef = doc(db, 'materials', editingMaterial.id);
      await updateDoc(materialRef, {
        ...materialForm,
        updatedAt: serverTimestamp(),
      });
      setShowEditMaterialModal(false);
      setEditingMaterial(null);
      await fetchMaterials(); // Refresh list
    } catch (error) {
      console.error('Error updating material: ', error);
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
          const docId = item['Category ID'] || doc(collection(db, 'categories')).id;
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
          const docId = item['serviceTitanId'] || doc(collection(db, 'services')).id;
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
          const docId = item['serviceTitanId'] || doc(collection(db, 'materials')).id;
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
          const docRef = doc(db, collection, docId);
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
      await restorePricebookData(db, userId);
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
          const docRef = doc(db, 'services', String(id));
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
          const docRef = doc(db, 'materials', String(id));
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
      const categoryRef = await addDoc(collection(db, 'categories'), {
        ...formData,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update any services/materials that should be in this category
      if (formData.type === 'service') {
        const servicesRef = collection(db, 'services');
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
        const materialsRef = collection(db, 'materials');
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
      const categoryRef = doc(db, 'categories', editingCategory.id);
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
      const servicesRef = collection(db, 'services');
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
      const materialsRef = collection(db, 'materials');
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
      batch.delete(doc(db, 'categories', category.id));
      
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
      await addDoc(collection(db, 'priceRules'), {
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
      const categoriesRef = collection(db, 'categories');
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
      await deleteDoc(doc(db, 'services', String(serviceId)));
      await fetchServices(); // Refresh list
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!db || !userId) return;
    if (!window.confirm('Are you sure you want to delete this material?')) return;
    try {
      await deleteDoc(doc(db, 'materials', String(materialId)));
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
    if (!db || !userId) return;
    try {
      await addDoc(collection(db, 'services'), {
        ...serviceForm,
        code: generateServiceCode(),
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowAddServiceModal(false);
      setServiceForm(initialServiceForm);
      await fetchServices(); // Refresh list
    } catch (error) {
      console.error('Error adding service:', error);
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
          const docRef = doc(db, 'categories', String(id));
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
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-800 dark:text-gray-200"
            onClick={() => setShowImportModal(true)}
          >
            <Upload size={16} className="mr-2 inline" />
            Import
          </button>
          <button className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-800 dark:text-gray-200">
            <Download size={16} className="mr-2 inline" />
            Export
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
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={selectAllServices} onChange={e => handleSelectAllServices(e.target.checked)} />
                  <span>Select All</span>
                  <button disabled={selectedServiceIds.length === 0} onClick={() => setShowBulkDeleteDialog(true)} className="px-2 py-1 bg-red-500 text-white rounded disabled:opacity-50">Bulk Delete</button>
                  <button disabled={selectedServiceIds.length === 0} onClick={() => setSelectedServiceIds([])} className="px-2 py-1 bg-gray-200 rounded disabled:opacity-50">Deselect All</button>
                </div>
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
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button 
                              onClick={() => handleEditService(service)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                            >
                              <Edit size={16} />
                            </button>
                            <button className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300" onClick={() => handleDeleteService(service.id)}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <Dialog open={showImportModal} onClose={() => { setShowImportModal(false); setImportStep(1); }}>
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
              <Dialog.Title className="text-lg font-bold mb-4">Import Pricebook Data</Dialog.Title>
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
              {(importSource === 'servicetitan' && importStep === 1) && (
                <div className="text-center p-8">
                  <h3 className="text-lg font-semibold mb-2">Import Categories from ServiceTitan</h3>
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
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
                          const docRef = doc(db, 'categories', String(cat.id));
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
                        alert('Categories imported and synced to Firebase!');
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
              {(importSource === 'servicetitan' && importStep === 2) && (
                <div className="text-center p-8">
                  <h3 className="text-lg font-semibold mb-2">Sync Category Types</h3>
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
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
                            const docRef = doc(db, 'categories', id);
                            batch.update(docRef, { type });
                          }
                        });
                        await batch.commit();
                        alert('Category types synced to Firebase!');
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
              {(importSource === 'housecall') && (
                <div className="text-center p-8">
                  <h3 className="text-lg font-semibold mb-2">Import from Housecall Pro</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">This feature is coming soon.</p>
                  <button
                    className="px-4 py-2 border rounded text-gray-600 dark:text-gray-300"
                    onClick={() => setImportSource(null)}
                  >
                    Back
                  </button>
                </div>
              )}
              {(importSource === 'csv') && (
                <div className="text-center p-8">
                  <h3 className="text-lg font-semibold mb-2">Import from CSV/XLSX</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">This feature is coming soon.</p>
                  <button
                    className="px-4 py-2 border rounded text-gray-600 dark:text-gray-300"
                    onClick={() => setImportSource(null)}
                  >
                    Back
                  </button>
                </div>
              )}
              {importSource === 'servicetitan' && importStep === 3 && (
                <PricebookImportExport
                  isOpen={true}
                  onClose={() => { setShowImportModal(false); setImportStep(1); }}
                  onImportComplete={async (data) => {
                    console.log('onImportComplete called', data);
                    if (!db || !userId) return;
                    setIsLoading(true);
                    try {
                      // Services
                      let serviceItems = data.filter(item => item._sheet === 'Services');
                      serviceItems = serviceItems.filter(item => Object.values(item).some(val => val !== null && val !== undefined && val !== ''));
                      console.log('Processed service items:', serviceItems);
                      const serviceBatch = writeBatch(db);
                      serviceItems.forEach(item => {
                        const docId = item['serviceTitanId'] || doc(collection(db, 'services')).id;
                        const dynamicPrice = item['Dynamic Price'] || item['DynamicPrice'];
                        const staticPrice = item['Static Price'] || item['StaticPrice'];
                        const price = dynamicPrice ? Number(dynamicPrice) : Number(staticPrice);
                        const useDynamicPricing = !!dynamicPrice;
                        // Link to category by unique category id if present
                        let categoryId = item['Category ID'] || item['CategoryID'] || item['categoryId'];
                        let categories = categoryId ? [String(categoryId)] : [];
                        serviceBatch.set(doc(db, 'services', docId), cleanFirestoreData({
                          ...item,
                          userId,
                          price: price || 0,
                          cost: Number(item['Cost']) || 0,
                          useDynamicPricing,
                          staticPrice: Number(staticPrice) || 0,
                          categories,
                          createdAt: serverTimestamp(),
                          updatedAt: serverTimestamp(),
                        }));
                      });
                      await serviceBatch.commit();
                      // Materials
                      let materialItems = data.filter(item => item._sheet === 'Materials');
                      materialItems = materialItems.filter(item => Object.values(item).some(val => val !== null && val !== undefined && val !== ''));
                      console.log('Processed material items:', materialItems);
                      const materialBatch = writeBatch(db);
                      materialItems.forEach(item => {
                        const docId = item['serviceTitanId'] || doc(collection(db, 'materials')).id;
                        materialBatch.set(doc(db, 'materials', docId), {
                          ...item,
                          userId,
                          price: Number(item['Price']) || 0,
                          cost: Number(item['Cost']) || 0,
                          createdAt: serverTimestamp(),
                          updatedAt: serverTimestamp(),
                        });
                      });
                      await materialBatch.commit();
                      alert('Pricebook data imported and synced to Firebase!');
                      await fetchServices();
                      await fetchMaterials();
                      setShowImportModal(false);
                      setImportStep(1);
                    } catch (error) {
                      console.error('Error importing pricebook data:', error);
                      alert('Error importing pricebook data.');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                />
              )}
            </div>
          </div>
        </Dialog>
      )}

      {showAddServiceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add Service</h2>
            <DynamicPricingModule
              serviceForm={serviceForm}
              setServiceForm={handleSetServiceForm}
              materials={materials}
              categories={categories}
              priceRules={priceRules}
            />
            <div className="flex justify-end space-x-2 mt-4">
              <button onClick={() => setShowAddServiceModal(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={handleSaveService} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      {showEditServiceModal && editingService && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Service</h2>
            <DynamicPricingModule
              serviceForm={serviceForm}
              setServiceForm={handleSetServiceForm}
              materials={materials}
              categories={categories}
              priceRules={priceRules}
            />
            <div className="flex justify-end space-x-2 mt-4">
              <button onClick={() => setShowEditServiceModal(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={handleUpdateService} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
            </div>
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
              <span>Select All</span>
              <button disabled={selectedCategoryIds.length === 0} onClick={() => setShowBulkDeleteCategoriesDialog(true)} className="px-2 py-1 bg-red-500 text-white rounded disabled:opacity-50">Bulk Delete</button>
              <button disabled={selectedCategoryIds.length === 0} onClick={() => setSelectedCategoryIds([])} className="px-2 py-1 bg-gray-200 rounded disabled:opacity-50">Deselect All</button>
            </div>
            {categories
              .filter(cat => cat.type === categoryType && !cat.parentId)
              .map(cat => (
                <CategoryTree
                  key={cat.id}
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

          {/* Materials Table */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={selectAllMaterials} onChange={e => handleSelectAllMaterials(e.target.checked)} />
                  <span>Select All</span>
                  <button disabled={selectedMaterialIds.length === 0} onClick={() => setShowBulkDeleteMaterialsDialog(true)} className="px-2 py-1 bg-red-500 text-white rounded disabled:opacity-50">Bulk Delete</button>
                  <button disabled={selectedMaterialIds.length === 0} onClick={() => setSelectedMaterialIds([])} className="px-2 py-1 bg-gray-200 rounded disabled:opacity-50">Deselect All</button>
                </div>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">{material.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{material.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{material.description}</div>
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
                              setMaterialForm({ ...initialMaterialFormState, ...material, serviceTitanId: material.serviceTitanId || '' });
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
        </div>
      )}

      <div className="flex justify-center items-center gap-4 mt-2">
        <button disabled={currentServicePage === 1} onClick={() => setCurrentServicePage(currentServicePage - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
        <span>Page {currentServicePage} of {Math.max(1, Math.ceil(filteredServices.length / ITEMS_PER_PAGE))}</span>
        <button disabled={currentServicePage === Math.ceil(filteredServices.length / ITEMS_PER_PAGE) || filteredServices.length === 0} onClick={() => setCurrentServicePage(currentServicePage + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
      </div>

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

    </div>
  );
};

export default Pricebook;
