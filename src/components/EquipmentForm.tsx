import React, { useRef, useState, useCallback } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import type { Category, GLAccount } from '../types/pricebook';
import CategoryTreeSelector from './CategoryTreeSelector';
import MultiSelectTag from './MultiSelectTag';

export interface EquipmentFormState {
  code: string;
  name: string;
  description: string;
  categoryId: string;
  categories: string[];
  type: string;
  account: string;
  costOfSaleAccount: string;
  assetAccount: string;
  crossSaleGroup: string;
  upgrades: string;
  recommendationsServices: string;
  recommendationsMaterials: string;
  dollarBonus: number;
  paysCommission: boolean;
  bonusPercentage: number;
  hours: number;
  payTechSpecificBonus: boolean;
  isConfigurable: boolean;
  taxable: boolean;
  brand: string;
  manufacturer: string;
  model: string;
  cost: number;
  price: number;
  memberPrice: number;
  addOnPrice: number;
  addOnMemberPrice: number;
  unitOfMeasure: string;
  allowDiscounts: boolean;
  allowMembershipDiscounts: boolean;
  manufacturerWarrantyDuration: string;
  manufacturerWarrantyDescription: string;
  serviceProviderWarrantyDuration: string;
  serviceProviderWarrantyDescription: string;
  dimensionsH: string;
  dimensionsW: string;
  dimensionsD: string;
  active: boolean;
  replenishment: boolean;
  vendors: Array<{
    name: string;
    active: boolean;
    partNumber: string;
    memo: string;
    price: string;
    primaryVendor: boolean;
  }>;
  notes: string;
  linkedMaterials: string[];
}

interface EquipmentFormProps {
  formData: EquipmentFormState;
  onChange: (field: keyof EquipmentFormState, value: any) => void;
  categories: Category[];
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  isSaving?: boolean;
  error?: string | null;
  glAccounts: GLAccount[];
  isEdit: boolean;
  materials: Array<{ id: string; name: string }>;
}

const TAB_LABELS = ['Details', 'Price', 'Warranty', 'Specs'];

