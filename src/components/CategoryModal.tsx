import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X } from 'lucide-react';
import { Category, CategoryFormState } from '../types/pricebook';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: CategoryFormState) => Promise<void>;
  category?: Category | null;
  categories: Category[];
  priceRules: Array<{ id: string; name: string }>;
}

const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  category,
  categories,
  priceRules,
}) => {
  const initialFormState: CategoryFormState = {
    name: '',
    description: '',
    type: 'service',
    parentId: null,
    priceRuleId: null,
    active: true,
    serviceTitanId: '',
    serviceTitanParentId: null,
    isExcludedFromPricebookWizard: false,
  };

  const [formState, setFormState] = useState<CategoryFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (category) {
      setFormState({
        name: category.name,
        description: category.description,
        type: category.type,
        parentId: category.parentId,
        priceRuleId: category.priceRuleId || null,
        active: category.active,
        serviceTitanId: category.serviceTitanId || '',
        serviceTitanParentId: null,
        isExcludedFromPricebookWizard: category.isExcludedFromPricebookWizard,
      });
    } else {
      setFormState(initialFormState);
    }
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formState);
      onClose();
    } catch (error) {
      console.error('Error saving category:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof CategoryFormState, value: any) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-lg rounded-lg bg-white dark:bg-slate-800 p-6 w-full">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-lg font-medium">
              {category ? 'Edit Category' : 'Add Category'}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formState.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={formState.type}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2"
              >
                <option value="service">Service</option>
                <option value="material">Material</option>
                <option value="equipment">Equipment</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Parent Category</label>
              <select
                value={formState.parentId || ''}
                onChange={(e) => handleChange('parentId', e.target.value || null)}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2"
              >
                <option value="">None (Root Category)</option>
                {categories
                  .filter(c => c.id !== category?.id) // Prevent self-selection
                  .map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Price Rule</label>
              <select
                value={formState.priceRuleId || ''}
                onChange={(e) => handleChange('priceRuleId', e.target.value || null)}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2"
              >
                <option value="">None</option>
                {priceRules.map(rule => (
                  <option key={rule.id} value={rule.id}>
                    {rule.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="active"
                checked={formState.active}
                onChange={(e) => handleChange('active', e.target.checked)}
                className="rounded border-gray-300 dark:border-slate-600"
              />
              <label htmlFor="active" className="text-sm font-medium">
                Active
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="excludeFromWizard"
                checked={formState.isExcludedFromPricebookWizard}
                onChange={(e) => handleChange('isExcludedFromPricebookWizard', e.target.checked)}
                className="rounded border-gray-300 dark:border-slate-600"
              />
              <label htmlFor="excludeFromWizard" className="text-sm font-medium">
                Exclude from Pricebook Wizard
              </label>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Category'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default CategoryModal; 