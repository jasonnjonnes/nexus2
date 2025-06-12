import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, Calculator } from 'lucide-react';
import { PriceRule, PriceRuleForm, MarkupTier } from '../types/pricebook';
import CategoryTreeSelector from './CategoryTreeSelector';

interface Category { id: string; name: string; }
interface Service { id: string; name: string; }
interface Material { id: string; name: string; cost: number; }

interface PriceRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (form: PriceRuleForm) => void;
  priceRule?: PriceRule | null;
  categories: Category[];
  services: Service[];
  materials?: Material[];
}

const defaultForm: PriceRuleForm = {
  name: '',
  description: '',
  baseRate: 120,
  afterHoursMultiplier: 1.5,
  emergencyMultiplier: 2.0,
  weekendSurcharge: 0,
  holidaySurcharge: 0,
  afterHoursSurcharge: 0,
  minimumCharge: 0,
  travelTime: false,
  mileageRate: 0,
  materialMarkup: 0,
  laborMarkup: 0,
  markupTiers: [
    { min: 0, max: 100, percent: 25 },
    { min: 100, max: 500, percent: 15 },
    { min: 500, max: null, percent: 10 },
  ],
  assignedCategories: [],
  assignedServices: [],
  active: true,
};

const PriceRuleModal: React.FC<PriceRuleModalProps> = ({
  isOpen, onClose, onSave, priceRule, categories, services, materials = []
}) => {
  const [form, setForm] = useState<PriceRuleForm>({ ...defaultForm, ...(priceRule ? {
    name: priceRule.name,
    description: priceRule.description,
    baseRate: priceRule.baseRate,
    afterHoursMultiplier: priceRule.afterHoursMultiplier,
    emergencyMultiplier: priceRule.emergencyMultiplier,
    weekendSurcharge: priceRule.weekendSurcharge,
    holidaySurcharge: priceRule.holidaySurcharge,
    afterHoursSurcharge: priceRule.afterHoursSurcharge,
    minimumCharge: priceRule.minimumCharge,
    travelTime: priceRule.travelTime,
    mileageRate: priceRule.mileageRate,
    materialMarkup: priceRule.materialMarkup,
    laborMarkup: priceRule.laborMarkup,
    markupTiers: priceRule.markupTiers,
    assignedCategories: priceRule.assignedCategories,
    assignedServices: priceRule.assignedServices,
    active: priceRule.active,
  } : {}) });
  const [sampleDuration, setSampleDuration] = useState(1);
  const [sampleMaterialCost, setSampleMaterialCost] = useState(100);
  const [samplePriority, setSamplePriority] = useState<'normal' | 'afterHours' | 'emergency'>('normal');

  useEffect(() => {
    if (isOpen) {
      setForm({ ...defaultForm, ...(priceRule ? {
        name: priceRule.name,
        description: priceRule.description,
        baseRate: priceRule.baseRate,
        afterHoursMultiplier: priceRule.afterHoursMultiplier,
        emergencyMultiplier: priceRule.emergencyMultiplier,
        weekendSurcharge: priceRule.weekendSurcharge,
        holidaySurcharge: priceRule.holidaySurcharge,
        afterHoursSurcharge: priceRule.afterHoursSurcharge,
        minimumCharge: priceRule.minimumCharge,
        travelTime: priceRule.travelTime,
        mileageRate: priceRule.mileageRate,
        materialMarkup: priceRule.materialMarkup,
        laborMarkup: priceRule.laborMarkup,
        markupTiers: priceRule.markupTiers,
        assignedCategories: priceRule.assignedCategories,
        assignedServices: priceRule.assignedServices,
        active: priceRule.active,
      } : {}) });
    }
  }, [isOpen, priceRule]);

  // Tiered markup calculation
  const getMarkupPercent = (cost: number) => {
    for (const tier of form.markupTiers) {
      if ((tier.max === null && cost >= tier.min) || (cost >= tier.min && cost < (tier.max ?? Infinity))) {
        return tier.percent;
      }
    }
    return 0;
  };

  // Calculation preview
  const calculateTotal = () => {
    let rate = form.baseRate;
    if (samplePriority === 'afterHours') rate *= form.afterHoursMultiplier;
    if (samplePriority === 'emergency') rate *= form.emergencyMultiplier;
    const markupPercent = getMarkupPercent(sampleMaterialCost);
    const materialMarkup = sampleMaterialCost * (markupPercent / 100);
    const generalMarkup = form.materialMarkup ? (sampleMaterialCost + materialMarkup) * (form.materialMarkup / 100) : 0;
    return (rate * sampleDuration) + sampleMaterialCost + materialMarkup + generalMarkup;
  };

  // Handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const input = e.target as HTMLInputElement;
      setForm(prev => ({
        ...prev,
        [name]: input.checked
      }));
    } else {
      setForm(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) || 0 : value
      }));
    }
  };

  const handleTierChange = (idx: number, field: keyof MarkupTier, value: number | null) => {
    setForm(prev => ({
      ...prev,
      markupTiers: prev.markupTiers.map((tier, i) => i === idx ? { ...tier, [field]: value } : tier)
    }));
  };

  const addTier = () => {
    setForm(prev => ({
      ...prev,
      markupTiers: [...prev.markupTiers, { min: 0, max: null, percent: 0 }]
    }));
  };

  const removeTier = (idx: number) => {
    setForm(prev => ({
      ...prev,
      markupTiers: prev.markupTiers.filter((_, i) => i !== idx)
    }));
  };

  const handleAssignCategory = (id: string) => {
    setForm(prev => ({
      ...prev,
      assignedCategories: prev.assignedCategories.includes(id)
        ? prev.assignedCategories.filter(cid => cid !== id)
        : [...prev.assignedCategories, id]
    }));
  };

  const handleAssignService = (id: string) => {
    setForm(prev => ({
      ...prev,
      assignedServices: prev.assignedServices.includes(id)
        ? prev.assignedServices.filter(sid => sid !== id)
        : [...prev.assignedServices, id]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{form.name ? 'Edit Price Rule' : 'Create Price Rule'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700">
            <X size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rule Name *</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base Hourly Rate ($/hr)</label>
              <input
                type="number"
                name="baseRate"
                value={form.baseRate}
                onChange={handleChange}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Material Markup (%)</label>
              <input
                type="number"
                name="materialMarkup"
                value={form.materialMarkup}
                onChange={handleChange}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">After Hours Multiplier</label>
              <input
                type="number"
                name="afterHoursMultiplier"
                value={form.afterHoursMultiplier}
                onChange={handleChange}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emergency Multiplier</label>
              <input
                type="number"
                name="emergencyMultiplier"
                value={form.emergencyMultiplier}
                onChange={handleChange}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200"
              />
            </div>
          </div>
          {/* Tiered Markup UI */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tiered Material Markup</label>
            <div className="space-y-2">
              {form.markupTiers.map((tier, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="number"
                    value={tier.min}
                    onChange={e => handleTierChange(idx, 'min', parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded"
                    placeholder="Min"
                  />
                  <span>to</span>
                  <input
                    type="number"
                    value={tier.max ?? ''}
                    onChange={e => handleTierChange(idx, 'max', e.target.value === '' ? null : parseFloat(e.target.value))}
                    className="w-20 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded"
                    placeholder="Max"
                  />
                  <span>$:</span>
                  <input
                    type="number"
                    value={tier.percent}
                    onChange={e => handleTierChange(idx, 'percent', parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded"
                    placeholder="%"
                  />
                  <span>%</span>
                  <button onClick={() => removeTier(idx)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                </div>
              ))}
              <button onClick={addTier} className="mt-2 px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 flex items-center"><Plus size={16} className="mr-1" /> Add Tier</button>
            </div>
          </div>
          {/* Calculation Preview */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-6 mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Calculation Preview</label>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sample Duration (hours)</label>
                <input type="number" value={sampleDuration} onChange={e => setSampleDuration(Number(e.target.value) || 0)} className="w-24 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sample Material Cost ($)</label>
                <input type="number" value={sampleMaterialCost} onChange={e => setSampleMaterialCost(Number(e.target.value) || 0)} className="w-24 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Priority</label>
                <select value={samplePriority} onChange={e => setSamplePriority(e.target.value as any)} className="w-32 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded">
                  <option value="normal">Normal</option>
                  <option value="afterHours">After Hours</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Calculator size={20} className="text-blue-600" />
                <span className="text-lg font-bold text-blue-800 dark:text-blue-200">${calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>
          {/* Assign to Categories/Services */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-6 mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assign to Categories</label>
            <CategoryTreeSelector
              categories={categories}
              selected={form.assignedCategories}
              onChange={ids => setForm(prev => ({ ...prev, assignedCategories: ids }))}
            />
            <p className="text-xs text-gray-500 mt-1">Selecting a parent category will select all its children by default. You can manually deselect any child category.</p>
          </div>
          <div className="border-t border-gray-200 dark:border-slate-700 pt-6 mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assign to Services</label>
            <ServiceMultiSelect
              services={services}
              selected={form.assignedServices}
              onChange={ids => setForm(prev => ({ ...prev, assignedServices: ids }))}
            />
            <p className="text-xs text-gray-500 mt-1">Search and select services. Selected services appear as tags below.</p>
          </div>
          <div className="flex justify-end space-x-2 mt-6">
            <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
            <button onClick={() => onSave(form)} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ServiceMultiSelect: React.FC<{
  services: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}> = ({ services, selected, onChange }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const handleCheck = (id: string, checked: boolean) => {
    if (checked) {
      onChange(Array.from(new Set([...selected, id])));
    } else {
      onChange(selected.filter(selId => selId !== id));
    }
  };

  const handleRemove = (id: string) => {
    onChange(selected.filter(selId => selId !== id));
  };

  const selectedSvcs = selected
    .map(id => services.find(s => s.id === id))
    .filter((svc): svc is { id: string; name: string } => Boolean(svc));

  const filteredServices = services.filter(svc =>
    svc.name.toLowerCase().includes(search.toLowerCase()) || selected.includes(svc.id)
  );

  return (
    <div className="relative" ref={inputRef}>
      <div
        className="flex flex-wrap items-center gap-1 min-h-[38px] border rounded px-2 py-1 bg-white dark:bg-slate-800 cursor-pointer"
        onClick={() => setDropdownOpen(v => !v)}
        tabIndex={0}
        role="button"
      >
        {selectedSvcs.length === 0 && <span className="text-gray-400">Select services...</span>}
        {selectedSvcs.map(svc => (
          <span key={svc.id} className="flex items-center bg-blue-100 text-blue-800 rounded px-2 py-0.5 text-xs mr-1 mb-1">
            {svc.name}
            <button
              type="button"
              className="ml-1 text-blue-600 hover:text-red-600"
              onClick={e => { e.stopPropagation(); handleRemove(svc.id); }}
              aria-label="Remove service"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      {dropdownOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border rounded shadow-lg max-h-72 overflow-y-auto">
          <div className="sticky top-0 bg-white dark:bg-slate-800 p-2 border-b flex items-center">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search services..."
              className="w-full bg-transparent outline-none text-sm"
              autoFocus
            />
          </div>
          <div className="p-2">
            {filteredServices.map(svc => (
              <label key={svc.id} className="flex items-center gap-2 mb-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(svc.id)}
                  onChange={e => handleCheck(svc.id, e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">{svc.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceRuleModal; 