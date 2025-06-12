import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getFirestore, collection, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';

interface LocationImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const FIELD_MAP: { [key: string]: string } = {
  'Customer ID': 'customerId',
  'Location ID': 'id',
  'Customer Name': 'customerName',
  'Created On': 'createdAt',
  'Type': 'type',
  'Phone Number': 'phone',
  'Email': 'email',
  'Full Address': 'address',
  'Do Not Mail': 'doNotMail',
  'Do Not Service': 'doNotService',
  'Customer Tags': 'tags',
  'Customers Lifetime Revenue': 'lifetimeRevenue',
  'Lifetime Jobs Completed': 'lifetimeJobsCompleted',
  'Lifetime Invoices': 'lifetimeInvoices',
  'New or Existing': 'newOrExisting',
  'Location Tags': 'locationTags',
  'Completed Jobs': 'completedJobs',
  'Jobs Canceled': 'jobsCanceled',
  'Completed Revenue': 'completedRevenue',
  'Lifetime Jobs Booked': 'lifetimeJobsBooked',
  'Total Conversion Rate by Customer': 'conversionRate',
  'Total Sales': 'totalSales',
  'Member Status': 'memberStatus',
  'Member From': 'memberFrom',
  'Member To': 'memberTo',
  'Membership Termination Date': 'membershipTerminationDate'
};

