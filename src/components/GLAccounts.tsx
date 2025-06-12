import React, { useEffect, useState } from 'react';
import { collection, getFirestore, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Plus, Edit, Trash2, X, Check, MoreHorizontal } from 'lucide-react';
import { GLAccount } from '../types/pricebook';
import { Menu } from '@headlessui/react';

const STANDARD_ACCOUNTS: Omit<GLAccount, 'id' | 'active' | 'createdAt' | 'updatedAt'>[] = [
  { accountNumber: '1-001', accountName: 'Cash', type: 'Asset', subtype: '', description: 'Cash', },
  { accountNumber: '1-010', accountName: 'Accounts Receivable', type: 'Asset', subtype: '', description: 'Accounts Receivable', },
  { accountNumber: '1-020', accountName: 'Prepaid Expenses', type: 'Asset', subtype: '', description: 'Prepaid Expenses', },
  { accountNumber: '1-030', accountName: 'Inventory', type: 'Asset', subtype: '', description: 'Inventory', },
  { accountNumber: '1-040', accountName: 'Fixed Assets', type: 'Asset', subtype: '', description: 'Fixed Assets', },
  { accountNumber: '1-050', accountName: 'Accumulated Depreciation', type: 'Asset', subtype: '', description: 'Accumulated Depreciation', },
  { accountNumber: '1-060', accountName: 'Other Assets', type: 'Asset', subtype: '', description: 'Other Assets', },
  { accountNumber: '2-001', accountName: 'Accounts Payable', type: 'Liability', subtype: '', description: 'Accounts Payable', },
  { accountNumber: '2-010', accountName: 'Accrued Liabilities', type: 'Liability', subtype: '', description: 'Accrued Liabilities', },
  { accountNumber: '2-020', accountName: 'Taxes Payable', type: 'Liability', subtype: '', description: 'Taxes Payable', },
  { accountNumber: '2-030', accountName: 'Payroll Payable', type: 'Liability', subtype: '', description: 'Payroll Payable', },
  { accountNumber: '2-040', accountName: 'Notes Payable', type: 'Liability', subtype: '', description: 'Notes Payable', },
  { accountNumber: '3-001', accountName: 'Common Stock', type: 'Equity', subtype: '', description: 'Common Stock', },
  { accountNumber: '3-010', accountName: 'Retained Earnings', type: 'Equity', subtype: '', description: 'Retained Earnings', },
  { accountNumber: '3-020', accountName: 'Additional Paid in Capital', type: 'Equity', subtype: '', description: 'Additional Paid in Capital', },
  { accountNumber: '4-001', accountName: 'Revenue', type: 'Revenue', subtype: '', description: 'Revenue', },
  { accountNumber: '4-010', accountName: 'Sales returns and allowances', type: 'Revenue', subtype: '', description: 'Sales returns and allowances', },
  { accountNumber: '5-001', accountName: 'Cost of Goods Sold', type: 'Expense', subtype: '', description: 'Cost of Goods Sold', },
  { accountNumber: '5-010', accountName: 'Advertising Expense', type: 'Expense', subtype: '', description: 'Advertising Expense', },
  { accountNumber: '5-020', accountName: 'Bank Fees', type: 'Expense', subtype: '', description: 'Bank Fees', },
  { accountNumber: '5-030', accountName: 'Depreciation Expense', type: 'Expense', subtype: '', description: 'Depreciation Expense', },
  { accountNumber: '5-040', accountName: 'Payroll Tax Expense', type: 'Expense', subtype: '', description: 'Payroll Tax Expense', },
  { accountNumber: '5-050', accountName: 'Rent Expense', type: 'Expense', subtype: '', description: 'Rent Expense', },
  { accountNumber: '5-060', accountName: 'Supplies Expense', type: 'Expense', subtype: '', description: 'Supplies Expense', },
  { accountNumber: '5-070', accountName: 'Utilities Expense', type: 'Expense', subtype: '', description: 'Utilities Expense', },
  { accountNumber: '5-080', accountName: 'Wages Expense', type: 'Expense', subtype: '', description: 'Wages Expense', },
  { accountNumber: '6-001', accountName: 'Other Expenses', type: 'Other', subtype: '', description: 'Other Expenses', },
];

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense', 'Other'];

