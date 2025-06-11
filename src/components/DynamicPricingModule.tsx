import React, { useState, useCallback, useRef } from 'react';
import {
  Plus, X, Camera, Upload
} from 'lucide-react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { ServiceFormState, PriceRule } from '../types/pricebook';

// Types for props
interface Material {
  id: string;
  name: string;
  code: string;
  cost: number;
}

interface Category {
  id: string;
  name: string;
  priceRuleId?: string | null;
}

interface DynamicPricingModuleProps {
  serviceForm: ServiceFormState;
  setServiceForm: (form: ServiceFormState) => void;
  materials: Material[];
  categories: Category[];
  priceRules: PriceRule[];
}

const DynamicPricingModule: React.FC<DynamicPricingModuleProps> = ({
  serviceForm,
  setServiceForm,
  materials,
  categories,
  priceRules
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'commissions' | 'materials'>('details');
  const servicePhotoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Category selection
  const handleCategoryChange = useCallback((categoryId: string) => {
    setServiceForm({
      ...serviceForm,
      categories: serviceForm.categories.includes(categoryId)
        ? serviceForm.categories.filter(id => id !== categoryId)
        : [...serviceForm.categories, categoryId]
    });
  }, [serviceForm, setServiceForm]);

  // Linked materials
  const handleLinkedMaterialChange = useCallback((materialId: string) => {
    setServiceForm({
      ...serviceForm,
      linkedMaterials: serviceForm.linkedMaterials.includes(materialId)
        ? serviceForm.linkedMaterials.filter(id => id !== materialId)
        : [...serviceForm.linkedMaterials, materialId]
    });
  }, [serviceForm, setServiceForm]);

  // Conversion tags
  const addConversionTag = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      e.preventDefault();
      const newTag = e.currentTarget.value.trim();
      if (!serviceForm.conversionTags.includes(newTag)) {
        setServiceForm({
          ...serviceForm,
          conversionTags: [...serviceForm.conversionTags, newTag]
        });
      }
      e.currentTarget.value = '';
    }
  }, [serviceForm, setServiceForm]);

  const removeConversionTag = useCallback((tagToRemove: string) => {
    setServiceForm({
      ...serviceForm,
      conversionTags: serviceForm.conversionTags.filter(tag => tag !== tagToRemove)
    });
  }, [serviceForm, setServiceForm]);

  // Photo upload (Firebase Storage)
  const handleServicePhotoUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setUploading(true);
      const storage = getStorage();
      const userId = (serviceForm as any).userId || 'anonymous';
      const serviceId = (serviceForm as any).id || 'new';
      const uploadedImages = await Promise.all(files.map(async (file) => {
        const storageRef = ref(storage, `service_photos/${userId}/${serviceId}/${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        return {
          id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          url,
          uploadedAt: new Date().toISOString()
        };
      }));
      setServiceForm({
        ...serviceForm,
        images: [...serviceForm.images, ...uploadedImages]
      });
      setUploading(false);
      event.target.value = '';
    }
  }, [serviceForm, setServiceForm]);

  const removeServiceImage = useCallback((imageId: string) => {
    setServiceForm({
      ...serviceForm,
      images: serviceForm.images.filter(img => img.id !== imageId)
    });
  }, [serviceForm, setServiceForm]);

  // Dynamic price calculation
  const calculateDynamicPrice = useCallback(() => {
    if (!serviceForm.useDynamicPricing || !serviceForm.categories.length || !serviceForm.hours) {
      return 0;
    }
    let applicablePriceRule: PriceRule | null = null;
    for (const categoryId of serviceForm.categories) {
      const category = categories.find(cat => cat.id === categoryId);
      if (category && category.priceRuleId) {
        applicablePriceRule = priceRules.find(rule => rule.id === category.priceRuleId) || null;
        if (applicablePriceRule) break;
      }
    }
    if (!applicablePriceRule) return 0;
    let totalCost = applicablePriceRule.baseRate * serviceForm.hours;
    if (serviceForm.linkedMaterials.length > 0) {
      const materialsCost = serviceForm.linkedMaterials.reduce((sum, materialId) => {
        const material = materials.find(m => m.id === materialId);
        if (material) {
          const materialCostWithMarkup = material.cost * (1 + (applicablePriceRule!.materialMarkup / 100));
          return sum + materialCostWithMarkup;
        }
        return sum;
      }, 0);
      totalCost += materialsCost;
    }
    return totalCost;
  }, [serviceForm, categories, priceRules, materials]);

  // Form change handler
  const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox' && e.target instanceof HTMLInputElement) {
      setServiceForm({
        ...serviceForm,
        [name]: e.target.checked
      });
    } else {
      setServiceForm({
        ...serviceForm,
        [name]: type === 'number' ? parseFloat(value) || 0 : value
      });
    }
  }, [serviceForm, setServiceForm]);

  return (
    <div>
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('commissions')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'commissions'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            Commissions
          </button>
          <button
            onClick={() => setActiveTab('materials')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'materials'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
          >
            Materials
          </button>
        </nav>
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code *</label>
              <input
                type="text"
                name="code"
                value={serviceForm.code}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input
                type="text"
                name="name"
                value={serviceForm.name}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <input
              type="text"
              name="description"
              value={serviceForm.description}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
            />
          </div>
          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categories</label>
            <div className="border border-gray-300 dark:border-slate-600 rounded-lg p-3 max-h-40 overflow-y-auto">
              {categories.map(category => (
                <label key={category.id} className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={serviceForm.categories.includes(category.id)}
                    onChange={() => handleCategoryChange(category.id)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{category.name}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Pricing */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Pricing</h3>
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="useDynamicPricing"
                  checked={serviceForm.useDynamicPricing}
                  onChange={handleFormChange}
                  className="rounded border-gray-300 text-blue-600 shadow-sm"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Use Dynamic Pricing (from category price rules)</span>
              </label>
            </div>
            {serviceForm.useDynamicPricing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hours</label>
                  <input
                    type="number"
                    name="hours"
                    value={serviceForm.hours}
                    onChange={handleFormChange}
                    step="0.001"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
                {serviceForm.categories.length > 0 && serviceForm.hours && (
                  <div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Calculated Price:</span>
                        <span className="text-lg font-bold text-blue-800 dark:text-blue-200">
                          ${calculateDynamicPrice().toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                        Includes linked materials with markup
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Static Price</label>
                  <input
                    type="number"
                    name="staticPrice"
                    value={serviceForm.staticPrice}
                    onChange={handleFormChange}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hours</label>
                  <input
                    type="number"
                    name="hours"
                    value={serviceForm.hours}
                    onChange={handleFormChange}
                    step="0.001"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
            )}
          </div>
          {/* Conversion Tags */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Conversion Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {serviceForm.conversionTags.map(tag => (
                <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeConversionTag(tag)}
                    className="ml-1 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-100"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Type and press Enter to add tags"
              onKeyDown={addConversionTag}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
            />
          </div>
          {/* Photos */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Photos</label>
            {serviceForm.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {serviceForm.images.map(image => (
                  <div key={image.id} className="relative">
                    <img src={image.url} alt={image.name} className="w-full h-24 object-cover rounded-lg border border-gray-300 dark:border-slate-600" />
                    <button
                      onClick={() => removeServiceImage(image.id)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-6 text-center">
              <Camera size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">Add photos for this service</p>
              <button
                type="button"
                onClick={() => servicePhotoInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload size={16} className="mr-2 inline" />
                Upload Photos
              </button>
              <input
                ref={servicePhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleServicePhotoUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}
      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Linked Materials</label>
            <div className="border border-gray-300 dark:border-slate-600 rounded-lg p-3 max-h-60 overflow-y-auto">
              {materials.length > 0 ? (
                materials.map(material => (
                  <label key={material.id} className="flex items-center justify-between mb-2 p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={serviceForm.linkedMaterials.includes(material.id)}
                        onChange={() => handleLinkedMaterialChange(material.id)}
                        className="rounded border-gray-300 text-blue-600 shadow-sm"
                      />
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{material.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{material.code} - Cost: ${material.cost?.toFixed(2) || '0.00'}</div>
                      </div>
                    </div>
                  </label>
                ))
              ) : (
                <div className="text-center py-8">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">No materials available. Add materials first to link them to services.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Commissions Tab (placeholder) */}
      {activeTab === 'commissions' && (
        <div className="space-y-6">
          <div className="text-gray-600 dark:text-gray-400">Commissions tab content goes here.</div>
        </div>
      )}
    </div>
  );
};

export default DynamicPricingModule; 