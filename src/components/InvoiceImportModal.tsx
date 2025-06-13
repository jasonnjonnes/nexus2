import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, doc, getDoc, setDoc, updateDoc, arrayUnion, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

interface InvoiceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  userId?: string;
  tenantId?: string;
}

const FIELD_MAP: { [key: string]: string } = {
  'Invoice #': 'invoiceNumber',
  'Job #': 'jobNumber',
  'Prevailing Wage': 'prevailingWage',
  'Job Type': 'jobType',
  'Invoice Status': 'invoiceStatus',
  'Total': 'total',
  'Balance': 'balance',
  'Invoice Date': 'invoiceDate',
  'Customer Name': 'customerName',
  'Invoice ID': 'id',
  'Job ID': 'jobId',
  'Invoice Business Unit': 'businessUnit',
  'Campaign': 'campaign',
  'Job Status': 'jobStatus',
  'Invoice Summary': 'summary',
  'Invoice Type': 'invoiceType',
  'Opportunity': 'opportunity',
  'Converted': 'converted',
  'Payment Types': 'paymentTypes',
  'Payment Term': 'paymentTerm',
  'Email Sent': 'emailSent',
  'Customer PO #': 'customerPO',
  'Subtotal': 'subtotal',
  'Payments': 'payments',
  'Created Date': 'createdAt',
  'Customer ID': 'customerId',
  'Location ID': 'locationId',
  'Invoice Item Totals': 'itemTotals',
  'Material Costs': 'materialCosts',
  'Assigned Technicians': 'assignedTechnicians',
  'Equipment Costs': 'equipmentCosts',
};