const GLAccounts: React.FC = () => {
  const db = getFirestore();
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<GLAccount | null>(null);
  const [form, setForm] = useState<Omit<GLAccount, 'id' | 'createdAt' | 'updatedAt'>>({
    accountNumber: '',
    accountName: '',
    type: 'Asset',
    subtype: '',
    description: '',
    active: true,
  });
  const [loading, setLoading] = useState(false);

  // Load accounts and pre-populate if empty
  useEffect(() => {
    const ref = collection(db, 'glAccounts');
    const unsub = onSnapshot(ref, snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GLAccount[];
      setAccounts(data);
      if (data.length === 0) {
        // Pre-populate
        const batch = writeBatch(db);
        STANDARD_ACCOUNTS.forEach(acc => {
          const docRef = doc(ref);
          batch.set(docRef, {
            ...acc,
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
        batch.commit();
      }
    });
    return () => unsub();
  }, [db]);

  // Modal open for add/edit
  const openModal = (acc?: GLAccount) => {
    if (acc) {
      setEditing(acc);
      setForm({
        accountNumber: acc.accountNumber,
        accountName: acc.accountName,
        type: acc.type,
        subtype: acc.subtype,
        description: acc.description,
        active: acc.active,
      });
    } else {
      setEditing(null);
      setForm({
        accountNumber: '',
        accountName: '',
        type: 'Asset',
        subtype: '',
        description: '',
        active: true,
      });
    }
    setShowModal(true);
  };

  // Save (add or update)
  const handleSave = async () => {
    setLoading(true);
    try {
      if (editing) {
        // Update
        await updateDoc(doc(db, 'glAccounts', editing.id), {
          ...form,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Add
        await addDoc(collection(db, 'glAccounts'), {
          ...form,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setShowModal(false);
    } finally {
      setLoading(false);
    }
  };

  // Bulk activate/deactivate
  const handleBulkStatus = async (active: boolean) => {
    const batch = writeBatch(db);
    selectedIds.forEach(id => {
      batch.update(doc(db, 'glAccounts', id), { active, updatedAt: serverTimestamp() });
    });
    await batch.commit();
    setSelectedIds([]);
    setSelectAll(false);
  };

  // Row select
  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id));
  };
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setSelectedIds(checked ? accounts.map(a => a.id) : []);
  };

  const anyActive = accounts.some(acc => selectedIds.includes(acc.id) && acc.active);
  const anyInactive = accounts.some(acc => selectedIds.includes(acc.id) && !acc.active);
  const canMerge = selectedIds.length >= 2;

  // Render
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">General Ledger Accounts</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center" onClick={() => openModal()}>
          <Plus size={16} className="mr-2" /> Add New Account
        </button>
      </div>
      <div className="mb-2 flex items-center gap-2">
        <Menu as="div" className="relative inline-block text-left">
          <Menu.Button
            className={`px-4 py-2 rounded bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 font-medium border border-gray-300 dark:border-slate-600 focus:outline-none ${selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300 dark:hover:bg-slate-600'}`}
            disabled={selectedIds.length === 0}
          >
            Actions
          </Menu.Button>
          <Menu.Items className="absolute left-0 mt-2 w-48 origin-top-left bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg z-10 focus:outline-none">
            <Menu.Item disabled={!anyInactive}>
              {({ active, disabled }) => (
                <button
                  className={`w-full text-left px-4 py-2 ${disabled ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-slate-700'} text-sm`}
                  disabled={disabled}
                  onClick={() => handleBulkStatus(true)}
                >
                  Activate Accounts
                </button>
              )}
            </Menu.Item>
            <Menu.Item disabled={!anyActive}>
              {({ active, disabled }) => (
                <button
                  className={`w-full text-left px-4 py-2 ${disabled ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-slate-700'} text-sm`}
                  disabled={disabled}
                  onClick={() => handleBulkStatus(false)}
                >
                  Deactivate Accounts
                </button>
              )}
            </Menu.Item>
            <Menu.Item disabled={!canMerge}>
              {({ active, disabled }) => (
                <button
                  className={`w-full text-left px-4 py-2 ${disabled ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-slate-700'} text-sm`}
                  disabled={disabled}
                  onClick={() => alert('Merge Accounts (coming soon)')}
                >
                  Merge Accounts
                </button>
              )}
            </Menu.Item>
          </Menu.Items>
        </Menu>
        <span className="ml-2 text-gray-500 text-sm">{selectedIds.length} selected</span>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-2"><input type="checkbox" checked={selectAll} onChange={e => handleSelectAll(e.target.checked)} /></th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account #</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subtype</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {accounts.map(acc => (
              <tr key={acc.id} className={!acc.active ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                <td className="px-4 py-2"><input type="checkbox" checked={selectedIds.includes(acc.id)} onChange={e => handleSelect(acc.id, e.target.checked)} /></td>
                <td className="px-4 py-2 font-mono">{acc.accountNumber}</td>
                <td className="px-4 py-2">{acc.accountName}</td>
                <td className="px-4 py-2">{acc.type}</td>
                <td className="px-4 py-2">{acc.subtype}</td>
                <td className="px-4 py-2">{acc.description}</td>
                <td className="px-4 py-2">
                  {acc.active ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Inactive</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <button className="text-blue-600 hover:underline mr-2" onClick={() => openModal(acc)}><Edit size={16} /></button>
                  <button className="text-gray-600 hover:underline" onClick={() => handleBulkStatus(!acc.active)}>{acc.active ? 'Deactivate' : 'Activate'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editing ? 'Edit GL Account' : 'Add GL Account'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">GL Account Number *</label>
                <input type="text" className="w-full rounded border px-3 py-2" value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">GL Account Name *</label>
                <input type="text" className="w-full rounded border px-3 py-2" value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type *</label>
                <select className="w-full rounded border px-3 py-2" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as GLAccount['type'] }))}>
                  {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sub-type</label>
                <input type="text" className="w-full rounded border px-3 py-2" value={form.subtype} onChange={e => setForm(f => ({ ...f, subtype: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="w-full rounded border px-3 py-2" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GLAccounts; 