import React from 'react';
import { ServiceFormState } from '../types/pricebook';
import { Tab } from '@headlessui/react';

interface ServiceFormProps {
  formData: ServiceFormState;
  onChange: (field: keyof ServiceFormState, value: any) => void;
  categories: Array<{ id: string; name: string; type: string }>;
  materials: Array<{ id: string; name: string }>;
  equipment: Array<{ id: string; name: string }>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

const ServiceForm: React.FC<ServiceFormProps> = ({
  formData,
  onChange,
  categories,
  materials,
  equipment,
  onSubmit,
  onCancel,
  isSubmitting
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
        <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1">
          {tabs.map((tab) => (
            <Tab
              key={tab.name}
              className={({ selected }) =>
                [
                  'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                  'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                  selected
                    ? 'bg-white shadow text-blue-700'
                    : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                ].join(' ')
              }
            >
              {tab.name}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels className="mt-4">
          {/* Basic Info Tab */}
          <Tab.Panel className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                  Code
                </label>
                <input
                  type="text"
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleChange('code', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="serviceTitanId" className="block text-sm font-medium text-gray-700">
                  ServiceTitan ID
                </label>
                <input
                  type="text"
                  id="serviceTitanId"
                  value={formData.serviceTitanId || ''}
                  onChange={(e) => handleChange('serviceTitanId', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  rows={3}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="warrantyDescription" className="block text-sm font-medium text-gray-700">
                  Warranty Description
                </label>
                <textarea
                  id="warrantyDescription"
                  value={formData.warrantyDescription}
                  onChange={(e) => handleChange('warrantyDescription', e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
                <label htmlFor="laborService" className="ml-2 block text-sm text-gray-900">
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
                <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
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
                <label htmlFor="useStaticPrice" className="ml-2 block text-sm text-gray-900">
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
                <label htmlFor="useDynamicPricing" className="ml-2 block text-sm text-gray-900">
                  Use Dynamic Pricing
                </label>
              </div>
              {formData.useStaticPrice && (
                <>
                  <div>
                    <label htmlFor="staticPrice" className="block text-sm font-medium text-gray-700">
                      Static Price
                    </label>
                    <input
                      type="number"
                      id="staticPrice"
                      value={formData.staticPrice}
                      onChange={(e) => handleNumberChange('staticPrice', e.target.value)}
                      step="0.01"
                      min="0"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="staticMemberPrice" className="block text-sm font-medium text-gray-700">
                      Static Member Price
                    </label>
                    <input
                      type="number"
                      id="staticMemberPrice"
                      value={formData.staticMemberPrice}
                      onChange={(e) => handleNumberChange('staticMemberPrice', e.target.value)}
                      step="0.01"
                      min="0"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="staticAddOnPrice" className="block text-sm font-medium text-gray-700">
                      Static Add-On Price
                    </label>
                    <input
                      type="number"
                      id="staticAddOnPrice"
                      value={formData.staticAddOnPrice}
                      onChange={(e) => handleNumberChange('staticAddOnPrice', e.target.value)}
                      step="0.01"
                      min="0"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="staticMemberAddOnPrice" className="block text-sm font-medium text-gray-700">
                      Static Member Add-On Price
                    </label>
                    <input
                      type="number"
                      id="staticMemberAddOnPrice"
                      value={formData.staticMemberAddOnPrice}
                      onChange={(e) => handleNumberChange('staticMemberAddOnPrice', e.target.value)}
                      step="0.01"
                      min="0"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </>
              )}
              {formData.useDynamicPricing && (
                <>
                  <div>
                    <label htmlFor="hours" className="block text-sm font-medium text-gray-700">
                      Hours
                    </label>
                    <input
                      type="number"
                      id="hours"
                      value={formData.hours}
                      onChange={(e) => handleNumberChange('hours', e.target.value)}
                      step="0.1"
                      min="0"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="estimatedLaborCost" className="block text-sm font-medium text-gray-700">
                      Estimated Labor Cost
                    </label>
                    <input
                      type="number"
                      id="estimatedLaborCost"
                      value={formData.estimatedLaborCost}
                      onChange={(e) => handleNumberChange('estimatedLaborCost', e.target.value)}
                      step="0.01"
                      min="0"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          </Tab.Panel>

          {/* Categories Tab */}
          <Tab.Panel className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="categories" className="block text-sm font-medium text-gray-700">
                  Categories
                </label>
                <select
                  id="categories"
                  multiple
                  value={formData.categories}
                  onChange={(e) => handleArrayChange('categories', Array.from(e.target.selectedOptions, option => option.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  size={5}
                >
                  {categories
                    .filter(cat => cat.type === 'service')
                    .map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Hold Ctrl/Cmd to select multiple categories
                </p>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="excludeFromPricebookWizard"
                  checked={formData.excludeFromPricebookWizard}
                  onChange={(e) => handleBooleanChange('excludeFromPricebookWizard', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="excludeFromPricebookWizard" className="ml-2 block text-sm text-gray-900">
                  Exclude from Pricebook Wizard
                </label>
              </div>
            </div>
          </Tab.Panel>

          {/* Linked Items Tab */}
          <Tab.Panel className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="linkedMaterials" className="block text-sm font-medium text-gray-700">
                  Linked Materials
                </label>
                <select
                  id="linkedMaterials"
                  multiple
                  value={formData.linkedMaterials}
                  onChange={(e) => handleArrayChange('linkedMaterials', Array.from(e.target.selectedOptions, option => option.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  size={5}
                >
                  {materials.map(material => (
                    <option key={material.id} value={material.id}>
                      {material.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="linkedEquipment" className="block text-sm font-medium text-gray-700">
                  Linked Equipment
                </label>
                <select
                  id="linkedEquipment"
                  multiple
                  value={formData.linkedEquipment}
                  onChange={(e) => handleArrayChange('linkedEquipment', Array.from(e.target.selectedOptions, option => option.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  size={5}
                >
                  {equipment.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="upgrades" className="block text-sm font-medium text-gray-700">
                  Upgrades
                </label>
                <select
                  id="upgrades"
                  multiple
                  value={formData.upgrades}
                  onChange={(e) => handleArrayChange('upgrades', Array.from(e.target.selectedOptions, option => option.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  size={5}
                >
                  {categories
                    .filter(cat => cat.type === 'service')
                    .map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="recommendations" className="block text-sm font-medium text-gray-700">
                  Recommendations
                </label>
                <select
                  id="recommendations"
                  multiple
                  value={formData.recommendations}
                  onChange={(e) => handleArrayChange('recommendations', Array.from(e.target.selectedOptions, option => option.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  size={5}
                >
                  {categories
                    .filter(cat => cat.type === 'service')
                    .map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </Tab.Panel>

          {/* Accounting Tab */}
          <Tab.Panel className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="crossSaleGroup" className="block text-sm font-medium text-gray-700">
                  Cross Sale Group
                </label>
                <input
                  type="text"
                  id="crossSaleGroup"
                  value={formData.crossSaleGroup}
                  onChange={(e) => handleChange('crossSaleGroup', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="generalLedgerAccount" className="block text-sm font-medium text-gray-700">
                  General Ledger Account
                </label>
                <input
                  type="text"
                  id="generalLedgerAccount"
                  value={formData.generalLedgerAccount}
                  onChange={(e) => handleChange('generalLedgerAccount', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="expenseAccount" className="block text-sm font-medium text-gray-700">
                  Expense Account
                </label>
                <input
                  type="text"
                  id="expenseAccount"
                  value={formData.expenseAccount}
                  onChange={(e) => handleChange('expenseAccount', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allowDiscounts"
                  checked={formData.allowDiscounts}
                  onChange={(e) => handleBooleanChange('allowDiscounts', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="allowDiscounts" className="ml-2 block text-sm text-gray-900">
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
                <label htmlFor="allowMembershipDiscounts" className="ml-2 block text-sm text-gray-900">
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
                <label htmlFor="taxable" className="ml-2 block text-sm text-gray-900">
                  Taxable
                </label>
              </div>
            </div>
          </Tab.Panel>

          {/* Media & Marketing Tab */}
          <Tab.Panel className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="conversionTags" className="block text-sm font-medium text-gray-700">
                  Conversion Tags
                </label>
                <input
                  type="text"
                  id="conversionTags"
                  value={formData.conversionTags.join(', ')}
                  onChange={(e) => handleArrayChange('conversionTags', e.target.value.split(',').map(tag => tag.trim()))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
                <label htmlFor="commissionPercentage" className="block text-sm font-medium text-gray-700">
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="bonusPercentage" className="block text-sm font-medium text-gray-700">
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
                <label htmlFor="payTechSpecificBonus" className="ml-2 block text-sm text-gray-900">
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
                <label htmlFor="paysCommission" className="ml-2 block text-sm text-gray-900">
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
          disabled={isSubmitting}
          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
};

export default ServiceForm; 