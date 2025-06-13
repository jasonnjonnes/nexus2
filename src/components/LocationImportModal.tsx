import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

interface LocationImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  userId?: string;
  tenantId?: string;
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
  'Address': 'address',
  'Location Address': 'address',
  'Service Address': 'address',
  'Street': 'street',
  'City': 'city',
  'State': 'state',
  'Zip': 'zip',
  'Zip Code': 'zip',
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

const LocationImportModal: React.FC<LocationImportModalProps> = ({ isOpen, onClose, onComplete, userId, tenantId }) => {
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
    
    console.log('📁 Location file selected:', { 
      name: f.name, 
      size: f.size, 
      type: f.type 
    });
    
    setFile(f);
    
    try {
      const data = await f.arrayBuffer();
      const wb = XLSX.read(data);
      console.log('📋 Location workbook sheets:', wb.SheetNames);
      
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      
      console.log('📊 Location parsed data:', {
        totalRows: json.length,
        firstRow: json[0],
        headers: Object.keys(json[0] || {})
      });
      
      setRows(json as any[]);
      setHeaders(Object.keys(json[0] || {}));
      setStep('preview');
    } catch (error) {
      console.error('❌ Error parsing location file:', error);
      setErrors(prev => [...prev, `Error parsing file: ${error}`]);
    }
  };

  const handleImport = async () => {
    console.log('🚀 Starting location import process');
    console.log('📊 Location import parameters:', { 
      tenantId, 
      userId, 
      totalRows: rows.length,
      headers: headers 
    });
    
    if (!tenantId) {
      const error = 'Error: tenantId is missing. Please reload and try again.';
      console.error('❌', error);
      setErrors(prev => [...prev, error]);
      return;
    }
    
    if (!userId) {
      const error = 'Error: userId is missing. Please reload and try again.';
      console.error('❌', error);
      setErrors(prev => [...prev, error]);
      return;
    }
    
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
    
    console.log('⚙️ Location batch configuration:', {
      BATCH_SIZE,
      PARALLEL_BATCHES,
      MAX_BATCH_SIZE,
      totalBatches: Math.ceil(totalRows / (BATCH_SIZE * PARALLEL_BATCHES))
    });

    // Process rows in parallel batches
    for (let batchStart = 0; batchStart < totalRows; batchStart += BATCH_SIZE * PARALLEL_BATCHES) {
      console.log(`📦 Processing location batch group starting at row ${batchStart + 1}`);
      const batchGroupEnd = Math.min(batchStart + BATCH_SIZE * PARALLEL_BATCHES, totalRows);
      console.log(`📦 Location batch group range: ${batchStart + 1} to ${batchGroupEnd}`);
      
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
          console.log(`🔄 Starting location batch ${i + 1}/${PARALLEL_BATCHES} (rows ${currentBatchStart + 1}-${currentBatchEnd})`);
          const batch = writeBatch(db);
          const batchRows = rows.slice(currentBatchStart, currentBatchEnd);
          let batchSuccess = 0;
          let batchFail = 0;
          
          console.log(`📝 Processing ${batchRows.length} location rows in this batch`);
          
          // Process each row in the batch
          for (let rowIndex = 0; rowIndex < batchRows.length; rowIndex++) {
            const row = batchRows[rowIndex];
            const globalRowIndex = currentBatchStart + rowIndex + 1;
            try {
              console.log(`🔍 Processing location row ${globalRowIndex}:`, { 
                'Customer ID': row['Customer ID'], 
                'Location ID': row['Location ID'],
                'Full Address': row['Full Address'],
                'Type': row['Type']
              });
              
              // Require Customer ID and Location ID
              const customerId = row['Customer ID'];
              const locationId = row['Location ID'];
              
              if (!customerId || !locationId) {
                const error = `Row ${globalRowIndex}: Missing Customer ID or Location ID - Customer ID: "${customerId}", Location ID: "${locationId}"`;
                console.warn('⚠️', error);
                batchFail++;
                setErrors(prev => [...prev, error]);
                continue;
              }

              // Fetch customer using tenant-scoped collection
              const customerRef = doc(db, 'tenants', tenantId!, 'customers', customerId);
              console.log(`👤 Looking up customer ${customerId} for location ${locationId}`);
              
              const customerSnap = await getDoc(customerRef);
              if (!customerSnap.exists()) {
                const error = `Row ${globalRowIndex}: Customer not found for ID: ${customerId}`;
                console.error('❌', error);
                batchFail++;
                setErrors(prev => [...prev, error]);
                continue;
              }
              
              console.log(`✅ Customer ${customerId} found`);
              

              const customerData = customerSnap.data();
              let locations = Array.isArray(customerData.locations) ? [...customerData.locations] : [];
              console.log(`📍 Customer ${customerId} has ${locations.length} existing locations`);

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
              
              console.log(`🏠 Built location object:`, {
                id: location.id,
                address: location.address,
                type: location.type,
                phone: location.phone,
                email: location.email
              });
              

              // Smart location matching: first by ID, then by address
              let existingIdx = locations.findIndex((loc: any) => loc.id === locationId);
              let matchedLocationId = locationId;
              let isAddressMatch = false;
              
              if (existingIdx === -1) {
                console.log(`🔍 Location ID ${locationId} not found, checking for address matches...`);
                
                // Try to find location by address from the import row data
                const importAddress = location.address || location['Full Address'] || '';
                const importStreet = location.street || '';
                const importCity = location.city || '';
                const importState = location.state || '';
                const importZip = location.zip || '';
                
                // Build a composite address if we have individual components
                const compositeAddress = importAddress || 
                  [importStreet, importCity, importState, importZip].filter(Boolean).join(', ');
                
                console.log(`🏠 Looking for address match:`, {
                  fullAddress: importAddress,
                  compositeAddress: compositeAddress,
                  street: importStreet,
                  city: importCity,
                  state: importState,
                  zip: importZip
                });
                
                if (compositeAddress) {
                  // Try to match by full address (exact match)
                  existingIdx = locations.findIndex((loc: any) => {
                    const existingAddress = loc.address || '';
                    return existingAddress && 
                           existingAddress.toLowerCase().trim() === compositeAddress.toLowerCase().trim();
                  });
                  
                  if (existingIdx !== -1) {
                    console.log(`📍 Found location by exact address match at index ${existingIdx}`);
                    console.log(`🔄 Will overwrite location ID from "${locations[existingIdx].id}" to "${locationId}"`);
                    matchedLocationId = locationId; // Use the new location ID from import
                    isAddressMatch = true;
                  } else {
                    // Try partial address matching (more flexible)
                    existingIdx = locations.findIndex((loc: any) => {
                      const existingAddress = loc.address || '';
                      return existingAddress && compositeAddress &&
                             (existingAddress.toLowerCase().includes(compositeAddress.toLowerCase()) ||
                              compositeAddress.toLowerCase().includes(existingAddress.toLowerCase()));
                    });
                    
                    if (existingIdx !== -1) {
                      console.log(`📍 Found location by partial address match at index ${existingIdx}`);
                      console.log(`🔄 Will overwrite location ID from "${locations[existingIdx].id}" to "${locationId}"`);
                      matchedLocationId = locationId; // Use the new location ID from import
                      isAddressMatch = true;
                    } else {
                      // Try matching by street + city combination
                      if (importStreet && importCity) {
                        existingIdx = locations.findIndex((loc: any) => {
                          const existingStreet = loc.street || '';
                          const existingCity = loc.city || '';
                          return existingStreet && existingCity &&
                                 existingStreet.toLowerCase().includes(importStreet.toLowerCase()) &&
                                 existingCity.toLowerCase().includes(importCity.toLowerCase());
                        });
                        
                        if (existingIdx !== -1) {
                          console.log(`📍 Found location by street+city match at index ${existingIdx}`);
                          console.log(`🔄 Will overwrite location ID from "${locations[existingIdx].id}" to "${locationId}"`);
                          matchedLocationId = locationId; // Use the new location ID from import
                          isAddressMatch = true;
                        }
                      }
                    }
                  }
                }
              }
              
              if (existingIdx !== -1) {
                if (isAddressMatch) {
                  console.log(`🔄 Updating existing location at index ${existingIdx} and overwriting ID to ${locationId}`);
                  // Update the existing location with new data AND new ID
                  locations[existingIdx] = { 
                    ...locations[existingIdx], 
                    ...location,
                    id: locationId // Overwrite the location ID
                  };
                } else {
                  console.log(`🔄 Updating existing location ${locationId} at index ${existingIdx}`);
                  locations[existingIdx] = { ...locations[existingIdx], ...location };
                }
              } else {
                console.log(`➕ Adding new location ${locationId} to customer ${customerId}`);
                locations.push(location);
              }
              
              console.log(`📊 Customer ${customerId} now has ${locations.length} locations`);
              

              // Update customer document in batch
              const customerDocPath = `tenants/${tenantId}/customers/${customerId}`;
              console.log(`💾 Adding customer update to batch - Path: ${customerDocPath}`);
              
              batch.set(customerRef, { 
                ...customerData, 
                locations,
                updatedAt: new Date().toISOString()
              }, { merge: true });
              
              batchSuccess++;
              console.log(`✅ Successfully processed location row ${globalRowIndex} (Location ID: ${locationId})`);
            } catch (e) {
              const error = `Row ${globalRowIndex}: Error processing location - ${e}`;
              console.error(`❌ ${error}`);
              console.error('Row data:', row);
              batchFail++;
              setErrors(prev => [...prev, error]);
            }
          }

          // Commit the batch
          try {
            console.log(`💾 Committing location batch ${i + 1}/${PARALLEL_BATCHES} with ${batchSuccess} successful operations`);
            await batch.commit();
            console.log(`✅ Location batch ${i + 1}/${PARALLEL_BATCHES} committed successfully`);
            return { success: batchSuccess, fail: batchFail };
          } catch (e) {
            const error = `Location batch commit failed for rows ${currentBatchStart + 1}-${currentBatchEnd}: ${e}`;
            console.error(`❌ ${error}`);
            setErrors(prev => [...prev, error]);
            return { success: 0, fail: batchRows.length };
          }
        })();

        batchPromises.push(batchPromise);
      }

      // Wait for all parallel batches to complete
      console.log(`⏳ Waiting for ${batchPromises.length} parallel location batches to complete...`);
      const results = await Promise.all(batchPromises);
      console.log(`🏁 All location batches in group completed`);
      
      // Update progress
      const batchResults = results.reduce((acc, result) => ({
        success: acc.success + result.success,
        fail: acc.fail + result.fail
      }), { success: 0, fail: 0 });
      
      console.log(`📊 Location batch group results: ${batchResults.success} successful, ${batchResults.fail} failed`);
      
      success += batchResults.success;
      fail += batchResults.fail;
      const newProgress = Math.min(batchStart + BATCH_SIZE * PARALLEL_BATCHES, totalRows);
      setCurrentImportIndex(newProgress);
      
      console.log(`📈 Location overall progress: ${newProgress}/${totalRows} rows processed (${success} successful, ${fail} failed)`);
      
    }

    console.log('🎉 Location import process completed!');
    console.log(`📊 Final location results: ${success} successful, ${fail} failed out of ${totalRows} total rows`);
    
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