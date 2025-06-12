import React from 'react';
import { ServiceFormState } from '../types/pricebook';
import { Tab } from '@headlessui/react';
import CategoryTreeSelector from './CategoryTreeSelector';
import type { Category } from '../types/pricebook';
import classNames from 'classnames';
import { GLAccount } from '../types/pricebook';
import MultiSelectTag from './MultiSelectTag';

interface ServiceFormProps {
  formData: ServiceFormState;
  onChange: (field: keyof ServiceFormState, value: any) => void;
  categories: Category[];
  materials: Array<{ id: string; name: string }>;
  equipment: Array<{ id: string; name: string }>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  isSaving?: boolean;
  error?: string | null;
  glAccounts: GLAccount[];
  allServices: { id: string; name: string }[];
}

const TAB_HEIGHT = 'min-h-[420px]'; // adjust as needed for your content

const ServiceForm: React.FC<ServiceFormProps> = ({
  formData,
  onChange,
  categories,
  materials,
  equipment,
  onSubmit,
  onCancel,
  isSubmitting,
  isSaving,
  error,
  glAccounts,
  allServices
}) => {
  const tabs = [
    { name: 'Basic Info', current: true },
    { name: 'Pricing', current: false },
    { name: 'Categories', current: false },
    { name: 'Linked Items', current: false },
    { name: 'Accounting', current: false },
    { name: 'Media & Marketing', current: false },
    { name: 'Commissions', current: false }
  ];

  const handleChange = (field: keyof ServiceFormState, value: any) => {
    onChange(field, value);
  };

  const handleNumberChange = (field: keyof ServiceFormState, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    if (!isNaN(numValue)) {
      onChange(field, numValue);
    }
  };

  const handleBooleanChange = (field: keyof ServiceFormState, checked: boolean) => {
    onChange(field, checked);
  };

  const handleArrayChange = (field: keyof ServiceFormState, value: string[]) => {
    onChange(field, value);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-slate-800 p-1 border-b border-gray-200 dark:border-slate-700">
          {tabs.map((tab, idx) => (
            <Tab
              key={tab.name}
              className={({ selected }) =>
                classNames(
                  'w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors',
                  selected
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                )
              }
            >
              {tab.name}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels className={TAB_HEIGHT + ' mt-4'}>
          {/* Basic Info Tab */}
          <Tab.Panel className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Code
                </label>
                <input
                  type="text"
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleChange('code', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <div className="mt-1 p-2 border rounded bg-gray-50 min-h-[40px]" dangerouslySetInnerHTML={{ __html: formData.description }} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="warrantyDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Warranty Description
                </label>
                <textarea
                  id="warrantyDescription"
                  value={formData.warrantyDescription}
                  onChange={(e) => handleChange('warrantyDescription', e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="laborService"
                  checked={formData.laborService}
                  onChange={(e) => handleBooleanChange('laborService', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="laborService" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  Labor Service
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => handleBooleanChange('active', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="active" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  Active
                </label>
              </div>
            </div>
          </Tab.Panel>

          {/* Pricing Tab */}
          <Tab.Panel className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="useStaticPrice"
                  checked={formData.useStaticPrice}
                  onChange={(e) => handleBooleanChange('useStaticPrice', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="useStaticPrice" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  Use Static Price
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="useDynamicPricing"
                  checked={formData.useDynamicPricing}
                  onChange={(e) => handleBooleanChange('useDynamicPricing', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="useDynamicPricing" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  Use Dynamic Pricing
                </label>
              </div>
              {formData.useStaticPrice && (
                <>
                  <div>
                    <label htmlFor="staticPrice" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Static Price
                    </label>
                    <input
                      type="number"
                      id="staticPrice"
                      value={formData.staticPrice}
                      onChange={(e) => handleNumberChange('staticPrice', e.target.value)}
                      step="0.01"
                      min="0"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </>
              )}
              {formData.useDynamicPricing && (
                <>
                  <div>
                    <label htmlFor="hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Hours
                    </label>
                    <input
                      type="number"
                      id="hours"
                      value={formData.hours}
                      onChange={(e) => handleNumberChange('hours', e.target.value)}
                      step="0.1"
                      min="0"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="estimatedLaborCost" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Estimated Labor Cost
                    </label>
                    <input
                      type="number"
                      id="estimatedLaborCost"
                      value={formData.estimatedLaborCost}
                      onChange={(e) => handleNumberChange('estimatedLaborCost', e.target.value)}
                      step="0.01"
                      min="0"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </>
              )}
            </div>
          </Tab.Panel>

          {/* Categories Tab */}
          <Tab.Panel className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="sm:col-span-2 dark:text-gray-100">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Categories</label>
                <div className="dark:text-gray-100">
                  <CategoryTreeSelector
                    categories={categories}
                    selected={formData.categories}
                    onChange={ids => handleArrayChange('categories', ids)}
                    type="service"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Hold Ctrl/Cmd to select multiple categories
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="excludeFromPricebookWizard"
                  checked={formData.excludeFromPricebookWizard}
                  onChange={(e) => handleBooleanChange('excludeFromPricebookWizard', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="excludeFromPricebookWizard" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  Exclude from Pricebook Wizard
                </label>
              </div>
            </div>
          </Tab.Panel>

          {/* Linked Items Tab */}
          <Tab.Panel className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="linkedMaterials" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Linked Materials
                </label>
                <MultiSelectTag
                  options={materials}
                  selected={formData.linkedMaterials}
                  onChange={(ids: string[]) => handleArrayChange('linkedMaterials', ids)}
                  placeholder="Search and select materials..."
                />
              </div>
              <div>
                <label htmlFor="linkedEquipment" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Linked Equipment
                </label>
                <MultiSelectTag
                  options={equipment}
                  selected={formData.linkedEquipment}
                  onChange={(ids: string[]) => handleArrayChange('linkedEquipment', ids)}
                  placeholder="Search and select equipment..."
                />
              </div>
              <div>
                <label htmlFor="upgrades" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Upgrades
                </label>
                <MultiSelectTag
                  options={allServices.filter(svc => svc.name !== formData.name)}
                  selected={formData.upgrades}
                  onChange={(ids: string[]) => handleArrayChange('upgrades', ids)}
                  placeholder="Search and select upgrades..."
                />
              </div>
              <div>
                <label htmlFor="recommendations" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Recommendations
                </label>
                <MultiSelectTag
                  options={allServices.filter(svc => svc.name !== formData.name)}
                  selected={formData.recommendations}
                  onChange={(ids: string[]) => handleArrayChange('recommendations', ids)}
                  placeholder="Search and select recommendations..."
                />
              </div>
            </div>
          </Tab.Panel>

          {/* Accounting Tab */}
          <Tab.Panel className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="crossSaleGroup" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Cross Sale Group
                </label>
                <input
                  type="text"
                  id="crossSaleGroup"
                  value={formData.crossSaleGroup || ''}
                  onChange={e => handleChange('crossSaleGroup', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  placeholder="e.g. Water Heaters"
                />
              </div>
              <div>
                <label htmlFor="revenueAccount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Revenue Account
                </label>
                <select
                  id="revenueAccount"
                  value={formData.generalLedgerAccount}
                  onChange={e => handleChange('generalLedgerAccount', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select Revenue Account</option>
                  {glAccounts.filter(acc => acc.active && acc.type === 'Revenue').map(acc => (
                    <option key={acc.id} value={acc.accountNumber}>
                      {acc.accountNumber} - {acc.accountName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="expenseAccount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Expense Account
                </label>
                <select
                  id="expenseAccount"
                  value={formData.expenseAccount}
                  onChange={e => handleChange('expenseAccount', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select Expense Account</option>
                  {glAccounts.filter(acc => acc.active && acc.type === 'Expense').map(acc => (
                    <option key={acc.id} value={acc.accountNumber}>
                      {acc.accountNumber} - {acc.accountName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allowDiscounts"
                  checked={formData.allowDiscounts}
                  onChange={(e) => handleBooleanChange('allowDiscounts', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="allowDiscounts" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  Allow Discounts
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allowMembershipDiscounts"
                  checked={formData.allowMembershipDiscounts}
                  onChange={(e) => handleBooleanChange('allowMembershipDiscounts', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="allowMembershipDiscounts" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  Allow Membership Discounts
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="taxable"
                  checked={formData.taxable}
                  onChange={(e) => handleBooleanChange('taxable', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="taxable" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  Taxable
                </label>
              </div>
            </div>
          </Tab.Panel>

          {/* Media & Marketing Tab */}
          <Tab.Panel className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="conversionTags" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Conversion Tags
                </label>
                <input
                  type="text"
                  id="conversionTags"
                  value={formData.conversionTags.join(', ')}
                  onChange={(e) => handleArrayChange('conversionTags', e.target.value.split(',').map(tag => tag.trim()))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  placeholder="Enter tags separated by commas"
                />
              </div>
              {/* TODO: Add image and video upload functionality */}
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                <p className="text-sm text-gray-500">
                  Image and video upload functionality coming soon
                </p>
              </div>
            </div>
          </Tab.Panel>

          {/* Commissions Tab */}
          <Tab.Panel className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="commissionPercentage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Commission Percentage
                </label>
                <input
                  type="number"
                  id="commissionPercentage"
                  value={formData.commissionPercentage}
                  onChange={(e) => handleNumberChange('commissionPercentage', e.target.value)}
                  step="0.01"
                  min="0"
                  max="100"
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="bonusPercentage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Bonus Percentage
                </label>
                <input
                  type="number"
                  id="bonusPercentage"
                  value={formData.bonusPercentage}
                  onChange={(e) => handleNumberChange('bonusPercentage', e.target.value)}
                  step="0.01"
                  min="0"
                  max="100"
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="payTechSpecificBonus"
                  checked={formData.payTechSpecificBonus}
                  onChange={(e) => handleBooleanChange('payTechSpecificBonus', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="payTechSpecificBonus" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  Pay Tech-Specific Bonus
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="paysCommission"
                  checked={formData.paysCommission}
                  onChange={(e) => handleBooleanChange('paysCommission', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="paysCommission" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  Pays Commission
                </label>
              </div>
            </div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      <div className="mt-6 flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || isSaving}
          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {(isSubmitting || isSaving) ? 'Saving...' : 'Save'}
        </button>
      </div>
      {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
    </form>
  );
};

export default ServiceForm; 