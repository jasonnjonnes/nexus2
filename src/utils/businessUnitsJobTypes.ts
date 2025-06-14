import { collection, addDoc, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface BusinessUnitData {
  name: string;
  officialName: string;
  email: string;
  phoneNumber: string;
  trade: string;
  division: string;
  isActive: boolean;
  invoiceHeader: string;
  invoiceMessage: string;
}

export interface JobTypeData {
  name: string;
  description: string;
  category: string;
  isActive: boolean;
}

// Generate default business units based on industry
export const generateDefaultBusinessUnits = (industry: string, companyData: any): BusinessUnitData[] => {
  const industryName = industry.replace(' & ', ' ');
  const authorizationText = `I hereby authorize {businessunit_companyname} to proceed with the work described in the attached proposal/estimate dated [Date], including all materials, labor, and services specified therein, for the total amount of \${invoicetotal}. I understand and agree to the terms and conditions outlined in this agreement, including the project timeline, payment schedule, and scope of work. By signing below, I confirm that I have the authority to approve this work and commit to payment upon satisfactory completion.`;
  
  return [
    {
      name: companyData.companyName,
      officialName: `${industryName} - Service`,
      email: companyData.email,
      phoneNumber: companyData.phoneNumber,
      trade: industry,
      division: 'Service',
      isActive: true,
      invoiceHeader: authorizationText,
      invoiceMessage: 'Thanks for doing business with us!'
    },
    {
      name: companyData.companyName,
      officialName: `${industryName} - Repair`,
      email: companyData.email,
      phoneNumber: companyData.phoneNumber,
      trade: industry,
      division: 'Repair',
      isActive: true,
      invoiceHeader: authorizationText,
      invoiceMessage: 'Thanks for doing business with us!'
    },
    {
      name: companyData.companyName,
      officialName: `${industryName} - Maintenance`,
      email: companyData.email,
      phoneNumber: companyData.phoneNumber,
      trade: industry,
      division: 'Maintenance',
      isActive: true,
      invoiceHeader: authorizationText,
      invoiceMessage: 'Thanks for doing business with us!'
    },
    {
      name: companyData.companyName,
      officialName: `${industryName} - Installation`,
      email: companyData.email,
      phoneNumber: companyData.phoneNumber,
      trade: industry,
      division: 'Installation',
      isActive: true,
      invoiceHeader: authorizationText,
      invoiceMessage: 'Thanks for doing business with us!'
    }
  ];
};

// Generate default job types
export const generateDefaultJobTypes = (): JobTypeData[] => {
  return [
    {
      name: 'Service Call',
      description: 'General service call for maintenance, repairs, or troubleshooting',
      category: 'Service Call',
      isActive: true
    },
    {
      name: 'Estimate',
      description: 'On-site estimate for potential work or installation',
      category: 'Estimate',
      isActive: true
    },
    {
      name: 'Diagnosis',
      description: 'Diagnostic service to identify issues and recommend solutions',
      category: 'Diagnosis',
      isActive: true
    }
  ];
};

// Create default business units for a tenant
export const createDefaultBusinessUnits = async (tenantId: string, userId: string, companyData: any) => {
  try {
    const businessUnits = generateDefaultBusinessUnits(companyData.industry, companyData);
    
    for (const businessUnit of businessUnits) {
      await addDoc(collection(db, 'tenants', tenantId, 'businessUnits'), {
        ...businessUnit,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    console.log(`Created ${businessUnits.length} default business units for tenant ${tenantId}`);
  } catch (error) {
    console.error('Error creating default business units:', error);
    throw error;
  }
};

// Create default job types for a tenant
export const createDefaultJobTypes = async (tenantId: string, userId: string) => {
  try {
    const jobTypes = generateDefaultJobTypes();
    
    for (const jobType of jobTypes) {
      await addDoc(collection(db, 'tenants', tenantId, 'jobTypes'), {
        ...jobType,
        userId,
        status: 'active', // For compatibility with existing queries
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    console.log(`Created ${jobTypes.length} default job types for tenant ${tenantId}`);
  } catch (error) {
    console.error('Error creating default job types:', error);
    throw error;
  }
};

// Find or create business unit by name
export const findOrCreateBusinessUnit = async (tenantId: string, userId: string, businessUnitName: string, companyData?: any): Promise<string> => {
  try {
    // First, try to find existing business unit
    const businessUnitsQuery = query(
      collection(db, 'tenants', tenantId, 'businessUnits'),
      where('userId', '==', userId),
      where('officialName', '==', businessUnitName)
    );
    
    const existingUnits = await getDocs(businessUnitsQuery);
    
    if (!existingUnits.empty) {
      return existingUnits.docs[0].id;
    }
    
    // Create new business unit if not found
    const authorizationText = `I hereby authorize {businessunit_companyname} to proceed with the work described in the attached proposal/estimate dated [Date], including all materials, labor, and services specified therein, for the total amount of \${invoicetotal}. I understand and agree to the terms and conditions outlined in this agreement, including the project timeline, payment schedule, and scope of work. By signing below, I confirm that I have the authority to approve this work and commit to payment upon satisfactory completion.`;
    
    const newBusinessUnit = {
      name: companyData?.companyName || businessUnitName,
      officialName: businessUnitName,
      email: companyData?.email || '',
      bccEmail: '',
      phoneNumber: companyData?.phoneNumber || '',
      trade: companyData?.industry || '',
      division: '',
      tags: [],
      defaultWarehouse: '',
      currency: 'USD',
      invoiceHeader: authorizationText,
      invoiceMessage: 'Thanks for doing business with us!',
      logo: '',
      isActive: true,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const docRef = await addDoc(collection(db, 'tenants', tenantId, 'businessUnits'), newBusinessUnit);
    console.log(`Created new business unit: ${businessUnitName} with ID: ${docRef.id}`);
    
    return docRef.id;
  } catch (error) {
    console.error('Error finding or creating business unit:', error);
    throw error;
  }
};

// Find or create job type by name
export const findOrCreateJobType = async (tenantId: string, userId: string, jobTypeName: string): Promise<string> => {
  try {
    // First, try to find existing job type
    const jobTypesQuery = query(
      collection(db, 'tenants', tenantId, 'jobTypes'),
      where('userId', '==', userId),
      where('name', '==', jobTypeName)
    );
    
    const existingTypes = await getDocs(jobTypesQuery);
    
    if (!existingTypes.empty) {
      return existingTypes.docs[0].id;
    }
    
    // Create new job type if not found
    // Determine category based on job type name
    let category = 'Service Call'; // default
    const lowerName = jobTypeName.toLowerCase();
    
    if (lowerName.includes('install')) category = 'Installation';
    else if (lowerName.includes('repair')) category = 'Repair';
    else if (lowerName.includes('maintenance') || lowerName.includes('service')) category = 'Maintenance';
    else if (lowerName.includes('estimate')) category = 'Estimate';
    else if (lowerName.includes('diagnosis') || lowerName.includes('diagnostic')) category = 'Diagnosis';
    else if (lowerName.includes('emergency')) category = 'Emergency';
    else if (lowerName.includes('inspection')) category = 'Inspection';
    
    const newJobType = {
      name: jobTypeName,
      description: `Auto-created job type: ${jobTypeName}`,
      category,
      isActive: true,
      status: 'active', // For compatibility with existing queries
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const docRef = await addDoc(collection(db, 'tenants', tenantId, 'jobTypes'), newJobType);
    console.log(`Created new job type: ${jobTypeName} with ID: ${docRef.id}`);
    
    return docRef.id;
  } catch (error) {
    console.error('Error finding or creating job type:', error);
    throw error;
  }
};

// Batch create business units and job types from import data
export const processImportedBusinessUnitsAndJobTypes = async (
  tenantId: string, 
  userId: string, 
  importData: any[], 
  companyData?: any
) => {
  try {
    const uniqueBusinessUnits = new Set<string>();
    const uniqueJobTypes = new Set<string>();
    
    // Extract unique business units and job types from import data
    importData.forEach(row => {
      if (row.businessUnit && typeof row.businessUnit === 'string') {
        uniqueBusinessUnits.add(row.businessUnit.trim());
      }
      if (row.jobType && typeof row.jobType === 'string') {
        uniqueJobTypes.add(row.jobType.trim());
      }
    });
    
    console.log(`Processing ${uniqueBusinessUnits.size} unique business units and ${uniqueJobTypes.size} unique job types`);
    
    // Create business units
    const businessUnitPromises = Array.from(uniqueBusinessUnits).map(businessUnitName =>
      findOrCreateBusinessUnit(tenantId, userId, businessUnitName, companyData)
    );
    
    // Create job types
    const jobTypePromises = Array.from(uniqueJobTypes).map(jobTypeName =>
      findOrCreateJobType(tenantId, userId, jobTypeName)
    );
    
    await Promise.all([...businessUnitPromises, ...jobTypePromises]);
    
    console.log('Successfully processed all business units and job types from import');
  } catch (error) {
    console.error('Error processing imported business units and job types:', error);
    throw error;
  }
}; 