const LocationImportModal: React.FC<LocationImportModalProps> = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [currentImportIndex, setCurrentImportIndex] = useState(0);
  const db = getFirestore();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const data = await f.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    setRows(json as any[]);
    setHeaders(Object.keys(json[0] || {}));
    setStep('preview');
  };

  const handleImport = async () => {
    setStep('importing');
    setErrors([]);
    setCurrentImportIndex(0);
    let success = 0, fail = 0;

    // Constants for optimization - increased parallel processing
    const MAX_BATCH_SIZE = 450; // Slightly reduced to account for relationship updates
    const PARALLEL_BATCHES = 10; // Increased from 5 to 10
    const totalRows = rows.length;

    // Calculate optimal batch size based on total rows
    const calculateBatchSize = (total: number) => {
      if (total <= 1000) return Math.min(MAX_BATCH_SIZE, total);
      if (total <= 5000) return Math.min(400, total);
      return Math.min(300, total); // Smaller batches for very large imports
    };

    const BATCH_SIZE = calculateBatchSize(totalRows);

    // Process rows in parallel batches
    for (let batchStart = 0; batchStart < totalRows; batchStart += BATCH_SIZE * PARALLEL_BATCHES) {
      // Create array of batch promises
      const batchPromises = [];
      
      // Create multiple batches to process in parallel
      for (let i = 0; i < PARALLEL_BATCHES && (batchStart + i * BATCH_SIZE) < totalRows; i++) {
        const currentBatchStart = batchStart + i * BATCH_SIZE;
        const currentBatchEnd = Math.min(currentBatchStart + BATCH_SIZE, totalRows);
        
        // Add a small delay between batch starts to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, i * 50));

        // Create a promise for this batch
        const batchPromise = (async () => {
          const batch = writeBatch(db);
          const batchRows = rows.slice(currentBatchStart, currentBatchEnd);
          let batchSuccess = 0;
          let batchFail = 0;
          
          // Process each row in the batch
          for (const row of batchRows) {
            try {
              // Require Customer ID and Location ID
              const customerId = row['Customer ID'];
              const locationId = row['Location ID'];
              if (!customerId || !locationId) {
                batchFail++;
                setErrors(prev => [...prev, `Missing Customer ID or Location ID in row: ${JSON.stringify(row)}`]);
                continue;
              }

              // Fetch customer
              const customerRef = doc(db, 'customers', customerId);
              const customerSnap = await getDoc(customerRef);
              if (!customerSnap.exists()) {
                batchFail++;
                setErrors(prev => [...prev, `Customer not found for ID: ${customerId}`]);
                continue;
              }

              const customerData = customerSnap.data();
              let locations = Array.isArray(customerData.locations) ? [...customerData.locations] : [];

              // Build location object from row
              const location: any = {};
              for (const col of headers) {
                const key = FIELD_MAP[col] || col;
                let val = row[col];
                if (['Customer Tags', 'Location Tags', 'tags', 'locationTags'].includes(col)) {
                  val = typeof val === 'string' ? val.split(',').map((t: string) => t.trim()).filter(Boolean) : Array.isArray(val) ? val : [];
                }
                if (['Taxable', 'Do Not Service'].includes(col)) {
                  val = String(val).toLowerCase() === 'yes' || String(val) === '1' || val === true;
                }
                location[key] = val;
              }

              // Upsert location in locations array
              const existingIdx = locations.findIndex((loc: any) => loc.id === locationId);
              if (existingIdx !== -1) {
                locations[existingIdx] = { ...locations[existingIdx], ...location };
              } else {
                locations.push(location);
              }

              // Update customer document in batch
              batch.set(customerRef, { 
                ...customerData, 
                locations,
                updatedAt: new Date().toISOString()
              }, { merge: true });
              
              batchSuccess++;
            } catch (e) {
              batchFail++;
              setErrors(prev => [...prev, `Error processing row: ${JSON.stringify(row)} - ${e}`]);
            }
          }

          // Commit the batch
          try {
            await batch.commit();
            return { success: batchSuccess, fail: batchFail };
          } catch (e) {
            setErrors(prev => [...prev, `Batch commit failed for rows ${currentBatchStart + 1}-${currentBatchEnd}: ${e}`]);
            return { success: 0, fail: batchRows.length };
          }
        })();

        batchPromises.push(batchPromise);
      }

      // Wait for all parallel batches to complete
      const results = await Promise.all(batchPromises);
      
      // Update progress
      const batchResults = results.reduce((acc, result) => ({
        success: acc.success + result.success,
        fail: acc.fail + result.fail
      }), { success: 0, fail: 0 });
      
      success += batchResults.success;
      fail += batchResults.fail;
      setCurrentImportIndex(Math.min(batchStart + BATCH_SIZE * PARALLEL_BATCHES, totalRows));
    }

    setSuccessCount(success);
    setFailCount(fail);
    setStep('done');
    if (onComplete) onComplete();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" />
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl z-10 relative">
        <button onClick={onClose} className="absolute top-2 right-2 p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"><X size={18} /></button>
        <Dialog.Title className="text-lg font-bold mb-4">Import Locations</Dialog.Title>
        {step === 'upload' && (
          <div>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="mb-4" />
          </div>
        )}
        {step === 'preview' && (
          <div>
            <div className="mb-4 max-h-64 overflow-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    {headers.map(h => <th key={h} className="px-2 py-1 text-left font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t">
                      {headers.map((h, j) => <td key={j} className="px-2 py-1">{String(row[h])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && <div className="text-xs text-gray-500 mt-2">Showing first 10 rows of {rows.length} total</div>}
            </div>
            <button onClick={handleImport} className="px-4 py-2 bg-blue-600 text-white rounded">Import</button>
            <button onClick={onClose} className="ml-2 px-4 py-2 border rounded">Cancel</button>
          </div>
        )}
        {step === 'importing' && (
          <div className="text-center py-8 text-gray-600 dark:text-gray-300">
            Importing {currentImportIndex} of {rows.length}...
          </div>
        )}
        {step === 'done' && (
          <div className="text-center py-8">
            <div className="text-green-600 dark:text-green-400 font-bold mb-2">Import Complete</div>
            <div className="text-gray-700 dark:text-gray-200">{successCount} locations imported/updated, {failCount} failed.</div>
            {errors.length > 0 && (
              <div className="text-left mt-4 max-h-40 overflow-auto border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 rounded p-2 text-xs text-red-700 dark:text-red-300">
                <div className="font-bold mb-1">Import Log:</div>
                {errors.map((err, i) => <div key={i}>{err}</div>)}
              </div>
            )}
            <button onClick={onClose} className="mt-4 px-4 py-2 border rounded">Close</button>
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default LocationImportModal; 