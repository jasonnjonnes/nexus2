import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, doc, getDoc, setDoc, updateDoc, arrayUnion, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

interface JobImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  userId?: string;
  tenantId?: string;
}

const FIELD_MAP: { [key: string]: string } = {
  'Job #': 'jobNumber',
  'Job Type': 'jobType',
  'Prevailing Wage': 'prevailingWage',
  'Job Campaign': 'jobCampaign',
  'Campaign Category': 'campaignCategory',
  'Business Unit': 'businessUnit',
  'Invoice #': 'invoiceNumber',
  'Jobs Total': 'totalAmount',
  'Completion Date': 'completionDate',
  'Status': 'status',
  'Summary': 'summary',
  'Recall': 'recall',
  'Scheduled Date': 'startDate',
  'Assigned Technicians': 'technician',
  'Job ID': 'id',
  'Paused': 'paused',
  'Jobs Subtotal': 'jobsSubtotal',
  'Jobs Payments': 'jobsPayments',
  'Created Date': 'createdAt',
  'Scheduled Time': 'startTime',
  'Hold Date': 'holdDate',
  'Invoice Date': 'invoiceDate',
  'Total Appointments': 'totalAppointments',
  'Customer ID': 'customerId',
  'Location ID': 'locationId',
  'Tags': 'tags',
  'Customer Tags': 'customerTags',
  'Location Tags': 'locationTags',
  'Material Costs': 'materialCosts',
  'Equipment Costs': 'equipmentCosts',
  'Actual Costs': 'actualCosts',
  // Address field mappings
  'Service Address': 'serviceAddress',
  'Address': 'address',
  'Location Address': 'locationAddress',
  'Service Street': 'serviceStreet',
  'Street': 'street',
  'Service City': 'serviceCity',
  'City': 'city',
  'Service State': 'serviceState',
  'State': 'state',
  'Service Zip': 'serviceZip',
  'Zip': 'zip',
  'Service Zip Code': 'serviceZip',
  'Zip Code': 'zip',
  // Add more mappings as needed
};