const InvoiceImportModal: React.FC<InvoiceImportModalProps> = ({ isOpen, onClose, onComplete, userId, tenantId }) => {
  console.log('🔥 InvoiceImportModal: Component rendered with props:', { isOpen, userId, tenantId });
  
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
    
    console.log('📁 Invoice file selected:', { name: f.name, size: f.size, type: f.type });
    
    setFile(f);
    
    try {
      const data = await f.arrayBuffer();
      const wb = XLSX.read(data);
      console.log('📋 Workbook sheets:', wb.SheetNames);
      
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      
      console.log('📊 Parsed invoice data:', {
        totalRows: json.length,
        firstRow: json[0],
        headers: Object.keys(json[0] || {})
      });
      
      setRows(json as any[]);
      setHeaders(Object.keys(json[0] || {}));
      setStep('preview');
    } catch (error) {
      console.error('❌ Error parsing invoice file:', error);
      setErrors(prev => [...prev, `Error parsing file: ${error}`]);
    }
  };

  const handleImport = async () => {
    if (!tenantId) {
      setErrors(prev => [...prev, 'Error: tenantId is missing. Please reload and try again.']);
      return;
    }
    
    if (!userId) {
      setErrors(prev => [...prev, 'Error: userId is missing. Please reload and try again.']);
      return;
    }
    
    console.log('🔥 Firebase: Starting invoice import with tenantId:', tenantId, 'userId:', userId);
    
    // Test Firebase connection before starting import
    try {
      const testRef = doc(db, 'tenants', tenantId, 'invoices', 'test');
      console.log('🔥 Firebase: Testing connection to path:', `tenants/${tenantId}/invoices/test`);
      await getDoc(testRef);
      console.log('✅ Firebase: Connection test successful');
    } catch (error) {
      console.error('❌ Firebase: Connection test failed:', error);
      setErrors(prev => [...prev, `Firebase connection test failed: ${error}`]);
      return;
    }
    
    setStep('importing');
    setErrors([]);
    setCurrentImportIndex(0);
    let success = 0, fail = 0;

    // Constants for optimization - balanced for speed and reliability
    const MAX_BATCH_SIZE = 200; // Increased from job import's 100 for better speed
    const PARALLEL_BATCHES = 4; // Increased from job import's 2 for better speed
    const totalRows = rows.length;

    // Calculate optimal batch size based on total rows
    const calculateBatchSize = (total: number) => {
      if (total <= 100) return Math.min(50, total); // Small batches for small imports
      if (total <= 500) return Math.min(100, total); // Medium batches for medium imports
      return Math.min(200, total); // Larger batches for large imports
    };

    const BATCH_SIZE = calculateBatchSize(totalRows);

    // Process rows in parallel batches
    for (let batchStart = 0; batchStart < totalRows; batchStart += BATCH_SIZE * PARALLEL_BATCHES) {
      console.log(`📦 Processing batch group starting at row ${batchStart + 1} of ${totalRows}`);
      
      // Create array of batch promises
      const batchPromises = [];
      
      // Create multiple batches to process in parallel
      for (let i = 0; i < PARALLEL_BATCHES && (batchStart + i * BATCH_SIZE) < totalRows; i++) {
        const currentBatchStart = batchStart + i * BATCH_SIZE;
        const currentBatchEnd = Math.min(currentBatchStart + BATCH_SIZE, totalRows);
        
        console.log(`🔄 Starting batch ${i + 1}/${PARALLEL_BATCHES} (rows ${currentBatchStart + 1}-${currentBatchEnd})`);
        
        // Add a small delay between batch starts to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, i * 25)); // Reduced from 50ms to 25ms

        // Create a promise for this batch
        const batchPromise = (async () => {
          const batch = writeBatch(db);
          const batchRows = rows.slice(currentBatchStart, currentBatchEnd);
          let batchSuccess = 0;
          let batchFail = 0;
          
          console.log(`📝 Processing ${batchRows.length} rows in this batch`);
          
          // Process each row in the batch
          for (const row of batchRows) {
            try {
              console.log(`🔍 Processing invoice row:`, row);
              
              // Require Job ID, Customer ID, and Location ID
              const jobId = row['Job ID'] || row['jobId'];
              const customerId = row['Customer ID'] || row['customerId'];
              const locationId = row['Location ID'] || row['locationId'];
              let invoiceId = row['Invoice ID'] || row['id'];
              
              console.log(`📋 Row data extracted:`, { jobId, customerId, locationId, invoiceId });
              
              if (!jobId || !customerId || !locationId) {
                console.warn(`⚠️ Missing required fields:`, { jobId, customerId, locationId });
                batchFail++;
                setErrors(prev => [...prev, `Missing Job ID, Customer ID, or Location ID in row: ${JSON.stringify(row)}`]);
                continue;
              }
              if (!invoiceId) {
                invoiceId = `invoice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              }

              // Build invoice object from row
              const invoice: any = {};
              for (const col of headers) {
                const key = FIELD_MAP[col] || col;
                let val = row[col];
                // Parse arrays
                if (['Payment Types', 'Assigned Technicians'].includes(col)) {
                  val = typeof val === 'string' ? val.split(',').map((t: string) => t.trim()).filter(Boolean) : Array.isArray(val) ? val : [];
                }
                // Parse booleans
                if (['Email Sent', 'Converted'].includes(col)) {
                  val = String(val).toLowerCase() === 'yes' || String(val) === '1' || val === true;
                }
                // Parse dates
                if (['Invoice Date', 'Created Date', 'Due Date'].includes(col)) {
                  val = val ? new Date(val).toISOString() : null;
                }
                invoice[key] = val;
              }

              // Add required fields
              invoice.id = invoiceId;
              invoice.jobId = jobId;
              invoice.customerId = customerId;
              invoice.locationId = locationId;
              invoice.userId = userId;
              invoice.updatedAt = new Date().toISOString();
              if (!invoice.createdAt) {
                invoice.createdAt = new Date().toISOString();
              }

              // Handle technician assignments
              const techNamesRaw = row['Assigned Technicians'] || '';
              const techNames = typeof techNamesRaw === 'string' ? techNamesRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
              if (techNames.length > 0) {
                invoice.assignedTechnicians = techNames.map(name => ({
                  id: `tech_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  name,
                  assignedAt: new Date().toISOString()
                }));
              }

              // Add invoice to batch using tenant-scoped collection
              const invoiceDocPath = `tenants/${tenantId}/invoices/${invoiceId}`;
              console.log(`🔥 Firebase: Adding invoice to batch - Path: ${invoiceDocPath}`);
              console.log(`📋 Invoice data:`, { 
                id: invoice.id, 
                jobId: invoice.jobId,
                customerId: invoice.customerId, 
                locationId: invoice.locationId,
                invoiceNumber: invoice.invoiceNumber,
                status: invoice.status
              });
              batch.set(doc(db, 'tenants', tenantId!, 'invoices', invoiceId), invoice, { merge: true });

              // Update customer document to include invoice reference
              const customerRef = doc(db, 'tenants', tenantId!, 'customers', customerId);
              const customerSnap = await getDoc(customerRef);
              if (customerSnap.exists()) {
                const customerData = customerSnap.data();
                let locations = Array.isArray(customerData.locations) ? [...customerData.locations] : [];
                const locIdx = locations.findIndex((loc: any) => loc.id === locationId);
                if (locIdx !== -1) {
                  const loc = { ...locations[locIdx] };
                  if (!Array.isArray(loc.invoices)) loc.invoices = [];
                  if (!loc.invoices.includes(invoiceId)) loc.invoices.push(invoiceId);
                  locations[locIdx] = loc;
                  batch.set(customerRef, { 
                    locations,
                    updatedAt: new Date().toISOString()
                  }, { merge: true });
                }
              }
              
              batchSuccess++;
            } catch (e) {
              batchFail++;
              setErrors(prev => [...prev, `Error processing row: ${JSON.stringify(row)} - ${e}`]);
            }
          }

          // Commit the batch
          try {
            console.log(`🔥 Firebase: Committing batch with ${batchSuccess} operations`);
            console.log(`🔥 Firebase: Batch contains ${batchRows.length} rows from index ${currentBatchStart} to ${currentBatchEnd - 1}`);
            
            const commitResult = await batch.commit();
            console.log(`✅ Firebase: Batch committed successfully`, commitResult);
            console.log(`✅ Firebase: Successfully processed ${batchSuccess} invoices in this batch`);
            
            return { success: batchSuccess, fail: batchFail };
          } catch (e) {
            const error = `Firebase batch commit failed: ${e}`;
            console.error(`❌ ${error}`);
            console.error(`❌ Firebase: Failed batch details:`, {
              batchStart: currentBatchStart,
              batchEnd: currentBatchEnd,
              rowCount: batchRows.length,
              successCount: batchSuccess,
              failCount: batchFail,
              tenantId: tenantId
            });
            setErrors(prev => [...prev, error]);
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
      const newProgress = Math.min(batchStart + BATCH_SIZE * PARALLEL_BATCHES, totalRows);
      setCurrentImportIndex(newProgress);
      
      // Add delay between batch groups to avoid overwhelming Firebase
      if (newProgress < totalRows) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between batch groups
      }
    }

    console.log(`🔥 Firebase: Invoice import completed - ${success} successful, ${fail} failed out of ${totalRows} total rows`);
    
    // Verify data was actually written to Firebase
    try {
      console.log('🔍 Firebase: Verifying data was written to database...');
      const invoicesRef = collection(db, 'tenants', tenantId, 'invoices');
      const snapshot = await getDocs(invoicesRef);
      console.log(`✅ Firebase: Found ${snapshot.size} total invoices in database`);
      
      if (snapshot.size === 0 && success > 0) {
        console.warn('⚠️ Firebase: No invoices found in database despite successful commits - possible permission or path issue');
        setErrors(prev => [...prev, 'Warning: Data may not have been saved to Firebase despite successful commits. Check Firebase permissions and rules.']);
      }
    } catch (error) {
      console.error('❌ Firebase: Error verifying data:', error);
      setErrors(prev => [...prev, `Error verifying data in Firebase: ${error}`]);
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
        <Dialog.Title className="text-lg font-bold mb-4">Import Invoices</Dialog.Title>
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
            <div className="text-gray-700 dark:text-gray-200">{successCount} invoices imported/updated, {failCount} failed.</div>
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

export default InvoiceImportModal; 