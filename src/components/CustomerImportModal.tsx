import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

interface CustomerImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  userId?: string;
  tenantId?: string;
  pauseListener?: () => void;
}

const FIELD_MAP: { [key: string]: string } = {
  'Customer ID': 'id',
  'Customer Name': 'name',
  'Created On': 'createdAt',
  'Type': 'type',
  'Phone Number': 'phone',
  'Email': 'email',
  'Full Address': 'billingAddress',
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

const CustomerImportModal: React.FC<CustomerImportModalProps> = ({ isOpen, onClose, onComplete, userId, tenantId, pauseListener }) => {
  console.log('CustomerImportModal props:', { userId, tenantId, isOpen });
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [currentImportIndex, setCurrentImportIndex] = useState(0);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    try {
      const data = await f.arrayBuffer();
      const wb = XLSX.read(data, { 
        type: 'array',
        raw: false  // Convert numbers and dates to strings
      });
      
      // Get the first sheet
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) {
        throw new Error('No worksheet found in the file');
      }

      // Convert to JSON with safe defaults
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { 
        raw: false,
        dateNF: 'yyyy-mm-dd' // Format dates consistently
      });

      if (!Array.isArray(json) || json.length === 0) {
        throw new Error('No data found in the worksheet');
      }

      // Clean and validate the data
      const cleanedRows = json.map(row => {
        const cleanedRow: Record<string, string> = {};
        Object.keys(row).forEach(key => {
          // Convert all values to strings, handle null/undefined
          const val = row[key];
          cleanedRow[key] = val == null ? '' : String(val).trim();
        });
        return cleanedRow;
      });

      setRows(cleanedRows);
      setHeaders(Object.keys(cleanedRows[0] || {}));
      setStep('preview');
    } catch (error: any) {
      console.error('Error reading file:', error);
      setErrors([`Error reading file: ${error?.message || 'Unknown error'}`]);
      setStep('upload');
    }
  };

  const handleImport = async () => {
    if (!tenantId) {
      setErrors(prev => [...prev, 'Error: tenantId is missing. Please reload and try again.']);
      return;
    }
    if (pauseListener) pauseListener();
    setStep('importing');
    setErrors([]);
    setCurrentImportIndex(0);
    let success = 0, fail = 0;
    let lastId: string | null = null;
    let lastCustomer: any = null;

    console.log('Starting import with rows:', rows.length);
    console.log('First row sample:', rows[0]);

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
        
        console.log(`Processing batch ${i + 1}, rows ${currentBatchStart + 1} to ${currentBatchEnd}`);

        // Create a promise for this batch
        const batchPromise = (async () => {
          const batch = writeBatch(db);
          const batchRows = rows.slice(currentBatchStart, currentBatchEnd);
          let batchSuccess = 0;
          let batchFail = 0;
          
          // Process each row in the batch
          for (const row of batchRows) {
            try {
              console.log('Processing row:', row['Customer Name']);
              
              if (!row['Customer Name']) { 
                console.log('Skipping row - no customer name');
                batchFail++; 
                continue; 
              }

              const customer = {};
              console.log('Starting to process fields for customer:', row['Customer Name']);
              
              // Process headers and build customer object
              for (const col of headers) {
                try {
                  console.log(`Processing field ${col} for ${row['Customer Name']}`);
                  const key = FIELD_MAP[col] || col;
                  let val = row[col];

                  // Skip processing if value is null/undefined
                  if (val == null) {
                    console.log(`Field ${col} is null/undefined, setting to empty string`);
                    (customer as any)[key] = '';
                    continue;
                  }

                  // Convert to string and trim
                  val = String(val).trim();
                  console.log(`Field ${col} value after trim:`, val);
                  
                  // Handle special fields
                  if (['Customer Tags', 'Location Tags', 'tags', 'locationTags'].includes(col)) {
                    console.log(`Processing tags for ${col}`);
                    (customer as any)[key] = val ? val.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
                    continue;
                  }

                  // Handle boolean fields
                  if (['Taxable', 'Do Not Service'].includes(col)) {
                    console.log(`Processing boolean for ${col}:`, val);
                    (customer as any)[key] = ['true', 'yes', '1', 'TRUE'].includes(val.toLowerCase());
                    continue;
                  }

                  // Handle numeric fields
                  if (['Completed Jobs', 'Completed Revenue', 'Jobs Canceled', 'Lifetime Jobs Completed', 
                       'Lifetime Invoices', 'Total Sales', 'Customers Lifetime Revenue', 'Lifetime Jobs Booked',
                       'Total Conversion Rate by Customer'].includes(col)) {
                    console.log(`Processing numeric for ${col}:`, val);
                    // Remove currency symbols and convert to number
                    const numVal = parseFloat(val.replace(/[^0-9.-]+/g, ''));
                    (customer as any)[key] = isNaN(numVal) ? 0 : numVal;
                    continue;
                  }

                  // Handle date fields
                  if (['Created On', 'Member From', 'Member To', 'Membership Termination Date'].includes(col)) {
                    console.log(`Processing date for ${col}:`, val);
                    try {
                      const date = new Date(val);
                      (customer as any)[key] = isNaN(date.getTime()) ? '' : date.toISOString();
                    } catch (dateError) {
                      console.error(`Error processing date for ${col}:`, dateError);
                      (customer as any)[key] = '';
                    }
                    continue;
                  }
                  
                  // Handle multiple phones/emails
                  if (col === 'Phone Number') {
                    console.log(`Processing phone for ${row['Customer Name']}:`, val);
                    const phones = val ? val.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
                    (customer as any).phone = phones[0] || '';
                    if (phones.length > 1) (customer as any).otherPhones = phones.slice(1);
                    continue;
                  }
                  if (col === 'Email') {
                    console.log(`Processing email for ${row['Customer Name']}:`, val);
                    const emails = val ? val.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
                    (customer as any).email = emails[0] || '';
                    if (emails.length > 1) (customer as any).otherEmails = emails.slice(1);
                    continue;
                  }

                  // Default case: store as string
                  (customer as any)[key] = val;
                } catch (fieldError) {
                  console.error(`Error processing field ${col} for ${row['Customer Name']}:`, fieldError);
                  console.error('Field value was:', row[col]);
                  // Continue processing other fields even if one fails
                  (customer as any)[FIELD_MAP[col] || col] = '';
                }
              }

              console.log('Finished processing fields for:', row['Customer Name']);
              console.log('Processed customer object:', customer);

              // Add locations array if missing
              if ((customer as any).billingAddress && !Array.isArray((customer as any).locations)) {
                console.log('Adding location for:', row['Customer Name']);
                (customer as any).locations = [{
                  id: `loc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  name: 'Primary Location',
                  address: (customer as any).billingAddress,
                  isPrimary: true,
                  phone: (customer as any).phone || '',
                }];
              }

              // Helper to clean Firestore IDs (no slashes, non-empty)
              const cleanId = (raw: any): string => {
                if (typeof raw !== 'string' || !raw.trim()) return '';
                return raw.trim().replace(/\//g, '_');
              };

              const providedId = cleanId((customer as any).id);
              console.log('Cleaned ID for', row['Customer Name'], ':', providedId);
              
              if (!providedId) {
                throw new Error('Invalid or missing Customer ID');
              }

              const id = providedId;
              lastId = id;
              lastCustomer = customer;
              
              // Add to batch
              console.log('About to add to batch:', {
                tenantId,
                id,
                db,
                customer
              });
              batch.set(doc(db, 'tenants', tenantId!, 'customers', id), { 
                ...customer, 
                id, 
                ...(userId ? { userId } : {}),
                updatedAt: new Date().toISOString()
              }, { merge: true });
              
              batchSuccess++;
              console.log('Successfully processed:', row['Customer Name']);
            } catch (e) {
              console.error('Error processing row:', row['Customer Name']);
              console.error('Full error:', e);
              console.error('Row data:', row);
              batchFail++;
              setErrors((prev) => [...prev, `Error processing row: ${JSON.stringify(row)} - ${e}`]);
            }
          }

          // Commit the batch
          try {
            console.log(`Committing batch with ${batchSuccess} successes and ${batchFail} failures`);
            await batch.commit();
            return { success: batchSuccess, fail: batchFail };
          } catch (e) {
            console.error('Batch commit failed:', e);
            let errorMsg = `Batch commit failed for rows ${currentBatchStart + 1}-${currentBatchEnd}: `;
            if (e && typeof e === 'object') {
              errorMsg += `\n  code: ${(e as any).code || ''}`;
              errorMsg += `\n  message: ${(e as any).message || e}`;
              if ((e as any).stack) errorMsg += `\n  stack: ${(e as any).stack}`;
            } else {
              errorMsg += String(e);
            }
            setErrors((prev) => [...prev, errorMsg]);
            return { success: 0, fail: batchRows.length };
          }
        })();

        batchPromises.push(batchPromise);
      }

      // Wait for all parallel batches to complete
      const results = await Promise.all(batchPromises);
      console.log('Batch results:', results);
      
      // Update progress
      const batchResults = results.reduce((acc, result) => ({
        success: acc.success + result.success,
        fail: acc.fail + result.fail
      }), { success: 0, fail: 0 });
      
      success += batchResults.success;
      fail += batchResults.fail;
      setCurrentImportIndex(Math.min(batchStart + BATCH_SIZE * PARALLEL_BATCHES, totalRows));
    }

    console.log('Import complete. Success:', success, 'Fail:', fail);
    setSuccessCount(success);
    setFailCount(fail);
    // Log summary and last used tenantId/id/db/customer at the end for easier debugging
    console.log('IMPORT SUMMARY:', {
      tenantId,
      lastId,
      db,
      lastCustomer,
      totalRows: rows.length,
      success,
      fail
    });
    setStep('done');
    if (onComplete) onComplete();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" />
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl z-10 relative">
        <button onClick={onClose} className="absolute top-2 right-2 p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"><X size={18} /></button>
        <Dialog.Title className="text-lg font-bold mb-4">Import Customers</Dialog.Title>
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
            {(!tenantId || !userId) && (
              <div className="mb-2 text-red-600 dark:text-red-400 font-semibold">
                Error: User or tenant not ready yet. Please wait, then try again.
              </div>
            )}
            <button onClick={handleImport} className="px-4 py-2 bg-blue-600 text-white rounded" disabled={!tenantId || !userId}>Import</button>
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
            <div className="text-gray-700 dark:text-gray-200">{successCount} customers imported, {failCount} failed.</div>
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

export default CustomerImportModal; 