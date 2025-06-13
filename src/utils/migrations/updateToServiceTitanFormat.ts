import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';

interface MigrationResult {
  success: boolean;
  errors: string[];
  updatedCount: {
    services: number;
    materials: number;
    categories: number;
  };
}

export async function migrateToServiceTitanFormat(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    errors: [],
    updatedCount: {
      services: 0,
      materials: 0,
      categories: 0
    }
  };

  try {
    // Migrate Categories first since other collections depend on them
    const categoriesSnapshot = await getDocs(collection(db, 'pricebook_categories'));
    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryData = categoryDoc.data();
      const updatedCategory = {
        ...categoryData,
        // Add ServiceTitan fields
        serviceTitanId: categoryData.serviceTitanId || null,
        serviceTitanPath: categoryData.serviceTitanPath || null,
        serviceTitanType: categoryData.serviceTitanType || 'service', // 'service', 'material', 'equipment'
        isExcludedFromPricebookWizard: categoryData.isExcludedFromPricebookWizard || false,
        parentId: categoryData.parentId || null,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'pricebook_categories', categoryDoc.id), updatedCategory);
      result.updatedCount.categories++;
    }

    // Migrate Services
    const servicesSnapshot = await getDocs(collection(db, 'pricebook_services'));
    for (const serviceDoc of servicesSnapshot.docs) {
      const serviceData = serviceDoc.data();
      const updatedService = {
        ...serviceData,
        // Add ServiceTitan fields
        serviceTitanId: serviceData.serviceTitanId || null,
        useStaticPrice: serviceData.useStaticPrice || false,
        staticPrice: serviceData.staticPrice || 0,
        staticMemberPrice: serviceData.staticMemberPrice || 0,
        staticAddOnPrice: serviceData.staticAddOnPrice || 0,
        staticMemberAddOnPrice: serviceData.staticMemberAddOnPrice || 0,
        warrantyDescription: serviceData.warrantyDescription || '',
        laborService: serviceData.laborService || true,
        allowDiscounts: serviceData.allowDiscounts || true,
        allowMembershipDiscounts: serviceData.allowMembershipDiscounts || true,
        excludeFromPricebookWizard: serviceData.excludeFromPricebookWizard || false,
        crossSaleGroup: serviceData.crossSaleGroup || '',
        generalLedgerAccount: serviceData.generalLedgerAccount || '',
        expenseAccount: serviceData.expenseAccount || '',
        linkedMaterials: serviceData.linkedMaterials || [],
        linkedEquipment: serviceData.linkedEquipment || [],
        upgrades: serviceData.upgrades || [],
        recommendations: serviceData.recommendations || [],
        conversionTags: serviceData.conversionTags || [],
        commissionPercentage: serviceData.commissionPercentage || 0,
        bonusPercentage: serviceData.bonusPercentage || 0,
        payTechSpecificBonus: serviceData.payTechSpecificBonus || false,
        paysCommission: serviceData.paysCommission || false,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'pricebook_services', serviceDoc.id), updatedService);
      result.updatedCount.services++;
    }

    // Migrate Materials
    const materialsSnapshot = await getDocs(collection(db, 'pricebook_materials'));
    for (const materialDoc of materialsSnapshot.docs) {
      const materialData = materialDoc.data();
      const updatedMaterial = {
        ...materialData,
        // Add ServiceTitan fields
        serviceTitanId: materialData.serviceTitanId || null,
        vendor: materialData.vendor || '',
        vendorPartNumber: materialData.vendorPartNumber || '',
        cost: materialData.cost || 0,
        price: materialData.price || 0,
        markup: materialData.markup || 0,
        unit: materialData.unit || 'each',
        taxable: materialData.taxable !== undefined ? materialData.taxable : true,
        active: materialData.active !== undefined ? materialData.active : true,
        excludeFromPricebookWizard: materialData.excludeFromPricebookWizard || false,
        linkedEquipment: materialData.linkedEquipment || [],
        notes: materialData.notes || '',
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'pricebook_materials', materialDoc.id), updatedMaterial);
      result.updatedCount.materials++;
    }

  } catch (error) {
    result.success = false;
    result.errors.push(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

// Helper function to run the migration
export async function runMigration(): Promise<void> {
  console.log('Starting migration to ServiceTitan format...');
  const result = await migrateToServiceTitanFormat();
  
  if (result.success) {
    console.log('Migration completed successfully!');
    console.log('Updated counts:', result.updatedCount);
  } else {
    console.error('Migration failed:', result.errors);
  }
} 