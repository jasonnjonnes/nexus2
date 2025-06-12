import React, { useRef, useState, useCallback } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Camera, Upload, X } from 'lucide-react';
import type { MaterialFormState, Category, GLAccount } from '../types/pricebook';
import CategoryTreeSelector from './CategoryTreeSelector';

interface MaterialFormProps {
  formData: MaterialFormState;
  onChange: (field: keyof MaterialFormState, value: any) => void;
  categories: Category[];
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  isSaving?: boolean;
  error?: string | null;
  glAccounts: GLAccount[];
  editing?: boolean;
}

const MaterialForm: React.FC<MaterialFormProps> = ({
  formData,
  onChange,
  categories,
  onSubmit,
  onCancel,
  isSubmitting,
  isSaving,
  error,
  glAccounts,
  editing = true
}) => {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setUploading(true);
      const storage = getStorage();
      const userId = (formData as any).userId || 'anonymous';
      const materialId = (formData as any).id || 'new';
      const uploadedImages = await Promise.all(files.map(async (file) => {
        const storageRef = ref(storage, `material_photos/${userId}/${materialId}/${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        return {
          id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          url,
          uploadedAt: new Date().toISOString()
        };
      }));
      onChange('images', [...(formData.images || []), ...uploadedImages]);
      setUploading(false);
      event.target.value = '';
    }
  }, [formData, onChange]);

  const removeImage = (imageId: string) => {
    onChange('images', (formData.images || []).filter((img: any) => img.id !== imageId));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Code *</label>
          <input
            type="text"
            value={formData.code}
            onChange={e => onChange('code', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => onChange('name', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
            required
          />
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
              type="material"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vendor</label>
          <input
            type="text"
            value={formData.vendor}
            onChange={e => onChange('vendor', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vendor Part Number</label>
          <input
            type="text"
            value={formData.vendorPartNumber}
            onChange={e => onChange('vendorPartNumber', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Revenue Account</label>
          <select
            value={formData.generalLedgerAccount || ''}
            onChange={e => onChange('generalLedgerAccount', e.target.value)}
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Expense Account</label>
          <select
            value={formData.expenseAccount || ''}
            onChange={e => onChange('expenseAccount', e.target.value)}
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
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cost</label>
          <input
            type="number"
            value={formData.cost}
            onChange={e => onChange('cost', parseFloat(e.target.value) || 0)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
            min="0"
            step="0.01"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Price</label>
          <input
            type="number"
            value={formData.price}
            onChange={e => onChange('price', parseFloat(e.target.value) || 0)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
            min="0"
            step="0.01"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Markup (%)</label>
          <input
            type="number"
            value={formData.markup}
            onChange={e => onChange('markup', parseFloat(e.target.value) || 0)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
            min="0"
            step="0.01"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Unit</label>
          <input
            type="text"
            value={formData.unit}
            onChange={e => onChange('unit', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="taxable"
            checked={formData.taxable}
            onChange={e => onChange('taxable', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-700"
          />
          <label htmlFor="taxable" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">Taxable</label>
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="active"
            checked={formData.active}
            onChange={e => onChange('active', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-700"
          />
          <label htmlFor="active" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">Active</label>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
          <textarea
            value={formData.notes}
            onChange={e => onChange('notes', e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Photos</label>
        {formData.images && formData.images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {formData.images.map((image: any) => (
              <div key={image.id} className="relative">
                <img src={image.url} alt={image.name} className="w-full h-24 object-cover rounded-lg border border-gray-300" />
                <button
                  type="button"
                  onClick={() => removeImage(image.id)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Camera size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">Add photos for this material</p>
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            disabled={uploading}
          >
            <Upload size={16} className="mr-2 inline" />
            {uploading ? 'Uploading...' : 'Upload Photos'}
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>
      </div>
      <div className="flex justify-end space-x-2 mt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 border rounded">Cancel</button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded" disabled={isSubmitting || isSaving}>{(isSubmitting || isSaving) ? 'Saving...' : 'Save Material'}</button>
      </div>
      {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
    </form>
  );
};

export default MaterialForm; 