const EquipmentForm: React.FC<EquipmentFormProps> = ({
  formData,
  onChange,
  categories,
  onSubmit,
  onCancel,
  isSubmitting,
  isSaving,
  error,
  glAccounts,
  isEdit,
  materials
}) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b mb-4">
        {TAB_LABELS.map((label, idx) => (
          <button
            type="button"
            key={label}
            className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-colors ${activeTab === idx ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab(idx)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[350px]">
        {activeTab === 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Code *</label>
              <input type="text" value={formData.code} onChange={e => onChange('code', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name *</label>
              <input type="text" value={formData.name} onChange={e => onChange('name', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <div className="mt-1 p-2 border border-gray-300 dark:border-slate-600 rounded bg-gray-50 dark:bg-slate-700 min-h-[40px] text-gray-900 dark:text-gray-100" dangerouslySetInnerHTML={{ __html: formData.description }} />
            </div>
            <div className="sm:col-span-2 dark:text-gray-100">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Categories</label>
              <div className="dark:text-gray-100">
                <CategoryTreeSelector
                  categories={categories}
                  selected={formData.categories}
                  onChange={ids => onChange('categories', ids)}
                  type="equipment"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
              <input type="text" value={formData.type} onChange={e => onChange('type', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">General Ledger Account</label>
              <select value={formData.account} onChange={e => onChange('account', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100">
                <option value="">Select Revenue Account</option>
                {glAccounts.filter(acc => acc.active && acc.type === 'Revenue').map(acc => (
                  <option key={acc.id} value={acc.accountNumber}>{acc.accountNumber} - {acc.accountName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cost of Sale Account</label>
              <select value={formData.costOfSaleAccount} onChange={e => onChange('costOfSaleAccount', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100">
                <option value="">Select Expense Account</option>
                {glAccounts.filter(acc => acc.active && acc.type === 'Expense').map(acc => (
                  <option key={acc.id} value={acc.accountNumber}>{acc.accountNumber} - {acc.accountName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Asset Account</label>
              <select value={formData.assetAccount} onChange={e => onChange('assetAccount', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100">
                <option value="">Select Asset Account</option>
                {glAccounts.filter(acc => acc.active && acc.type === 'Asset').map(acc => (
                  <option key={acc.id} value={acc.accountNumber}>{acc.accountNumber} - {acc.accountName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cross Sale Group</label>
              <input type="text" value={formData.crossSaleGroup} onChange={e => onChange('crossSaleGroup', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Upgrades</label>
              <input type="text" value={formData.upgrades} onChange={e => onChange('upgrades', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Recommendations (Services)</label>
              <input type="text" value={formData.recommendationsServices} onChange={e => onChange('recommendationsServices', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Recommendations (Materials)</label>
              <input type="text" value={formData.recommendationsMaterials} onChange={e => onChange('recommendationsMaterials', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
              <textarea value={formData.notes} onChange={e => onChange('notes', e.target.value)} rows={2} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Linked Materials</label>
              <MultiSelectTag
                options={materials}
                selected={formData.linkedMaterials}
                onChange={(ids: string[]) => onChange('linkedMaterials', ids)}
                placeholder="Search and select materials..."
              />
            </div>
          </div>
        )}
        {activeTab === 1 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cost</label>
              <input type="number" value={formData.cost} onChange={e => onChange('cost', parseFloat(e.target.value) || 0)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" min="0" step="0.01" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Price</label>
              <input type="number" value={formData.price} onChange={e => onChange('price', parseFloat(e.target.value) || 0)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" min="0" step="0.01" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Member Price</label>
              <input type="number" value={formData.memberPrice} onChange={e => onChange('memberPrice', parseFloat(e.target.value) || 0)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" min="0" step="0.01" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Add-On Price</label>
              <input type="number" value={formData.addOnPrice} onChange={e => onChange('addOnPrice', parseFloat(e.target.value) || 0)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" min="0" step="0.01" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Add-On Member Price</label>
              <input type="number" value={formData.addOnMemberPrice} onChange={e => onChange('addOnMemberPrice', parseFloat(e.target.value) || 0)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" min="0" step="0.01" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Unit of Measure</label>
              <input type="text" value={formData.unitOfMeasure} onChange={e => onChange('unitOfMeasure', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Allow Discounts</label>
              <input type="checkbox" checked={formData.allowDiscounts} onChange={e => onChange('allowDiscounts', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Allow Membership Discounts</label>
              <input type="checkbox" checked={formData.allowMembershipDiscounts} onChange={e => onChange('allowMembershipDiscounts', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            </div>
          </div>
        )}
        {activeTab === 2 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Manufacturer Warranty Duration</label>
              <input type="text" value={formData.manufacturerWarrantyDuration} onChange={e => onChange('manufacturerWarrantyDuration', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Manufacturer Warranty Description</label>
              <input type="text" value={formData.manufacturerWarrantyDescription} onChange={e => onChange('manufacturerWarrantyDescription', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Service Provider Warranty Duration</label>
              <input type="text" value={formData.serviceProviderWarrantyDuration} onChange={e => onChange('serviceProviderWarrantyDuration', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Service Provider Warranty Description</label>
              <input type="text" value={formData.serviceProviderWarrantyDescription} onChange={e => onChange('serviceProviderWarrantyDescription', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
          </div>
        )}
        {activeTab === 3 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Manufacturer</label>
              <input type="text" value={formData.manufacturer} onChange={e => onChange('manufacturer', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Brand</label>
              <input type="text" value={formData.brand} onChange={e => onChange('brand', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
              <input type="text" value={formData.model} onChange={e => onChange('model', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dimensions (H)</label>
              <input type="text" value={formData.dimensionsH} onChange={e => onChange('dimensionsH', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dimensions (W)</label>
              <input type="text" value={formData.dimensionsW} onChange={e => onChange('dimensionsW', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dimensions (D)</label>
              <input type="text" value={formData.dimensionsD} onChange={e => onChange('dimensionsD', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Active</label>
              <input type="checkbox" checked={formData.active} onChange={e => onChange('active', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Replenishment</label>
              <input type="checkbox" checked={formData.replenishment} onChange={e => onChange('replenishment', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2 mt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 border rounded">Cancel</button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded" disabled={isSubmitting || isSaving}>{(isSubmitting || isSaving) ? 'Saving...' : 'Save Equipment'}</button>
      </div>
      {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
    </form>
  );
};

export default EquipmentForm; 