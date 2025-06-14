import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, doc, getDoc, setDoc, updateDoc, arrayUnion, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { processImportedBusinessUnitsAndJobTypes } from '../utils/businessUnitsJobTypes';

interface EstimateImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  userId?: string;
  tenantId?: string;
}

const FIELD_MAP: { [key: string]: string } = {
  'Estimate Id': 'id',
  'Estimate Name': 'name',
  'Parent Job Number': 'parentJobNumber',
  'Opportunity Number': 'opportunityNumber',
  'Opportunity Status': 'opportunityStatus',
  'Estimate Status': 'estimateStatus',
  'Recommended': 'recommended',
  'Estimates Subtotal': 'subtotal',
  'Sold On': 'soldOn',
  'Sold By': 'soldBy',
  'Estimate Summary': 'summary',
  'Email Sent': 'emailSent',
  'Estimate Viewed Online': 'viewedOnline',
  'Estimate Accepted Online': 'acceptedOnline',
  'Estimates Total': 'total',
  'Creation Date': 'createdAt',
  'Customer ID': 'customerId',
  'Location ID': 'locationId',
  'Services Total': 'servicesTotal',
  'Estimates Material Costs': 'materialCosts',
  'Estimates Total Cost': 'totalCost',
  'Estimate Created By': 'createdBy',
  'Parent Job ID': 'jobId',
  'Estimates Equipment Costs': 'equipmentCosts',
};

const EstimateImportModal: React.FC<EstimateImportModalProps> = ({ isOpen, onClose, onComplete, userId, tenantId }) => {
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
    const data = await f.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    setRows(json as any[]);
    setHeaders(Object.keys(json[0] || {}));
    setStep('preview');
  };

  const handleImport = async () => {
    if (!tenantId) {
      setErrors(prev => [...prev, 'Error: tenantId is missing. Please reload and try again.']);
      return;
    }
    setStep('importing');
    setErrors([]);
    setCurrentImportIndex(0);
    let success = 0, fail = 0;

    // First, process business units and job types from import data
    try {
      console.log('🔧 Processing business units and job types from import data...');
      await processImportedBusinessUnitsAndJobTypes(tenantId, userId, rows);
      console.log('✅ Successfully processed business units and job types');
    } catch (error) {
      console.error('❌ Error processing business units and job types:', error);
      setErrors(prev => [...prev, `Error creating business units/job types: ${error}`]);
    }

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
              // Require Parent Job ID, Customer ID, and Location ID
              const jobId = row['Parent Job ID'] || row['jobId'];
              const customerId = row['Customer ID'] || row['customerId'];
              const locationId = row['Location ID'] || row['locationId'];
              let estimateId = row['Estimate Id'] || row['id'];
              if (!jobId || !customerId || !locationId) {
                batchFail++;
                setErrors(prev => [...prev, `Missing Job ID, Customer ID, or Location ID in row: ${JSON.stringify(row)}`]);
                continue;
              }
              if (!estimateId) {
                estimateId = `estimate_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              }

              // Build estimate object from row
              const estimate: any = {};
              for (const col of headers) {
                const key = FIELD_MAP[col] || col;
                let val = row[col];
                // Parse booleans
                if (['Recommended', 'Email Sent', 'Estimate Viewed Online', 'Estimate Accepted Online'].includes(col)) {
                  val = String(val).toLowerCase() === 'yes' || String(val) === '1' || val === true;
                }
                estimate[key] = val;
              }

              // Add required fields
              estimate.id = estimateId;
              estimate.jobId = jobId;
              estimate.customerId = customerId;
              estimate.locationId = locationId;
              estimate.userId = userId;
              estimate.updatedAt = new Date().toISOString();
              if (!estimate.createdAt) {
                estimate.createdAt = new Date().toISOString();
              }

              // Handle technician assignments for Sold By and Created By
              const techFields = ['Sold By', 'Estimate Created By'];
              for (const field of techFields) {
                const techName = row[field];
                if (techName) {
                  const techId = `tech_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                  estimate[field.toLowerCase().replace(/\s+/g, '')] = {
                    id: techId,
                    name: techName,
                    assignedAt: new Date().toISOString()
                  };
                }
              }

              // Add estimate to batch using tenant-scoped collection
              batch.set(doc(db, 'tenants', tenantId!, 'estimates', estimateId), estimate, { merge: true });

              // Update customer document to include estimate reference
              const customerRef = doc(db, 'tenants', tenantId!, 'customers', customerId);
              const customerSnap = await getDoc(customerRef);
              if (customerSnap.exists()) {
                const customerData = customerSnap.data();
                let locations = Array.isArray(customerData.locations) ? [...customerData.locations] : [];
                const locIdx = locations.findIndex((loc: any) => loc.id === locationId);
                if (locIdx !== -1) {
                  const loc = { ...locations[locIdx] };
                  if (!Array.isArray(loc.estimates)) loc.estimates = [];
                  if (!loc.estimates.includes(estimateId)) loc.estimates.push(estimateId);
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
        <Dialog.Title className="text-lg font-bold mb-4">Import Estimates</Dialog.Title>
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
            <div className="text-gray-700 dark:text-gray-200">{successCount} estimates imported/updated, {failCount} failed.</div>
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

export default EstimateImportModal; 