const JobImportModal: React.FC<JobImportModalProps> = ({ isOpen, onClose, onComplete, userId, tenantId }) => {
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
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      
      setRows(json as any[]);
      setHeaders(Object.keys(json[0] || {}));
      setStep('preview');
    } catch (error) {
      console.error('❌ Error parsing file:', error);
      setErrors(prev => [...prev, `Error parsing file: ${error}`]);
    }
  };

  const handleImport = async () => {
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

    // Constants for optimization - REDUCED to avoid Firebase write limits
    const MAX_BATCH_SIZE = 100; // Significantly reduced from 450
    const PARALLEL_BATCHES = 2; // Reduced from 10 to 2
    const totalRows = rows.length;

    // Calculate optimal batch size based on total rows - more conservative
    const calculateBatchSize = (total: number) => {
      if (total <= 100) return Math.min(20, total); // Very small batches for small imports
      if (total <= 500) return Math.min(50, total); // Small batches for medium imports
      return Math.min(100, total); // Larger batches only for very large imports
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
        
        // Add a longer delay between batch starts to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, i * 200)); // Increased from 50ms to 200ms

        // Create a promise for this batch
        const batchPromise = (async () => {
          const batch = writeBatch(db);
          const batchRows = rows.slice(currentBatchStart, currentBatchEnd);
          let batchSuccess = 0;
          let batchFail = 0;
          
          // Process each row in the batch
          for (let rowIndex = 0; rowIndex < batchRows.length; rowIndex++) {
            const row = batchRows[rowIndex];
            const globalRowIndex = currentBatchStart + rowIndex + 1;
            
            try {
              // Require Customer ID, Location ID, and Job ID
              const customerId = row['Customer ID'];
              const locationId = row['Location ID'];
              let jobId = row['Job ID'] || row['id'];
              
              if (!customerId || !locationId) {
                const error = `Row ${globalRowIndex}: Missing Customer ID or Location ID - Customer ID: "${customerId}", Location ID: "${locationId}"`;
                batchFail++;
                setErrors(prev => [...prev, error]);
                continue;
              }
              
              if (!jobId) {
                jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              }

              // Build job object from row
              const job: any = {};
              for (const col of headers) {
                const key = FIELD_MAP[col] || col;
                let val = row[col];
                // Parse arrays
                if (['Tags', 'Customer Tags', 'Location Tags', 'tags', 'customerTags', 'locationTags'].includes(col)) {
                  val = typeof val === 'string' ? val.split(',').map((t: string) => t.trim()).filter(Boolean) : Array.isArray(val) ? val : [];
                }
                // Parse booleans
                if (['Paused', 'Recall'].includes(col)) {
                  val = String(val).toLowerCase() === 'yes' || String(val) === '1' || val === true;
                }
                job[key] = val;
              }

              // Add required fields
              job.id = jobId;
              job.customerId = customerId;
              job.locationId = locationId;
              job.updatedAt = new Date().toISOString();
              // Handle technician assignments
              let assignedTechs: Array<{id: string, name: string, assignedAt: string}> = [];
              const techNamesRaw = row['Assigned Technicians'] || row['technician'] || '';
              const techNames = typeof techNamesRaw === 'string' ? techNamesRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
              if (techNames.length > 0) {
                assignedTechs = techNames.map(name => ({
                  id: `tech_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  name,
                  assignedAt: new Date().toISOString()
                }));
              }
              job.assignedTechnicians = assignedTechs;

              // Add job to batch using tenant-scoped collection
              const jobDocPath = `tenants/${tenantId}/jobs/${jobId}`;
              console.log(`🔥 Firebase: Adding job to batch - Path: ${jobDocPath}`);
              console.log(`📋 Job data:`, { 
                id: job.id, 
                customerId: job.customerId, 
                locationId: job.locationId,
                jobNumber: job.jobNumber,
                jobType: job.jobType,
                status: job.status,
                totalAmount: job.totalAmount
              });
              batch.set(doc(db, 'tenants', tenantId!, 'jobs', jobId), job, { merge: true });

              // Update customer document to include job reference
              const customerRef = doc(db, 'tenants', tenantId!, 'customers', customerId);
              
              const customerSnap = await getDoc(customerRef);
              if (customerSnap.exists()) {
                const customerData = customerSnap.data();
                let locations = Array.isArray(customerData.locations) ? [...customerData.locations] : [];
                
                // First try to find by exact location ID
                let locIdx = locations.findIndex((loc: any) => loc.id === locationId);
                let matchedLocationId = locationId;
                
                if (locIdx === -1) {
                  // Try to find location by address from the job row data
                  const jobAddress = row['Service Address'] || row['Address'] || row['Location Address'] || '';
                  const jobStreet = row['Service Street'] || row['Street'] || '';
                  const jobCity = row['Service City'] || row['City'] || '';
                  const jobState = row['Service State'] || row['State'] || '';
                  const jobZip = row['Service Zip'] || row['Zip'] || '';
                  
                  if (jobAddress || (jobStreet && jobCity)) {
                    // Try to match by full address first
                    if (jobAddress) {
                      locIdx = locations.findIndex((loc: any) => 
                        loc.address && loc.address.toLowerCase().includes(jobAddress.toLowerCase())
                      );
                      if (locIdx !== -1) {
                        matchedLocationId = locations[locIdx].id;
                      }
                    }
                    
                    // If no full address match, try street + city combination
                    if (locIdx === -1 && jobStreet && jobCity) {
                      locIdx = locations.findIndex((loc: any) => {
                        const locStreet = loc.street || '';
                        const locCity = loc.city || '';
                        return locStreet.toLowerCase().includes(jobStreet.toLowerCase()) && 
                               locCity.toLowerCase().includes(jobCity.toLowerCase());
                      });
                      if (locIdx !== -1) {
                        matchedLocationId = locations[locIdx].id;
                      }
                    }
                    
                    // If still no match, create a new location
                    if (locIdx === -1) {
                      const newLocation = {
                        id: locationId, // Use the original location ID from import
                        name: `Location ${locations.length + 1}`,
                        address: jobAddress || `${jobStreet}, ${jobCity}, ${jobState} ${jobZip}`.trim(),
                        street: jobStreet,
                        city: jobCity,
                        state: jobState,
                        zip: jobZip,
                        type: 'service',
                        isPrimary: locations.length === 0, // Make primary if it's the first location
                        jobs: []
                      };
                      locations.push(newLocation);
                      locIdx = locations.length - 1;
                      matchedLocationId = locationId;
                    } else {
                      // Update the job's locationId to match the found location
                      job.locationId = matchedLocationId;
                    }
                  }
                }
                
                if (locIdx !== -1) {
                  const loc = { ...locations[locIdx] };
                  if (!Array.isArray(loc.jobs)) loc.jobs = [];
                  if (!loc.jobs.includes(jobId)) {
                    loc.jobs.push(jobId);
                  }
                  locations[locIdx] = loc;
                  batch.set(customerRef, { 
                    locations,
                    updatedAt: new Date().toISOString()
                  }, { merge: true });
                } else {
                  // Fallback: assign job directly to customer instead of a specific location
                  job.locationId = customerId; // Use customer ID as location fallback
                  job.assignedToCustomer = true; // Flag to indicate this is a customer-level assignment
                  
                  // Still update the customer document to track this job
                  batch.set(customerRef, { 
                    ...customerData,
                    // Add job to a general jobs array at customer level
                    jobs: Array.isArray(customerData.jobs) ? 
                      [...customerData.jobs, jobId] : [jobId],
                    updatedAt: new Date().toISOString()
                  }, { merge: true });
                }
              } else {
                // Fallback: assign job directly to customer ID even if customer doesn't exist yet
                job.locationId = customerId; // Use customer ID as location fallback
                job.assignedToCustomer = true; // Flag to indicate this is a customer-level assignment
                job.customerNotFound = true; // Flag to indicate customer wasn't found during import
              }
              
              batchSuccess++;
              
              // Add small delay between rows to reduce Firebase write pressure
              if (rowIndex < batchRows.length - 1) { // Don't delay after the last row
                await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay between rows
              }
            } catch (e) {
              const error = `Row ${globalRowIndex}: Error processing - ${e}`;
              console.error(`❌ ${error}`);
              batchFail++;
              setErrors(prev => [...prev, error]);
            }
          }

          // Commit the batch
          try {
            console.log(`🔥 Firebase: Committing batch with ${batchSuccess} operations`);
            console.log(`🔥 Firebase: Batch contains ${batchRows.length} rows from index ${currentBatchStart} to ${currentBatchEnd - 1}`);
            
            const commitResult = await batch.commit();
            console.log(`✅ Firebase: Batch committed successfully`, commitResult);
            console.log(`✅ Firebase: Successfully processed ${batchSuccess} jobs in this batch`);
            
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
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between batch groups
      }
    }

    console.log(`🔥 Firebase: Job import completed - ${success} successful, ${fail} failed out of ${totalRows} total rows`);
    
    // Verify data was actually written to Firebase
    try {
      console.log('🔍 Firebase: Verifying data was written to database...');
      const jobsRef = collection(db, 'tenants', tenantId, 'jobs');
      const snapshot = await getDocs(jobsRef);
      console.log(`✅ Firebase: Found ${snapshot.size} total jobs in database`);
      
      if (snapshot.size === 0 && success > 0) {
        console.warn('⚠️ Firebase: No jobs found in database despite successful commits - possible permission or path issue');
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
        <Dialog.Title className="text-lg font-bold mb-4">Import Jobs</Dialog.Title>
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
            <div className="text-gray-700 dark:text-gray-200">{successCount} jobs imported/updated, {failCount} failed.</div>
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

export default JobImportModal;